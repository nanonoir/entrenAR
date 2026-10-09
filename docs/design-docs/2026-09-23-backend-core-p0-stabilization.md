# Design: Backend Core P0 Stabilization

## Technical Approach

Implement exact mathematical ownership of stock lifecycle through Prisma's `InventoryHistory` as a double-entry ledger. Update the Prisma schema to support an `OrderInventoryPolicy` and exact ledger links (`referenceType`, `referenceId`, `movementKind`, `operationId`, `inventoryEffectId`, `compensatesMovementId`). Centralize monetary mathematics into a precision-safe (`Decimal`) `money` module so purchase orders and manual sales compute fields authoritatively. Introduce strict state-machine and backend request validation (via updated frontend payload builders) to prevent client inputs from manipulating derived totals, and ensure manual sales deduct tracking exactly once. Add transactional guards across `CONFIRM` transitions to atomically guarantee `Order.status = CONFIRMED` and `OrderPayment.status = PAID`.

## Architecture Decisions

### Decision: Inventory Truth Authority

**Choice**: `InventoryHistory` becomes the single authority for exact stock effects and compensation targets via unique uncompensated deduction movements, linked by `inventoryEffectId`.
**Alternatives considered**: Managing deducted vs. restored status directly on `OrderItem` or `Order`.
**Rationale**: Storing deduction states on order items risks desynchronization and makes "re-deduction" unmanageable. A movement-based ledger tracks exact product/variant and quantities independently of mutating business entities.

### Decision: Money Calculation Primitive

**Choice**: `Decimal(12,2)` arithmetic logic wrapped in `backend/src/common/money/` for exact precision calculation and accumulation.
**Alternatives considered**: Raw JavaScript floating-point (`sum + quantity * unitPrice`) or cents-based integers.
**Rationale**: The database schema is already locked to PostgreSQL `Decimal(12, 2)`. Wrapping `Decimal.js` (used by Prisma) guarantees precision and format consistency without re-mapping the entire schema to minor units.

### Decision: Confirmation Atomicity

**Choice**: Bundle Order update, Payment update, and History creation inside a single Prisma `$transaction`.
**Alternatives considered**: Emitting an event (`PAYMENT_RECEIVED`) and updating payment asynchronously.
**Rationale**: P0 invariant strictly prohibits `CONFIRMED` without `PAID` and `PAYMENT_RECEIVED` history; asynchronous propagation introduces transient corrupted states.

### Decision: Purchase Order Partial Update Merging

**Choice**: In `PurchaseOrdersService`, read the current row, merge the incoming DTO with existing base fields, recalculate totals, and perform a single write back, protected by a concurrency guard (e.g. `updatedAt` lock).
**Alternatives considered**: Patching total/subtotal manually with SQL diffs (e.g., `total = total + new_tax - old_tax`).
**Rationale**: Doing math at the repository layer obscures domain logic and risks precision loss. Read/Recalculate/Write maintains explicit domain control.

## Architecture Contract

### Responsibility Map

| Module / File | Owns | Must NOT own |
|---|---|---|
| `backend/src/modules/inventory/` | Authoritative stock state, deduction/restoration transactional commands, double-entry ledger | Sale policies, order lifecycle decisions |
| `backend/src/modules/sales/` | Sale intent, lifecycle rules, Order/Payment state | Inventory mathematical deductions, arbitrary derived sum calculation |
| `backend/src/modules/checkout/` | Customer checkout operations, delegating exact inventory deduction and policy assignment | Direct stock mathematics or disconnected ledger writes |
| `backend/src/modules/abandoned-carts/` | Recovery flow, delegating inventory deduction and policy assignment during order creation | Independent inventory logic or non-atomic order conversions |
| `backend/src/common/money/` | Decimal-safe arithmetic operations (`addMoney`, `subtractMoney`, `multiplyMoney`) | Business rules or transport formats |
| `backend/src/modules/purchase-orders/` | Receiving, calculating, and persisting consistent PO money | Raw calculation from unstructured client values |

### Dependency Direction

```text
    Boundary / UI / Route
             ↓
    SalesService / PurchaseOrdersService
             ↓
    InventoryRepository / SalesRepository / PurchaseOrdersRepository / Money (common)
```

### Reuse Plan

| Existing abstraction | Reuse / Extend for |
|---|---|
| `InventoryRepository` | Extend to `deductStockForItems` and `restoreStockForItems` tracking unique `inventoryEffectId` and `compensatesMovementId`. |
| `sales.state-machine.ts` | Extend `transitionSale` constraints to encompass valid payment statuses for `CONFIRM`. |

### Structural Constraints

- `SalesService` MUST NOT compute monetary values with generic JS operators.
- `PurchaseOrdersService` MUST merge `DRAFT` requests using full recalculation.
- Clients MUST NOT send `lineSubtotal`, `subtotal`, `total` via POST/PUT payloads.

## Data Flow

```text
    Client (Create Manual Sale) ──→ SalesController ──→ SalesService (money calc)
                                                               │
    [Transaction]                                              │
      ├─→ InventoryRepository (deduct stock, write ledger)     │
      └─→ SalesRepository (create Order, Payment, History) ────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/prisma/schema.prisma` | Modify | Add `OrderInventoryPolicy`, `inventoryEffectId`, `compensatesMovementId`, etc. |
| `backend/src/common/money/money.utils.ts` | Create | Exact precision arithmetic wrappers around Prisma Decimal. |
| `backend/src/modules/sales/sales.service.ts` | Modify | Calculate manual sale totals, deduct manual stock, atomic confirm. |
| `backend/src/modules/sales/sales.state-machine.ts` | Modify | Reject confirmation on invalid payment state. |
| `backend/src/modules/checkout/checkout.service.ts` | Modify | Assign inventory policy and reference deduction movements atomically. |
| `backend/src/modules/abandoned-carts/abandoned-carts.service.ts` | Modify | Atomically deduct stock and assign inventory policy during conversion. |
| `backend/src/modules/inventory/inventory.repository.ts` | Modify | Generate and track structured unique compensation movements. |
| `backend/src/modules/purchase-orders/purchase-orders.service.ts` | Modify | Recalculate totals upon update; row lock check on writes. |
| `backend/src/modules/purchase-orders/purchase-orders.schemas.ts` | Modify | Remove derived money from request DTOs. |
| `src/lib/api/admin/sales/sales-api.schemas.ts` | Modify | Exclude derived `lineSubtotal`, `subtotal`, `total` from manual sale creation payload. |

## Interfaces / Contracts

```ts
enum OrderInventoryPolicy {
  UNKNOWN,
  NOT_APPLICABLE,
  LEDGER_MANAGED,
  TRANSFERRED
}

// money.utils.ts
export function addMoney(a: number | Decimal, b: number | Decimal): Decimal;
export function subtractMoney(a: number | Decimal, b: number | Decimal): Decimal;
export function multiplyMoney(a: number | Decimal, quantity: number): Decimal;
export function normalizeMoney(value: number | Decimal): Decimal;
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Money computation | Explicit cases for floating-point inaccuracies, negative prevention, zero shipping for PICKUP. |
| Integration | Manual Sale Creation | Validates exact deduction and Order/Payment consistency in Prisma transaction. |
| Integration | Order Confirmation | Confirms failure/rollback if Payment cannot be written. |
| E2E | Cancellation & Reopen | Proves repeated cycle correctly deducts and restores inventory to original balance without doubling. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

Data Migration:
1. Backfill existing `Order.inventoryPolicy` with `UNKNOWN`.
2. Existing orders won't crash when cancelling, but restore requests will explicitly fail closed. Manual reconciliation is required to unlock `UNKNOWN` histories.
3. Deploy frontend payload builders omitting derived fields in tandem with backend DTO changes to prevent `400 Validation Error`.

## Open Questions

- None.
