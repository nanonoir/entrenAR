# Mock Data & Store Inventory (Phase 5 Checkout)

This document inventories every authoritative mock source and Zustand store in the EntrenAR frontend, mapping out their domain, state classification, consumers, and explicit backend API migration targets. Phase 5 adds a verified checkout repository boundary without deleting the local preview sources.

## 1. Zustand Stores Inventory

| Store | Domain | State Classification | Consumers | Migration Target | Removal Gate | PRD Migration Phase |
|---|---|---|---|---|---|---|
| `auth-store` | Auth | Mock-only persisted snapshot; API access token is memory-only | Public Navbar, Checkout, Account | Auth API adapter | `/api/v1/auth/me` and session cookies active | Phase 3 — Customer Account |
| `account-profile-store` | Account | Mock persistence plus API async state | Public Account Pages | Account API adapter | `/api/v1/account/profile` endpoints active | Phase 3 — Customer Account |
| `cart-store` | Checkout | Persisted local preview items plus transient typed quote/session/completion state | Quick Buy, Cart Drawer, Checkout | Checkout quote/session/completion repository | API quote/completion parity, error UX, restart persistence, and mock-removal gate; guest cart remains local | Phase 5 — Checkout |
| `wishlist-store` | Products | Mock persistence plus API async state | Product Cards, Account Wishlist | Wishlist API adapter | Server-side wishlist implemented | Phase 3 — Customer Account |
| `admin-sales-store` | CRM Sales | In-memory | Admin Sales, Orders | Sales API | `/api/v1/admin/sales` migration complete | Phase 6 — Sales CRM |
| `admin-products-store` | CRM Products | In-memory | Admin Products, Inventory | Catalog API | `/api/v1/admin/products` migration complete | Phase 2 — Catalog |
| `admin-categories-store` | CRM Categories | In-memory | Admin Categories | Catalog API | `/api/v1/admin/categories` migration complete | Phase 2 — Catalog |
| `admin-customers-store` | CRM Customers | In-memory | Admin Customers | Customers API | `/api/v1/admin/customers` migration complete | Phase 7 — Customers CRM |
| `admin-discounts-store` | CRM Discounts | In-memory | Admin Coupons & Shipping Discounts | Commerce configuration API | `/api/v1/admin/discounts` migration complete | Phase 4 — Commerce Configuration |
| `admin-payment-methods-store`| CRM Payments | In-memory | Admin Payments | Commerce configuration API | `/api/v1/admin/payment-methods` migration complete | Phase 4 — Commerce Configuration |
| `admin-shipping-store` | CRM Shipping | In-memory | Admin Shipping & Pickup | Commerce configuration API | `/api/v1/admin/shipping` and pickup-point migration complete | Phase 4 — Commerce Configuration |
| `admin-abandoned-carts-store`| CRM Operations | In-memory | Admin Abandoned Carts | Operations API | `/api/v1/admin/abandoned-carts` migration complete | Phase 8 — Abandoned Carts |
| `admin-catalog-organization-store`| CRM Catalog | In-memory | Admin Catalog Settings | Catalog API | `/api/v1/admin/catalog/organization` migration complete | Phase 2 — Catalog |
| `ui-store` | UI | In-memory | Drawers, Mega Menu, Modals | N/A | Remains in frontend | N/A |
| `admin-toast-store` | UI | In-memory | Global Admin Notifications | N/A | Remains in frontend | N/A |

---

## 2. Static Mock Data Inventory (`src/lib/data/*`)

These files act as the current read-only database. They are highly relevant for the Prisma Seed script to ensure the initial backend state matches the current visual mock exactly.

| Mock Module | Domain | Classification | Seed Relevance | Migration Target | Removal Gate | PRD Migration Phase |
|---|---|---|---|---|---|---|
| `products.ts` | Catalog | Static Mock | Primary Catalog Seed | `GET /api/v1/products` | Catalog fetched via API | Phase 2 — Catalog |
| `categories.ts` | Catalog | Static Mock | Primary Categories Seed | `GET /api/v1/categories` | Categories fetched via API | Phase 2 — Catalog |
| `admin/sales-flow/*` | CRM Sales | Static Mock | Base Sales Seed | `GET /api/v1/admin/sales` | Sales fetched via API | Phase 6 — Sales CRM |
| `admin/customers/*` | CRM Users | Static Mock | Base Customers Seed | `GET /api/v1/admin/customers`| Customers fetched via API | Phase 7 — Customers CRM |
| `checkout.ts` | Checkout | Static mock/reference fallback | Reference payment methods, bank-transfer display values, shipping options, pickup points, copy | `POST /api/v1/checkout/{quote,complete}` | API quote/completion parity and dedicated mock-removal gate | Phase 5 — Checkout |
| `account.ts` | Account | Static Mock fallback | Retained for mock mode and rollback; not an API source of truth | `GET /api/v1/account/profile` | API account repository and UI states verified | Phase 3 — Customer Account |
| `promotions.ts` | Marketing | Static Mock | Coupon seed; banners remain optional CMS data | Commerce configuration API | Coupon behavior is API-backed; banner migration is Post-Core | Phase 4 — Commerce Configuration / Post-Core |
| `home.ts`, `footer.ts`, `navigation.ts` | CMS / UI | Static Mock | Optional CMS Seed | CMS APIs | Headless CMS or API implemented | Post-Core |

---

## 3. Phase 5 Checkout Adapter Status

### 3.1 Source Selection

| Setting | Behavior |
|---|---|
| `NEXT_PUBLIC_CHECKOUT_DATA_SOURCE=api` | Explicitly selects `CheckoutApiRepository`. |
| `NEXT_PUBLIC_CHECKOUT_DATA_SOURCE=mock` or any other value | Selects `MockCheckoutRepository`. |
| `NEXT_PUBLIC_DATA_SOURCE=api` with no checkout-specific override | Selects API for checkout through the shared fallback. |
| No source configured | Mock remains the default. |
| `NEXT_PUBLIC_CHECKOUT_API_BASE_URL` | Checkout API base URL; falls back through shared API base variables and then `http://localhost:3001/api/v1`. |

Source fallback is configuration-level only. An API transport/configuration error remains a typed `CheckoutApiError`; it does not silently mutate the source to mock mode.

### 3.2 Checkout Mock Inventory

| Source | Current role | Authority and durability |
|---|---|---|
| `src/lib/data/checkout.ts` | Static payment-method, bank-transfer, shipping-provider, pickup-point, and checkout-copy reference data | Local-only, read-only mock/reference; no real provider or payment call. |
| `src/lib/data/products.ts` | Product/variant input for mock quote resolution | Local-only catalog mock; mock repository derives price, SKU, variant, and stock from it. |
| `src/lib/api/checkout/mock-checkout.repository.ts` | Contract-compatible mock quote/completion adapter | Uses in-memory inventory, session, cart, quote, and idempotency maps per repository instance; not durable. |
| `src/lib/api/checkout/checkout-adapter.harness.ts` | Executable compatibility boundary | Proves mock default/API opt-in, DTO filtering, authoritative mock values, guest/customer reconciliation, controlled conflicts, refresh retry, idempotency, and source fallback behavior. |

The mock repository deliberately keeps the same intent boundary as the API repository: callers provide line IDs and selections, while the repository returns calculated mock projections. It is not evidence that a real order, payment, stock reservation, webhook, refund, or financial reconciliation occurred.

### 3.3 Phase 5 State and Removal Status

- `cart-store` persists only preview cart items under `entrenar-cart-preview`; quote, opaque session token, completion, errors, conflicts, retries, and idempotency keys remain transient.
- Successful API or mock quotes project server/repository item names, quantities, prices, and availability into the local preview cart. Successful completion clears local items; failed completion preserves the cart for controlled retry/conflict handling.
- Guest-to-customer reconciliation is initiated by `auth-store` after API login/register/refresh/bootstrap and uses the checkout repository; logout attempts checkout sync before detaching the local user state.
- Existing account, catalog, commerce, wishlist, admin CRM, and CMS mocks remain outside the Phase 5 removal decision.
- No mock is removed in Phase 5. Checkout/cart mock removal requires the dedicated Phase 10 gate and verified API parity, validation/error UX, persistence/restart behavior, and rollback readiness.

## 4. PRD Migration Strategy & Ordering

**Current phase: Phase 5 — Checkout.** The checkout adapter, store boundary, mock behavior, and API-enabled backend path are verification-ready, but no mock is removed until its domain meets the Phase 10 removal gate.

To prevent breaking the application, each phase replaces only its domain through a frontend repository/API adapter. Zustand remains appropriate for UI state, local selections, optimistic UI, and the guest cart; it stops being the persistent source of truth only after its API parity is verified.

## 5. Customer Account Adapter Verification

The account adapter harness is the executable compatibility boundary for this phase:

```bash
npx tsx src/lib/api/account/account-adapter.harness.ts
```

It verifies mock-default/API-opt-in selection, DTO-only mapping, server-owned identity fields, memory-only token cleanup, loading/empty/error states, server-authoritative responses, and one-time reconciliation of empty server collections with legacy snapshots. The account mock data and local rollback path remain intentionally preserved for the Phase 10 mock-removal gate.

| Sequence | PRD Phase | Migration outcome relevant to this inventory |
|---:|---|---|
| 1 | **Phase 1 — Backend Foundation** | Bootstrap NestJS, PostgreSQL, Prisma, auth/RBAC, validation, errors, seed, Swagger, and test infrastructure. No domain mock removal. |
| 2 | **Phase 2 — Catalog** | Migrate products, categories, inventory, inventory history, catalog organization, and public catalog/product reads. |
| 3 | **Phase 3 — Customer Account** | Migrate auth/account profile, public addresses, wishlist, password operations, and account-order DTO skeleton. |
| 4 | **Phase 4 — Commerce Configuration** | Migrate payment methods, bank transfer, shipping providers/rates, pickup points, coupons/history, and shipping discounts. |
| 5 | **Phase 5 — Checkout** | Replace hardcoded checkout configuration with server-authoritative quote, session, validation, and completion flows. |
| 6 | **Phase 6 — Sales CRM** | Migrate sales, purchase orders, lifecycle commands, archive, and inventory interaction. |
| 7 | **Phase 7 — Customers CRM** | Migrate CRM customer list/detail/edit, notes, summaries, export, and anonymization. |
| 8 | **Phase 8 — Abandoned Carts** | Migrate checkout abandonment, recovery configuration/template, and simulated recovery state. |
| 9 | **Phase 9 — Statistics** | Replace transaction-derived statistics mocks with server aggregates; visits remain unavailable without tracking. |
| 10 | **Phase 10 — Mock Removal** | Delete a mock only after its model, migration, seed, endpoints, validation, mappers, frontend repository, UX states, contract tests, and restart persistence are verified. |

## 6. Phase 5 Migration Record

| Deliverable | Verified outcome |
|---|---|
| Quote | Server-authoritative prices, visibility, stock, payment, shipping/pickup, coupons, discounts, totals, warnings, quote expiry, and guest session projection. |
| Completion | Revalidation, pending order/payment creation, immutable snapshots, atomic stock/history, coupon usage/redemption, cart cleanup, session completion, and owner-scoped idempotent replay. |
| Frontend boundary | Typed API/mock repositories, Zod DTO validation/mapping, server-owned input filtering, controlled errors, bearer/refresh retry, store state projection, and no component-level fetches. |
| Ownership | Guest sessions, JWT-owned customer carts/orders, guest-to-customer merge without duplicate lines, foreign-session denial, and ADMIN checkout rejection. |
| Exclusions | No real Mercado Pago/Stripe, carrier calls, webhooks, refunds, financial reconciliation, external notifications, Phase 6 Sales CRM lifecycle, or Phase 8 abandoned-cart recovery. |

Verification commands and exact results are recorded in `docs/backend/frontend-contracts.md` and the cumulative SDD apply-progress. The inherited shared-development catalog fixture failure involving residual `cmthk...` categories is unrelated; checkout verification used disposable PostgreSQL and made no catalog fixture changes.
