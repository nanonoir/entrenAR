# Mock Data & Store Inventory

This document inventories every authoritative mock source and Zustand store in the EntrenAR frontend, mapping out their domain, state classification, consumers, and explicit backend API migration targets.

## 1. Zustand Stores Inventory

| Store | Domain | State Classification | Consumers | Migration Target | Removal Gate | PRD Migration Phase |
|---|---|---|---|---|---|---|
| `auth-store` | Auth | Persisted (`localStorage`) | Public Navbar, Checkout, Account | Auth API | `/api/v1/auth/me` and session cookies active | Phase 3 — Customer Account |
| `account-profile-store` | Account | Persisted (`localStorage`) | Public Account Pages | Account API | `/api/v1/account/profile` endpoints active | Phase 3 — Customer Account |
| `cart-store` | Checkout | Persisted (`localStorage`) | Quick Buy, Cart Drawer, Checkout | Checkout quote/session API | Server-side quote and checkout validation active; guest cart remains local | Phase 5 — Checkout |
| `wishlist-store` | Products | Persisted (`localStorage`) | Product Cards, Account Wishlist | Wishlist API | Server-side wishlist implemented | Phase 3 — Customer Account |
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
| `checkout.ts` | Checkout | Static Mock | Seed for shipping, pickup, and bank configuration | `POST /api/v1/checkout/quote` | API calculates quote and methods | Phase 5 — Checkout |
| `account.ts` | Account | Static Mock | Ignored (use real auth) | `GET /api/v1/account/profile` | Account uses real session | Phase 3 — Customer Account |
| `promotions.ts` | Marketing | Static Mock | Coupon seed; banners remain optional CMS data | Commerce configuration API | Coupon behavior is API-backed; banner migration is Post-Core | Phase 4 — Commerce Configuration / Post-Core |
| `home.ts`, `footer.ts`, `navigation.ts` | CMS / UI | Static Mock | Optional CMS Seed | CMS APIs | Headless CMS or API implemented | Post-Core |

---

## 3. PRD Migration Strategy & Ordering

**Current phase: Phase 0 — Contract Freeze.** These inventories are Phase 0 evidence; no mock is removed until its domain meets the Phase 10 removal gate.

To prevent breaking the application, each phase replaces only its domain through a frontend repository/API adapter. Zustand remains appropriate for UI state, local selections, optimistic UI, and the guest cart; it stops being the persistent source of truth only after its API parity is verified.

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
