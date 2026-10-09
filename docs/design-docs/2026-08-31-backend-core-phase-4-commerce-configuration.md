# Design: Backend Core Phase 4 Commerce Configuration

## Technical Approach

Implement a unified `CommerceModule` in the NestJS backend to centrally manage configuration for payment methods, shipping providers, pickup points, and discounts (coupons and shipping rules). This module establishes the authoritative database representations for commerce settings. We will enforce coupon code uniqueness with a partial index allowing soft-deletes, guarantee a single main pickup point via transactions, and use a relational `CouponHistory` model for audit trails. Frontend UI stores will connect to a new `CommerceRepository` adapter, retaining existing mock implementations as a fallback during transition until the mock-removal gate.

## Architecture Decisions

### Decision: Unified CommerceModule vs Isolated Modules

**Choice**: Unified `CommerceModule`.
**Alternatives considered**: Isolated modules for Payments, Shipping, and Discounts.
**Rationale**: Grouping checkout configurations minimizes boilerplate, avoids cluttering the application module, and simplifies shared database injection while maintaining separated sub-services for domain logic.

### Decision: Coupon History Audit Trail

**Choice**: Relational `CouponHistory` table.
**Alternatives considered**: JSON array column inside the `Coupon` model.
**Rationale**: A relational model provides strict constraints, enables database indexing for query performance, and aligns with robust audit trail patterns compared to unstructured JSON.

### Decision: Payment Method Configuration Persistence

**Choice**: Database-Seeded `PaymentMethodConfig` table with a nullable `bankConfig` JSON field.
**Alternatives considered**: File-based constants with database only for bank transfers.
**Rationale**: Provides a unified CRUD API and standardizes the activation state for all payment providers. The `bankConfig` JSON field flexibly holds dynamic bank transfer instructions.

### Decision: Handling Open-ended Weight Bands

**Choice**: Nullable `maxWeightGrams` in `WeightBand`.
**Alternatives considered**: Using a maximum integer value (e.g., 999999).
**Rationale**: A true `NULL` correctly reflects an open upper bound without magic numbers, ensuring robust checks for overlapping tiers in backend validation.

## Data Flow

    UI Admin Stores
          │
          ▼
    CommerceApiRepository (Frontend)
          │
          ▼
    Commerce Controllers (NestJS)  ───(Role Check: ADMIN)──┐
          │                                                │
          ▼                                                ▼
    Commerce Services (Domain Logic & Transactional constraints)
          │
          ▼
        Prisma
          │
          ▼
      PostgreSQL DB

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/prisma/schema.prisma` | Modify | Add models for `Coupon`, `CouponHistory`, `CouponCategory`, `CouponProduct`, `ShippingProvider`, `WeightBand`, `PickupPoint`, `PickupPointSchedule`, `ShippingDiscount`, `ShippingDiscountCategory`, and `PaymentMethodConfig`. |
| `backend/prisma/seed.ts` | Modify | Seed default payment methods and default `not_configured` shipping providers (Andreani, Correo Argentino) with initial weight-band ranges. |
| `backend/src/app.module.ts` | Modify | Import and register `CommerceModule`. |
| `backend/src/modules/commerce/commerce.module.ts` | Create | Register sub-controllers and services. |
| `backend/src/modules/commerce/controllers/*.ts` | Create | API endpoints for each sub-domain, secured with `@UseGuards(RolesGuard)`. |
| `backend/src/modules/commerce/services/*.ts` | Create | Business logic (e.g., main pickup point transactions, overlapping checks). |
| `backend/src/modules/commerce/schemas/*.ts` | Create | Zod validation schemas for API inputs. |
| `src/lib/api/commerce/commerce.repository.ts` | Create | Define frontend interface for configuration access. |
| `src/lib/api/commerce/mock-commerce.repository.ts` | Create | Fallback mock adapter keeping existing static data. |
| `src/lib/api/commerce/api-commerce.repository.ts` | Create | Network API adapter. |
| `src/stores/admin-shipping-store.ts` (and related stores) | Modify | Connect state mutations to `getCommerceRepository()`. |
| `backend/test/commerce.e2e-spec.ts` | Create | E2E tests for API protection and CRUD lifecycle. |
| `backend/test/commerce.integration-spec.ts` | Create | Integration tests for Prisma constraints (e.g., partial unique index). |

## Interfaces / Contracts

```typescript
// src/lib/api/commerce/commerce.repository.ts
export interface CommerceRepository {
  // Payments
  getPaymentMethods(): Promise<PaymentMethodConfig[]>;
  updatePaymentMethod(id: string, data: UpdatePaymentMethodDTO): Promise<PaymentMethodConfig>;
  
  // Shipping
  getShippingProviders(): Promise<ShippingProvider[]>;
  updateShippingProvider(id: string, data: UpdateShippingProviderDTO): Promise<ShippingProvider>;
  getPickupPoints(): Promise<PickupPoint[]>;
  createPickupPoint(data: CreatePickupPointDTO): Promise<PickupPoint>;
  updatePickupPoint(id: string, data: UpdatePickupPointDTO): Promise<PickupPoint>;
  
  // Discounts
  getCoupons(): Promise<Coupon[]>;
  createCoupon(data: CreateCouponDTO): Promise<Coupon>;
  updateCoupon(id: string, data: UpdateCouponDTO): Promise<Coupon>;
  getShippingDiscounts(): Promise<ShippingDiscount[]>;
  updateShippingDiscount(id: string, data: UpdateShippingDiscountDTO): Promise<ShippingDiscount>;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Overlapping weight band logic, discount rules | Isolate core business logic in service methods using mocked repositories. |
| Integration | Partial unique constraints, transactional main pickup points | Use `test:integration` with Prisma and an isolated database to verify that concurrent or conflicting operations correctly fail. |
| E2E | Authorization and API CRUD | Use `test:e2e` with Supertest to verify routes return 401/403 for unauthorized access and 200/201 for valid configuration mutations by administrators. |

## Threat Matrix

| Boundary | Applicability | Design response (Safe/Failure behavior) | Planned RED tests |
|---|---|---|---|
| Routing (NestJS API Routes) | Applicable | Safe: Access requires `ADMIN` role. Failure: Returns 401/403. | Unauthorized requests using `CUSTOMER` or no token. |
| Documentation-like paths | N/A: No file execution boundary | | |
| Git repository selection | N/A: No Git commands executed | | |
| Commit state | N/A: No commits executed | | |
| Push state | N/A: No push executed | | |
| PR commands | N/A: No PR commands executed | | |

## Migration / Rollout

Generate a Prisma migration for the new tables. The migration file must be manually edited to include a raw SQL command creating a partial unique index on `Coupon.code` where `deletedAt IS NULL`, supporting soft-deletes while enforcing uniqueness. The database seed will establish required defaults to avoid null states.

## Open Questions

- Should historic orders retain a snapshot of shipping/payment configs instead of live relations? (Assuming yes, snapshots are standard and specified in core checkout rules, but deferred until order module implementation).
