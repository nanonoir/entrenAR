# Design: backend-core-phase-5-checkout

## Technical Approach

Introduce a dedicated `CheckoutModule` in the NestJS backend to isolate transactional order placement from catalog and commerce configuration. The backend will serve as the absolute authority for prices, discounts, shipping calculations, and stock validation through `/quote` and `/complete` endpoints. Orders and their items will be persisted with inline snapshots of all volatile data (prices, names, attributes, addresses) to guarantee historical immutability. Guest carts will be reconciled on authentication, merging local items with the backend cart while avoiding duplicates. Concurrency and overselling will be prevented via atomic stock decrements.

## Architecture Decisions

### Decision: Module Boundaries
**Choice**: Create a dedicated `CheckoutModule`.
**Alternatives considered**: Integrate checkout logic into the existing administrative `CommerceModule`.
**Rationale**: Clean separation of concerns. `CommerceModule` manages static/config rules (coupons, shipping, payment methods), while `CheckoutModule` handles volatile transactional flows, pulling from `Commerce`, `Catalog`, and `Inventory` modules.

### Decision: Checkout Authority
**Choice**: Server-authoritative quote and complete process.
**Alternatives considered**: Trusting frontend cart totals and configurations.
**Rationale**: Client data cannot be trusted. The backend must independently re-evaluate catalog prices, active promotions, and stock levels to prevent fraud and enforce business rules.

### Decision: Historical Data Immutability
**Choice**: Inline data snapshots inside `Order` and `OrderItem` Prisma models.
**Alternatives considered**: Foreign key references to active `Product`, `ProductVariant`, and `UserAddress` tables.
**Rationale**: If a catalog product or address is modified or deleted, referenced historical orders would be corrupted. Storing scalar snapshots (e.g., `productName`, `unitPrice`, `shippingAddressSnapshot`, `paymentInstructions`) guarantees immutable receipts.

### Decision: Concurrency and Overselling Protection
**Choice**: Atomic `decrement` operations inside sequential Prisma transactions.
**Alternatives considered**: Explicit pessimistic locking (`FOR UPDATE`).
**Rationale**: Prisma handles atomic decrements (`quantity: { decrement: X }`) gracefully. If the constraint falls below zero, the transaction fails and rolls back, safely preventing oversells without the complexity of raw SQL row locks.

## Data Flow

    [Frontend Cart / Checkout] 
          │ (1) POST /api/v1/checkout/quote (Items, Coupon, Shipping)
          ▼
    [CheckoutController] ──> [CheckoutService] ──> [Catalog/Commerce] (Re-calculate Totals)
          │
          │ (2) Returns Authoritative Quote (Handles stale quotes via errors)
          ▼
    [Frontend Checkout] 
          │ (3) POST /api/v1/checkout/complete (Idempotency Key, Quote, Customer, Payment)
          ▼
    [CheckoutController] ──> [CheckoutService]
                                  │
      ┌───────────────────────────┴────────────────────────────┐
      │ PRISMA TRANSACTION                                     │
      │ 1. Re-validate Quote, Visibility, & Eligibility        │
      │ 2. Atomic Stock Decrement                              │
      │ 3. Create `Order` & `OrderItem` (Snapshots)            │
      │ 4. Clear Backend Cart (if authenticated cart exists)   │
      └───────────────────────────┬────────────────────────────┘
                                  ▼
                        (4) Returns Order ID (or controlled error)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/prisma/schema.prisma` | Modify | Add `Order`, `OrderItem` models and related enums (`OrderStatus`, `PaymentStatus`). Add `orders` relation to `User`. |
| `backend/src/modules/checkout/checkout.module.ts` | Create | New NestJS checkout domain module. |
| `backend/src/modules/checkout/checkout.controller.ts` | Create | Expose `/quote` and `/complete` endpoints. |
| `backend/src/modules/checkout/checkout.service.ts` | Create | Implement quote calculation, validation, guest cart merging, and atomic transactional order creation. |
| `backend/src/modules/checkout/dto/checkout-openapi.dto.ts` | Create | Zod validation schemas and DTOs for quote and complete requests. |
| `backend/src/app.module.ts` | Modify | Import `CheckoutModule`. |
| `src/lib/api/checkout/checkout-api.repository.ts` | Create | Frontend adapter to call actual backend APIs. |
| `src/lib/api/checkout/mock-checkout.repository.ts` | Create | Fallback mock implementing the interface. |
| `src/lib/api/checkout/client.ts` | Create | Export current adapter (retaining mock for now). |

## Interfaces / Contracts

```typescript
// Frontend/Backend DTO Interface
export interface CheckoutQuoteRequest {
  items: { productId: string; variantId?: string; quantity: number }[];
  couponCode?: string;
  shippingProviderId?: string;
  pickupPointId?: string;
}

export interface CheckoutCompleteRequest extends CheckoutQuoteRequest {
  idempotencyKey: string;
  customer: {
    email: string;
    firstName: string;
    lastName: string;
    dni?: string;
    phone?: string;
  };
  address?: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
  };
  paymentMethodId: string;
}

// Database Schema Enums (Prisma)
enum OrderStatus {
  PENDING
  CONFIRMED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  PAID
  REFUNDED
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Quote validation and total calculation | Test `CheckoutService` independently: verify correct pricing with missing variants, expired coupons, shipping rates, and hidden products. |
| Integration | Transactional completion & atomicity | Test the Prisma transaction block. Simulate concurrent checkout requests targeting the same limited-stock item to verify atomic decrements prevent overselling. |
| E2E | Full checkout lifecycle | Execute API flow: request quote, submit completion with idempotency key, retry with same key (expecting identical response without duplicate placement), and query order history. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No data migration required as the `Order` tables are entirely new and the frontend will temporarily maintain the mock adapter as a fallback until the actual backend deployment is complete. Guest carts locally present will automatically reconcile on their next authentication event.

## Open Questions

- [ ] Will there be a need to support split payments in the future, or can we safely assume a 1:1 relationship between an `Order` and a `PaymentRecord`? (Assuming 1:1 for MVP).