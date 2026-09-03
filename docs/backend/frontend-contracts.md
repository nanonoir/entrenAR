# EntrenAR Backend Core Phase 5: Frontend Checkout Contracts

This document formalizes the consumed DTO shapes, enums, validation rules, state transitions, and backend behaviors verified for the Next.js checkout boundary in Phase 5. Existing account, catalog, commerce, and admin contracts remain documented below; checkout-specific values in this document describe the implemented repository/API adapter rather than a future-only target.

## Phase 5 Outcome

- ✅ The frontend sends only checkout intent (`items`, delivery/customer selections, coupon, payment selection, quote ID, and idempotency key).
- ✅ The backend owns prices, totals, stock, visibility, ownership, coupon eligibility, shipping/pickup eligibility, payment availability, pending-order creation, and snapshot persistence.
- ✅ `src/lib/api/checkout/` provides one typed repository with mock-default/API-opt-in selection, response validation, controlled errors, bearer/refresh handling, and no Prisma dependency.
- ✅ `cart-store` preserves guest/local preview behavior while projecting successful server quote values and clearing local items only after successful completion.

The API-enabled path is opt-in and has no silent error-to-mock failover. Mock mode is an explicit local-preview/rollback source until the dedicated mock-removal gate.

## 1. Public vs. Admin Projections

The frontend expects different shapes for public consumers versus admin CRM consumers. The backend must provide distinct endpoints or mapped projections for these domains.

### 1.1 Products

| Projection | Contract File | Key Identifiers | Consumer |
|---|---|---|---|
| **Public Summary** | `src/types/product.ts` (`ProductSummary`) | `id`, `slug` | Public Grid, Catalog |
| **Public Detail** | `src/types/product.ts` (`ProductDetail`) | `id`, `slug` | Public Product Page |
| **Admin Product** | `src/schemas/admin/product-schemas.ts` | `id`, `slug`, `publicSlug`, `sku` | Admin CRM |

*Note:* `publicSlug` drives the storefront URL `/productos/[publicSlug]`. `slug` is the canonical CRM identifier.

### 1.2 Categories

| Projection | Structure | Identifier / Relation | Consumer |
|---|---|---|---|
| **Public Category** | Flat Array | `slug` | Public Storefront Navigation |
| **Admin Category** | Recursive Tree | `id`, `parentId`, `slug` | Admin CRM Catalog |

---

## 2. Validation Constraints (Zod Enforced)

The backend MUST enforce these constraints, which are currently defined in the frontend Zod schemas (e.g., `src/schemas/admin/product-schemas.ts`) and the PRD.

### Products
- **Name:** Minimum 3 characters.
- **Description:** Minimum 10 characters.
- **Categories:** Must belong to at least one category.
- **Prices:** `salePrice > 0`. If provided, `promotionalPrice > 0` and `promotionalPrice < salePrice`.
- **SEO Metadata:** Title ≤ 70 characters, Description ≤ 160 characters.
- **Variant Properties:** Maximum 2 levels. No duplicate property names.
- **Variant Combinations:** Submitted combinations must exactly match the Cartesian product of active variant properties.

### Shipping Configuration
- **Free Shipping Threshold:** Must be strictly `> 0` if enabled.
- **Weight Ranges:** Ranges cannot overlap. `maxWeight > minWeight`. The maximum bound for the `"10kg+"` band must be nullable internally (no `999999` placeholders).

### Identity Numbers
- **Public account `dni`:** Digits only, **6–9 digits**.
- **CRM `dniOrCuil`:** Normalized identity number, **7–11 digits**.
- These are separate contracts and MUST NOT share one validator. **PRD override/source:** PRD §13 explicitly preserves the two ranges despite any broader mock-data assumption.

### Customer Account Profile

The authenticated account projection contains only the permitted public fields:

```typescript
{
  email: string;
  firstName: string | null;
  lastName: string | null;
  dni: string | null;
  gender: string | null;
  birthDate: string | null; // ISO date
  phone: string | null;
}
```

Profile mutations use `firstName`, `lastName`, `dni`, `gender`, `birthDate`, and `phone`. The backend derives ownership from the access JWT and MUST NOT accept an authoritative `userId` in the route or payload. Password hashes, refresh credentials, reset tokens, and unrelated account data are never part of this projection.

### Customer Addresses

The public account address DTO preserves this shape:

```typescript
{
  id: string;
  label: string;
  recipient: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
}
```

The account repository consumes `GET`/`POST /account/addresses` plus `PUT` and `DELETE /account/addresses/:id`. The server enforces a maximum of six addresses per JWT-owned account. A foreign address ID is treated as a safe not-found/authorization failure and MUST NOT mutate data.

### Password and Wishlist Error Contracts

- `forgot-password` always returns the same successful response for known and unknown emails; the frontend MUST NOT infer account existence from it.
- `reset-password` returns `INVALID_RESET_TOKEN` for missing, expired, or already-consumed reset credentials. Raw reset tokens are not returned or logged.
- Password change uses `INVALID_CREDENTIALS` for an incorrect current password and `VALIDATION_ERROR` for an invalid replacement.
- Wishlist mutations return `PRODUCT_NOT_FOUND` for unknown/unavailable public products, `WISHLIST_ITEM_EXISTS` for duplicates, and `WISHLIST_ITEM_NOT_FOUND` when removing a missing relation.

### Account Orders / Phase 5 History Projection

`GET /account/orders` returns `AccountOrder[]` as a stable JWT-owned projection backed by persisted Phase 5 order snapshots. It returns `[]` only when the authenticated customer has no persisted orders; frontend static order mocks are not presented as server-persisted history.

### Pickup Points
- **Schedule:** A configured/active pickup point has at least one schedule range. Ranges are returned and edited in canonical `dayOfWeek`, then opening-time order; each closing time must be later than its opening time, and ranges on the same day must not overlap.
- **Cost:** `fixedCost` is required when `costType = fixed`.
- **Coverage:** At least one province is required when `coverageType = provinces`. The frontend must use this canonical Argentina list of 24 jurisdictions: `Buenos Aires`, `Ciudad Autónoma de Buenos Aires`, `Catamarca`, `Chaco`, `Chubut`, `Córdoba`, `Corrientes`, `Entre Ríos`, `Formosa`, `Jujuy`, `La Pampa`, `La Rioja`, `Mendoza`, `Misiones`, `Neuquén`, `Río Negro`, `Salta`, `San Juan`, `San Luis`, `Santa Cruz`, `Santa Fe`, `Santiago del Estero`, `Tierra del Fuego`, `Tucumán`.
- **Main point:** At most one pickup point can have `isMain = true`. Assigning a new main point must unset the previous main point transactionally.
- **PRD override/source:** PRD §§39–40 defines the pickup DTO, validation, canonical 24-province editing list, and compatibility rule; the unconfigured `retiro-principal` seed in §41 is the only initial schedule exception.

### Bank Transfer
- **CBU / CVU:** Exactly 22 digits.
- **CUIT / CUIL:** Exactly 11 digits (internal normalization; frontend may format as `XX-XXXXXXXX-X`).

### Coupon Codes
- Must be globally unique (among active/non-deleted).
- Trimmed, uppercase, no spaces, only alphanumeric and hyphens.

---

## 3. Enumerations & Status Cycles

Backend Core must adopt the following existing enumerations to remain compatible with frontend state stores.

### 3.1 Sale Shipping Status
`SaleShippingStatus` (`src/lib/data/admin/sales-flow/types.ts`)
- `to_pack` → `to_ship` → `shipped` → `delivered`
- `to_pack` → `pickup` → `delivered` *(Note: `delivered` represents completed pickup in CRM)*
- `cancelled`

### 3.2 Sale Payment Status
`SalePaymentStatus` (`src/lib/data/admin/sales-flow/types.ts`)
- `pending`
- `received`
- `cancelled`
- `refunded`

### 3.3 Purchase Order Status
`PurchaseOrderStatus`
- `pending`
- `converted`
- `cancelled`

### 3.4 Sale History Events
`SaleHistoryEventType`
- `sale_created`, `sale_updated`, `sale_cancelled`, `sale_reopened`, `sale_archived`
- `payment_received`
- `package_packed`, `package_unpacked`, `package_shipped`, `package_delivered`
- `pickup_ready`, `pickup_completed`
- `stock_reserved` *(legacy mock)*, `stock_deducted`, `stock_restored`
- `email_sent`, `email_failed`

### 3.5 Inventory Types
- `limited(quantity)` (Quantity must be integer ≥ 0)
- `infinite`

---

## 4. DTO Shapes (Core Interfaces)

### 4.1 Admin Sale DTO (`AdminSale`)
```typescript
{
  id: string;
  number: string; // User-visible (e.g. "#101")
  customerId?: string;
  createdAt: string; // ISO 8601
  source?: string;
  customer: { firstName: string, lastName: string, email?: string, phone?: string, dniOrCuil?: string };
  shippingAddress?: { street: string, number: string, city: string, province: string, postalCode: string, ... };
  products: { productId: string, variantId?: string, name: string, quantity: number, unitPrice: number }[]; // Snapshot
  paymentStatus: SalePaymentStatus;
  shippingStatus: SaleShippingStatus;
  subtotal: number;
  shippingCost: number;
  total: number;
  archived: boolean;
  history: SaleHistoryEvent[];
}
```

### 4.2 Checkout Quote Response (Verified Phase 5 Contract)
```typescript
{
  ok: true;
  currency: "ARS";
  quoteId: string; // opaque server-issued token
  sessionToken?: string; // opaque guest token; returned only for guest session creation
  expiresAt?: string; // ISO date-time
  items: {
    productId: string;
    variantId?: string;
    productName: string;
    variantName?: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    lineSubtotal: number;
    compareAtPrice?: number;
    weightGrams?: number | null;
    availableQuantity?: number | null; // null means unlimited
  }[];
  subtotal: number;
  discount: number; // product discount; shipping discount is reflected in shipping
  shipping: number;
  total: number;
  paymentMethods: PaymentMethod[];
  shippingOptions: ShippingOption[];
  pickupPoints: PickupPoint[];
  coupon?: { code?: string; discountAmount: number; result: CouponResult; message?: string } | null;
  warnings: { code: string; message: string }[];
}
```

All monetary values are server-calculated ARS amounts. `PaymentMethod` exposes public method metadata, options, and a narrow bank-transfer projection only; `ShippingOption` exposes the normalized service/provider/cost projection; `PickupPoint` exposes only the address and preparation-time projection. The frontend maps the response through `api-checkout.repository.ts` and never treats local totals as authoritative.

### 4.3 Checkout Request and Completion Contracts

```typescript
interface CheckoutLineItemInput {
  productId: string;
  variantId?: string;
  quantity: number; // positive integer, maximum 1,000
}

interface CheckoutQuoteInput {
  items: CheckoutLineItemInput[];
  sessionToken?: string;
  deliveryType?: "shipping" | "pickup";
  address?: CheckoutAddressInput;
  addressId?: string; // authenticated customer-owned address
  city?: string;
  province?: string;
  postalCode?: string;
  shippingMethodId?: string;
  shippingProviderId?: string;
  pickupPointId?: string;
  couponCode?: string;
}

interface CheckoutCompleteInput extends CheckoutQuoteInput {
  customer: { email: string; firstName: string; lastName: string; dni?: string; phone?: string };
  idempotencyKey: string; // 8–128 characters, owner-scoped
  paymentMethodId: "bank-transfer" | "mercado-pago" | "stripe";
  paymentOptionId?: string;
  quoteId?: string;
}
```

`address` and `addressId` are mutually exclusive. Shipping and pickup selections are mutually exclusive. The adapter reconciles duplicate product/variant lines before sending them. The transport schemas reject unknown or client-authoritative fields such as `total`, line `price`, line `stock`, `cartId`, `userId`, payment state, and order state.

`CheckoutCompleteResponse` returns `ok: true`, `orderId`, `number`, `status: "pending"`, `total`, and the pending order projection (`currency`, `id`, `number`, `status`, `total`). It represents an order/payment intent; it does not represent a provider authorization or captured payment.

### 4.4 Checkout Ownership, Reconciliation, and Errors

| Case | Contract behavior |
|---|---|
| Guest quote | The backend creates or reuses an active cart/session and returns an opaque `sessionToken`; only its hash is persisted. |
| Authenticated quote | The JWT-derived customer owns the cart/session. A supplied guest session can merge into that cart by product/variant key, combining quantities without duplicate lines. |
| Completion | The backend re-reads catalog, inventory, commerce configuration, and session snapshot inside the transaction. A stale quote returns `PRICE_CHANGED`; insufficient stock returns `OUT_OF_STOCK`. |
| Foreign/invalid ownership | `CHECKOUT_SESSION_INVALID` or `UNAUTHORIZED` is returned without a write; ADMIN actors receive `FORBIDDEN`. |
| Completion retry | A matching owner-scoped idempotency key replays the original result. Reusing it for a different request returns `IDEMPOTENCY_KEY_REUSED`. |

Frontend stores normalize all failures to `{ ok: false, code, message, issues?, status? }`. The API client preserves backend status/codes, clears the memory-only bearer token after an unrecoverable `401`, and performs at most one refresh-cookie retry. Retry UI is exposed for conflicts, unavailability, rate limiting, and server errors; validation and ownership errors remain controlled user-facing failures.

### 4.5 Frontend Adapter and State Boundary

| Layer | Phase 5 responsibility |
|---|---|
| `src/lib/api/checkout/checkout.repository.ts` | Stable TypeScript request/response/error contracts, constants, repository selection, and duplicate-line reconciliation. |
| `src/lib/api/checkout/api-checkout.repository.ts` | Zod request/response validation, server-owned payload construction, Decimal/string-to-number mapping, and controlled invalid-response errors. |
| `src/lib/api/checkout/mock-checkout.repository.ts` | Contract-compatible static catalog/commerce reads, mock inventory/session/cart reconciliation, mock completion, controlled conflicts, and idempotent replay. |
| `src/lib/api/checkout/client.ts` | JSON transport, `credentials: "include"`, optional memory-only bearer, one refresh retry, safe API-error normalization, and unavailable-service errors. |
| `src/stores/cart-store.ts` | Persisted preview items only; transient quote/session/completion/error/conflict/retry/idempotency state; quote projection, completion cleanup, guest reconciliation, and logout sync. |
| `src/components/checkout/*` | Collect intent and render store/repository projections. Components do not call `fetch()` directly or import Prisma/backend code. |

Source selection is deterministic: `NEXT_PUBLIC_CHECKOUT_DATA_SOURCE=api` opts into the API repository; otherwise `NEXT_PUBLIC_DATA_SOURCE=api` may select it globally; every other value defaults to mock. The API base URL uses `NEXT_PUBLIC_CHECKOUT_API_BASE_URL`, then shared API base variables, then `http://localhost:3001/api/v1`. An API error does not silently switch sources.

---

## 5. Explicit PRD Overrides vs. Mock Behavior

To ensure a safe migration, the following behaviors described in the PRD **override** the currently implemented local mock behavior:

- **Sale Stock Deduction:** Creating a sale MUST deduct limited inventory atomically. The mock frontend merely appends a `stock_reserved` event without altering a central counter. The backend will actively use `stock_deducted` and prevent overselling.
- **Stock Representation:** The frontend displays large integers for infinite stock in some places. The backend MUST model this cleanly as `limited(number) | infinite`.
- **Sale Lifecycle Commands:** The `delivered` (for shipping) and `pickup_ready` / `pickup_completed` commands are defined in the domain but missing from the local UI. The backend MUST implement these state transitions; the frontend will add the missing CRM buttons in a subsequent phase.
- **Sale Visible Number Generation:** Mock IDs are hardcoded or random. The backend MUST allocate new visible sale numbers sequentially via a concurrency-safe database sequence.
- **Payment Receiving:** Receiving payment appends `payment_received` but MUST NOT deduct inventory a second time (inventory is deducted on creation).
- **Category Deletion:** Mock category deletion cascades entirely on the client. The backend MUST block category deletion with `CATEGORY_IN_USE` if products reference the category or its descendants.
- **Checkout Validation:** The backend MUST re-read prices, stock, visibility, ownership, payment, shipping, coupon, and discount configuration during quote and completion. Frontend-provided totals, prices, stock, IDs, and statuses MUST NEVER be trusted. The mock repository mirrors this authority boundary over static data but remains a local fallback.

---

## 6. Local Persistence & Hydration Expectations

The frontend currently uses Zustand's `persist` middleware with `localStorage` for customer-facing stores.

**Contract Requirements:**
- **Hydration Risk:** Stores use `skipHydration: true`. UI components check `isHydrated` before rendering cart counts or auth states.
- **Auth Store:** On logout, the client clears local state. In target architecture, backend handles HttpOnly session cookies, but the frontend still relies on the `/auth/me` return value to populate `auth-store`.
- **Cart Syncing:** The `cart-store` persists locally. Upon login, the guest cart becomes the active checkout input and the quote repository syncs/revalidates it against the backend; overlapping guest/account lines are merged by product/variant key. The previous backend cart is not trusted from the client, and completion clears local items only after a successful repository response.

## 7. Phase 5 Mock, Provider, and Phase Boundaries

- Static `src/lib/data/checkout.ts` remains the mock source for payment methods, bank-transfer display values, shipping reference options, pickup reference points, and copy. It is not a backend source of truth.
- Mock quote/completion uses static product/configuration data and in-memory inventory/session/idempotency state. It is intentionally not durable and does not replace the backend transaction.
- The API adapter does not add real Mercado Pago/Stripe calls, carrier/label/tracking calls, webhooks, refunds, financial reconciliation, or external notifications.
- Phase 6 Sales CRM lifecycle commands and Phase 8 abandoned-cart recovery remain outside this frontend contract.
- Removing checkout/cart mocks requires the dedicated mock-removal gate: API parity, validation/error UX, restart persistence, and rollback coverage must be proven first.

## 8. Phase 5 Verification Evidence

| Boundary | Command/result |
|---|---|
| Frontend adapter and mock/API selection | `npx tsx src/lib/api/checkout/checkout-adapter.harness.ts` — passed. |
| Backend checkout unit | `npm --prefix backend run test:unit -- --runTestsByPath src/modules/checkout/checkout.service.spec.ts` — 1 suite / 8 tests passed. |
| Backend persistence + domain integration | `npm --prefix backend run test:integration -- --runTestsByPath test/checkout.integration-spec.ts` — 1 suite / 4 tests passed; `test/checkout.domain.integration-spec.ts` — 1 suite / 6 tests passed. |
| Backend HTTP API | `npm --prefix backend run test:e2e -- --runTestsByPath test/checkout.e2e-spec.ts` — 1 suite / 9 tests passed against disposable PostgreSQL. |
| Backend quality | `npm --prefix backend run build` and `npx tsc --noEmit -p tsconfig.json` from `backend/` — both passed. |
| Frontend quality | `npx tsc --noEmit`, `npm run lint`, and `npm run build` from the repository root — all passed. |
| Prisma schema | `npx prisma validate --config ./prisma.config.ts --schema ./prisma/schema.prisma` — valid; live disposable database-to-schema `migrate diff` — empty migration. |

The repository has no browser-specific checkout harness; browser runtime evidence is therefore `N/A`. Real mock behavior is covered by the adapter harness and real API quote→complete/reconciliation/conflict behavior by the backend HTTP E2E suite.
