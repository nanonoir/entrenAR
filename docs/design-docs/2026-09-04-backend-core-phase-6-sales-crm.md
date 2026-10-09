# Design: Backend Core Phase 6 - Sales & CRM

## Technical Approach

Introduce a set of NestJS modules (`SalesModule`, `PurchaseOrdersModule`, `SuppliersModule`) under `backend/src/modules/` to provide the authoritative source of truth for the sales lifecycle, supplier management, and stock replenishment. Extend the Prisma schema to support advanced order tracking, order history audit trails, suppliers, and supplier purchase orders. On the frontend, introduce `SalesRepository`, `PurchaseOrdersRepository`, and `SuppliersRepository` adapter interfaces in `src/lib/api/admin/sales/`, with robust Zod parsing and a mock fallback toggle to integrate smoothly with the existing Zustand stores without breaking the UI.

## Architecture Decisions

### Decision: State Machine in NestJS Services

**Choice**: Enforce lifecycle transitions (e.g. `PACK`, `SHIP`, `DELIVER`, `CANCEL`, `ARCHIVE`) using dedicated methods in `SalesService` wrapped in Prisma `$transaction` blocks.
**Alternatives considered**: Letting controllers or frontend pass the new explicit status (e.g. `PATCH /sales/:id { status: 'SHIPPED' }`).
**Rationale**: Sales transitions trigger side effects (e.g., inventory restoration, history logging, sending emails). Explicit command methods (e.g. `markAsShipped(id)`) ensure all side-effects and prerequisites (like preventing shipment of cancelled orders) are atomically validated and executed, preventing illegal state transitions.

### Decision: Immutable Order History via Relational Table

**Choice**: Create an `OrderHistory` Prisma model linked to `Order` to track every state change, actor, and metadata, rather than just a JSON column on `Order`.
**Alternatives considered**: A `history` JSON array column on the `Order` table.
**Rationale**: Relational history allows for complex querying (e.g., "Find all orders cancelled by user X this week", or "Time taken between packed and shipped"). It also maps cleanly to the `SaleHistoryEvent` the frontend requires.

### Decision: Unified API Adapters with Mock Fallbacks

**Choice**: Define a strictly typed class-based API client layer (e.g., `ApiSalesRepository` and `MockSalesRepository` implementing `SalesRepository`) injected into Zustand stores.
**Alternatives considered**: Raw `fetch` calls scattered inside Zustand actions.
**Rationale**: By using the repository pattern on the frontend, we can cleanly separate transport, Zod validation, and error mapping from UI state management. It also provides a seamless toggle to `MockSalesRepository` if the backend is temporarily unavailable or during iterative development.

### Decision: Naming Collision - Customer vs Supplier POs

**Choice**: The new `PurchaseOrder` Prisma model is exclusively for **Supplier** restock orders. The existing frontend "Customer Purchase Orders" will be modeled in the backend as standard `Order` records with `status = DRAFT` (or a similar pending state) and a specific `source`. 
**Alternatives considered**: Naming the supplier model `SupplierPurchaseOrder` and the customer model `CustomerPurchaseOrder`.
**Rationale**: In e-commerce backend terminology, "Purchase Order" (PO) conventionally refers to supplier restocking. Customer drafts are just unconfirmed sales (Orders). This keeps the Prisma schema clean while the frontend adapters can map them to the existing `AdminPurchaseOrder` types.

## Data Flow

    [Frontend Zustand Store] 
           │ (calls action)
           ▼
    [SalesRepository (Api / Mock)] 
           │ (REST / Zod parse)
           ▼
    [NestJS AdminSalesController] 
           │ (Validate DTO & RBAC)
           ▼
    [SalesService] 
           │ (Business logic & Transitions)
           ▼
    [Prisma $transaction] ───→ [Order] (Update state)
           │
           ├───→ [OrderHistory] (Insert audit log)
           │
           └───→ [InventoryHistory] & [ProductVariant] (Restore stock on Cancel)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/prisma/schema.prisma` | Modify | Add enums, add fields to `Order`, create `OrderHistory`, `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`. |
| `backend/src/modules/sales/sales.module.ts` | Create | Module for sales management. |
| `backend/src/modules/sales/sales.controller.ts` | Create | `AdminSalesController` with transition endpoints (`/pack`, `/ship`, `/cancel`). |
| `backend/src/modules/sales/sales.service.ts` | Create | Service with transactional lifecycle and history logging. |
| `backend/src/modules/purchase-orders/...` | Create | Module, Controller, Service for Supplier POs. |
| `backend/src/modules/suppliers/...` | Create | Module, Controller, Service for Suppliers CRUD. |
| `src/lib/api/admin/sales/sales.repository.ts` | Create | Frontend interface and mock/API implementations. |
| `src/stores/admin-sales-store.ts` | Modify | Wire up the API repository for external mutations. |

## Interfaces / Contracts

**Prisma Extensions**:
```prisma
enum OrderShippingStatus {
  PENDING
  TO_PACK
  TO_SHIP
  SHIPPED
  DELIVERED
}

enum OrderHistoryEventType {
  CREATED
  UPDATED
  CANCELLED
  PAYMENT_RECEIVED
  PACKED
  UNPACKED
  SHIPPED
  DELIVERED
  ARCHIVED
  UNARCHIVED
  REOPENED
  STOCK_RESTORED
}

enum PurchaseOrderStatus {
  DRAFT
  ORDERED
  RECEIVED
  CANCELLED
}

enum SupplierStatus {
  ACTIVE
  INACTIVE
}

// Order extension:
// shippingStatus OrderShippingStatus
// isArchived Boolean @default(false)
// history OrderHistory[]

model OrderHistory {
  id          String   @id @default(cuid())
  orderId     String
  type        OrderHistoryEventType
  title       String
  description String?
  actorId     String?
  actorRole   Role?
  metadata    Json?
  createdAt   DateTime @default(now())
  order       Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
}

model Supplier {
  id             String          @id @default(cuid())
  name           String
  code           String          @unique
  contactName    String?
  email          String?
  phone          String?
  notes          String?
  status         SupplierStatus  @default(ACTIVE)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  purchaseOrders PurchaseOrder[]
}

model PurchaseOrder {
  id           String              @id @default(cuid())
  orderNumber  String              @unique
  supplierId   String
  status       PurchaseOrderStatus @default(DRAFT)
  notes        String?
  subtotal     Decimal             @db.Decimal(12, 2)
  tax          Decimal             @db.Decimal(12, 2)
  shippingCost Decimal             @db.Decimal(12, 2)
  total        Decimal             @db.Decimal(12, 2)
  expectedDate DateTime?
  receivedAt   DateTime?
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt
  supplier     Supplier            @relation(fields: [supplierId], references: [id], onDelete: Restrict)
  items        PurchaseOrderItem[]
}

model PurchaseOrderItem {
  id              String        @id @default(cuid())
  purchaseOrderId String
  productId       String
  variantId       String?
  sku             String
  title           String
  quantity        Int
  unitCost        Decimal       @db.Decimal(12, 2)
  totalCost       Decimal       @db.Decimal(12, 2)
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
}
```

**Frontend Repository Interface**:
```typescript
export interface SalesRepository {
  getSales(filters: any): Promise<AdminSale[]>;
  createSale(input: CreateSaleInput, sourceOrderId?: string): Promise<AdminSale>;
  cancelSale(id: string, reason: string, restoreStock: boolean): Promise<AdminSale>;
  markPacked(id: string): Promise<AdminSale>;
  // ... other transitions
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | SalesService State Machine | Instantiate service with mocked Prisma client. Assert that calling `markPacked` throws if the order is cancelled. |
| Integration | Cancel Sale Stock Restoration | DB test: create sale, deduct stock, call `cancelSale(true)`, assert stock is restored and `InventoryHistory` has `admin_sales_cancellation`. |
| Integration | Receive PO Stock Addition | DB test: create PO, call `receive()`, assert stock increments and `InventoryHistory` has `purchase_order`. |
| E2E | Frontend store wiring | Run Playwright test simulating admin cancelling a sale, intercepting the API to ensure the store reflects the change correctly. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

Run Prisma migrations before deploying the new backend code. The existing Next.js frontend will toggle to using the real `ApiSalesRepository` via an environment variable `NEXT_PUBLIC_USE_MOCK_ADMIN_SALES=false`.

## Open Questions

- [ ] Will Customer Purchase Orders (frontend drafts) explicitly use the `Order` model with `status = PENDING` and `deliveryType = SHIPPING`, or do we need a new `OrderType` enum to distinguish B2B drafts from B2C checkouts?
- [ ] How do we handle partial stock restoration if only part of a sale is cancelled? (Assume all-or-nothing for MVP).
