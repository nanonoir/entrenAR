# Backend Domain Map (Phase 5 Checkout)

This document outlines the bounded contexts and domain boundaries for the standalone NestJS backend through Phase 5 Checkout. It defines module ownership, aggregates, commands, and dependencies based on the implemented backend and frontend repository boundary.

## Phase 5 Outcome

Phase 5 is implemented as a dedicated checkout slice inside the modular monolith:

- ✅ `CheckoutModule` owns quote calculation, checkout-session/cart reconciliation, and completion orchestration.
- ✅ `CatalogRepository`, `CommerceRepository`, and `InventoryRepository` remain owners of their records and expose checkout-safe reads/commands.
- ✅ `CheckoutRepository` coordinates Prisma transactions, pending `Order`/`OrderItem`/`OrderPayment` persistence, coupon redemption, idempotency, cart cleanup, and session completion.
- ✅ Placement-time snapshots are immutable and account history reads only the authenticated customer's persisted projection.
- ✅ `src/lib/api/checkout/` is the only frontend transport boundary; mock data remains an explicit source until the mock-removal gate.

There is no standalone `OrdersModule` or external provider integration in this phase. The persisted `Order` records are the checkout completion output; Phase 6 owns the later sales/fulfillment lifecycle.

## 1. Modular Monolith Architecture

The backend will be structured as a modular monolith inside `backend/src/`.

- `backend/src/modules/` - Bounded business domains.
- `backend/src/common/` - Cross-cutting infrastructure (Auth Guards, Zod Pipes, Prisma Service, Errors).

## 2. Bounded Contexts & Ownership

### 2.1 Catalog Module (`backend/src/modules/catalog/`)
**Ownership:** Products, Categories, Variants, Catalog Organization.
**Aggregates & Entities:**
- `Product` (Aggregate Root): Owns its variants, properties, and image representations.
- `Category` (Entity): Hierarchical tree (recursive `parentId`).
**Value Objects:** `ProductSlug`, `PublicSlug`, `Money` (Decimal).
**Invariants:**
- Products must have at least one Category.
- Promotional price must be strictly lower than sale price.
- `slug` (Admin) and `publicSlug` (Public) must be globally unique.
- A Category cannot be its own ancestor/descendant (cycle prevention).
- Category deletion fails (`CATEGORY_IN_USE`) if any product references it or its descendants.
**Cross-Domain Dependencies:**
- Used by Checkout (Quote validation) and Inventory.

### 2.2 Inventory Module (`backend/src/modules/inventory/`)
**Ownership:** Stock levels and Stock History.
**Aggregates:**
- `InventoryRecord` (Aggregate Root): Tied to a Product or Variant.
- `InventoryHistory` (Entity): Immutable audit log of stock changes.
**Invariants:**
- `stockMode` is `limited` (>= 0) or `infinite`.
- Deductions must be atomic and produce a history record simultaneously.
**Cross-Domain Dependencies:**
- Called by Checkout for completion deductions and by Catalog for inventory-aware reads.

### 2.3 Users Module (`backend/src/modules/users/`)
**Ownership:** Identity records, credentials, password hashing helpers, and role data.
**Aggregates:**
- `User` (Aggregate Root): Identity, credentials, profile fields, and roles.
**Invariants:**
- Email must be unique.
- Passwords must be hashed.
**Cross-Domain Dependencies:**
- Provides identity to Auth, Account, Wishlist, and all protected routes. Users does not own account-address or wishlist business workflows.

### 2.4 Auth Module (`backend/src/modules/auth/`)
**Ownership:** Authentication sessions, access-token issuance, and password lifecycle orchestration.
**Aggregates & Entities:**
- `RefreshToken` (Entity): Rotating, revocable, hashed refresh-session credential.
- `PasswordResetToken` (Entity): Hashed, expiring, one-time recovery credential.
**Invariants:**
- Authenticated projections omit password hashes, refresh credentials, reset tokens, and unrelated account data.
- Forgot-password responses are indistinguishable for known and unknown emails.
- Expired or consumed reset credentials return `INVALID_RESET_TOKEN` and cannot mutate a password.
**Cross-Domain Dependencies:**
- Reads identity and credentials from Users; derives protected ownership from the validated JWT.

### 2.5 Account Module (`backend/src/modules/account/`)
**Ownership:** Customer profile projection, public customer-owned addresses, and the account-order DTO boundary.
**Aggregates & Entities:**
- `AccountProfile` (Projection): The permitted `User` fields exposed to a customer.
- `UserAddress` (Entity): Customer-owned address with a maximum of six records per user.
- `AccountOrder` (Projection): Stable JWT-owned order-history shape mapped from persisted Phase 5 order snapshots; it is empty only when the customer has no persisted orders.
**Invariants:**
- Profile, address, and order requests use the JWT-derived user ID; client-provided ownership IDs are not authoritative.
- Address updates and deletes must verify ownership and must not mutate foreign records.
- The order projection must not invent or read static mock orders as persisted history; it reads only orders owned by the JWT subject.
**Cross-Domain Dependencies:**
- Reads and updates Users profile fields and reads persisted Orders without owning order persistence or lifecycle commands.

### 2.6 Wishlist Module (`backend/src/modules/wishlist/`)
**Ownership:** Authenticated customer wishlist relations and their public-product projections.
**Aggregates & Entities:**
- `WishlistItem` (Entity): Unique composite relation between a JWT-derived user and a Product.
**Invariants:**
- Duplicate user/product relations are rejected with `WISHLIST_ITEM_EXISTS`.
- Unknown or unavailable products are rejected with a controlled product error.
- Removal of a missing relation returns `WISHLIST_ITEM_NOT_FOUND` without affecting other relations.
**Cross-Domain Dependencies:**
- Reads public visibility and product projections from Catalog; reads ownership from Auth/Users.

### 2.7 Checkout Module (`backend/src/modules/checkout/`)
**Ownership:** Checkout Quote, Checkout Session, active checkout cart synchronization, and transactional conversion into a pending order.
**Aggregates:**
- `CheckoutSession` (Aggregate Root): Tracks the active cart state, quote snapshot, recovery state, and conversion toward order creation.
- `Cart` / `CartItem`: Active guest or customer cart used by checkout; cart ownership is nullable for guests and JWT-derived for customers.
- `Order` / `OrderItem` / `OrderPayment`: Placement output persisted by `CheckoutRepository` with immutable customer, delivery, discount, payment, product, price, quantity, weight, and attribute snapshots.
- `CheckoutIdempotencyKey` / `CouponRedemption`: Transactional retry and usage records scoped to the completion owner.
**Invariants:**
- Checkout calculations and completion are entirely server-authoritative. Browser totals, prices, stock, cart IDs, user IDs, payment states, and order states are ignored or rejected.
- Guest sessions use opaque tokens; only token hashes are persisted. Customer ownership comes from the validated JWT and ADMIN actors are rejected.
- Guest and customer carts merge by product/variant key without duplicate lines; foreign or expired sessions do not mutate state.
- Current public product visibility, category visibility, variant ownership, effective price, stock, active payment/bank configuration, shipping/pickup options, coupons, and shipping discounts are re-read for each quote and completion.
- Completion requires a valid payment method/option and delivery selection, then atomically creates a pending order/payment, records usage/history, conditionally deducts stock, clears the cart, completes the session, and stores the replay response. For Mercado Pago card payments, placement creates the pending order, deducts stock, and records the initial SUBMITTING attempt in a single database transaction, deferring cart cleanup and session completion until verified provider payment approval or accepted processing/review.
- Matching idempotency retries return the stored response without duplicate writes; mismatched reuse returns a controlled conflict.
- Order and order-item snapshots cannot be updated after placement; later catalog/configuration edits do not change history.
**Cross-Domain Dependencies:**
- Reads from Catalog, Inventory, and Commerce Configuration. Owns the transaction boundary that writes pending Orders persistence; coordinates with Payments module for card placement and active order lookup. It does not own later order lifecycle commands.

### 2.8 Orders & Sales Modules (`backend/src/modules/orders/`, `backend/src/modules/sales/`)
**Ownership:** Sales lifecycle, order history, payment reconciliation, dispatch tracking, and fulfillment guards.
**Aggregates:**
- `Order` (Aggregate Root): Persisted customer order and delivery/pricing snapshots.
- `Sale` (Aggregate Root): Confirmed sales projection with history and state transitions.
- `OrderHistory`: Immutable chronological transition events.
**Invariants:**
- Historical checkout snapshots are immutable.
- Payment confirmation for Mercado Pago sales requires verified provider state; manual override commands are rejected.
- Fulfillment commands (pack, ship, deliver) require verified payment (`PAID` or `PARTIALLY_REFUNDED`) and are blocked by active disputes, full refunds, or fraud holds.
- Cancellation of paid provider orders requires a verified full refund in Mercado Pago first.
**Cross-Domain Dependencies:**
- Coordinates with Payments for provider status DTOs and fulfillment guards; coordinates with Inventory for ledger-managed stock actions.

### 2.9 CRM Customers Module (`backend/src/modules/customers/`)
**Ownership:** CRM Customer profiles, aggregated statistics.
**Aggregates:**
- `CrmCustomer` (Aggregate Root): CRM representation of buyers.
**Invariants:**
- Active customer emails must be unique.
- Customer deletion is an **anonymization** (soft delete retaining non-PII transaction history).
**Cross-Domain Dependencies:**
- Read by Orders (links sales).

### 2.10 Commerce Configuration Module (`backend/src/modules/commerce/`)
**Ownership:** Payment Providers, Shipping Providers, Pickup Points, Coupons, Shipping Discounts.
**Aggregates:**
- `Coupon`, `ShippingProvider`, `PickupPoint`.
**Invariants:**
- `Coupon` codes must be globally unique (among active/non-deleted).
- `Coupon` redemption is tracked transactionally.
- `PickupPoint` can only have one `isMain = true` record globally.
**Cross-Domain Dependencies:**
- Read by Checkout; Commerce remains the owner of configuration validation and persistence, while Checkout consumes safe projections only.

### 2.11 Statistics Module (`backend/src/modules/statistics/`)
**Ownership:** Aggregation of transactional data.
**Aggregates:** Derived views/metrics.
**Invariants:** Revenue/Sales aggregates only count payment-received, non-cancelled, non-refunded sales.
**Prohibited Coupling:** Visit tracking is out of scope and must not be mocked from order data.

### 2.12 Payments Module (`backend/src/modules/payments/`)
**Ownership:** Mercado Pago Card Payments (Orders API), attempt lifecycle, webhook inbox, scheduled reconciliation, retry lifecycle, payment status normalization.
**Aggregates:**
- `OrderPayment`: Payment summary attached to `Order`.
- `PaymentAttempt`: Sequential attempts per order with client/provider idempotency keys and allowlisted provider status.
- `PaymentNotification`: Durable webhook inbox with signature verification and processing state.
**Invariants:**
- Server-authoritative totals: charged amount always matches frozen backend order total in ARS.
- At most one active payable attempt per order.
- Stock is reserved at card submit and compensated exactly once through the inventory ledger on expiry (10-minute retry window) or cancellation.
- Card tokens and raw payload bodies are never persisted.
- Webhooks require valid HMAC `x-signature` within timestamp tolerance and are processed durably.
- Indeterminate creation outcomes transition to `UNKNOWN` with held stock; escalation occurs at 30 minutes for administrative investigation.
**Cross-Domain Dependencies:**
- Coordinates with Checkout for initial placement and active order queries.
- Provides fulfillment guards and payment status DTOs to Sales.
- Restores stock via Inventory ledger.

## 3. Frontend Evidence & Mappers

**Evidence Source:**
- Types: `src/types/product.ts`, `src/lib/data/admin/sales-flow/types.ts`.
- Schemas: `src/schemas/admin/product-schemas.ts`, `src/schemas/admin/order-schema.ts`.

**Mapper Directives (Database != API Contract):**
- **Products:** Database entity maps to `ProductSummary`, `ProductDetail` (Public), and `AdminProduct` (CRM).
- **Categories:** Database adjacency list maps to a flat list for Public navigation, and a nested tree for CRM.
- **Order Status:** Internal `SaleShippingStatus` maps to public `preparacion`, `en-camino`, `entregado`, `listo-para-retirar` (pickup), `cancelado`.
- **Inventory:** Internal numeric limits map to frontend `stockMode` (`infinite` or quantity).

### 3.1 Phase 5 Checkout Boundary

- `src/lib/api/checkout/checkout.repository.ts` defines the frontend-facing request, quote, completion, error, and source-selection contracts.
- `src/lib/api/checkout/api-checkout.repository.ts` validates transport DTOs, strips client-authoritative fields, maps Decimal-like response values to numbers, and exposes only safe projections.
- `src/lib/api/checkout/mock-checkout.repository.ts` implements the same contract over static catalog/commerce mocks for local preview and rollback.
- `src/stores/cart-store.ts` owns transient quote/session/error/idempotency state and persists only preview cart items under `entrenar-cart-preview`; it delegates quote and completion to the selected repository.
- Checkout components consume store projections and may render labeled mock/reference values while a quote is loading or unavailable. They do not call `fetch()` directly and never import Prisma/backend modules.

## 4. Prohibited Coupling
- Do not couple the database Schema directly to the REST API responses (No raw Prisma exposure).
- Do not rely on frontend-provided calculated totals or status values.
- Do not merge `Sale` and `PurchaseOrder` into a single frontend UI type; they maintain conceptual separation.
- External payment processing (Mercado Pago Orders API, webhooks, reconciliation) is strictly encapsulated within `backend/src/modules/payments/` via ports (`MercadoPagoOrdersPort`) and HTTP adapters. Domain modules (`sales`, `checkout`, `inventory`) interact only through internal domain ports and transaction coordinators, never calling external payment APIs directly.
- Do not scatter checkout `fetch()` calls through components or import Prisma into the Next.js frontend; the repository/API adapter is the boundary.
- Do not remove static checkout/cart mocks until the dedicated mock-removal gate proves API parity, UX/error coverage, restart persistence, and rollback readiness.

## 5. Checkout & Payment Flows

```text
Frontend cart/store
  -> checkout repository / payment store
  -> POST /api/v1/checkout/quote
  -> CheckoutController -> CheckoutService -> Catalog/Commerce/Inventory projections
  -> authoritative quote + opaque session/quote IDs

Bank transfer flow:
  -> POST /api/v1/checkout/complete
  -> one Prisma transaction: revalidate -> deduct stock/history -> order/item/payment snapshots
     -> coupon usage/redemption -> cart cleanup -> session completion -> idempotency response

Mercado Pago Card flow:
  -> Card Payment Brick (@mercadopago/sdk-react) tokenizes card
  -> POST /api/v1/checkout/payments/mercadopago
  -> one Prisma transaction: revalidate quote -> deduct stock -> order/item/payment snapshots
     -> claim initial SUBMITTING attempt
  -> in-request provider call (Orders API CREATE with X-Idempotency-Key)
  -> reducer updates attempt/payment/order -> clears submitted cart generation on approved/processing
  -> webhooks (POST /api/v1/payments/mercadopago/webhooks) & scheduled workers reconcile lifecycle
```

Bank transfer completion creates a pending order and payment intent. For Mercado Pago card payments, placement creates the pending order and reserves stock, followed by an immediate in-request Orders API payment attempt, signed webhook processing, and background reconciliation. Carrier shipping labels/tracking and external email delivery remain explicitly out of scope.
