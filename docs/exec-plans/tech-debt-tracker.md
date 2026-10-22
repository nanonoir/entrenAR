# Technical Debt Tracker

Concrete unresolved technical debt items tracked across the EntrenAR repository.

## Active Items

### 1. Unified CRM Form Architecture Migration (RHF + Zod)
- **Context**: The Admin CRM product and catalog drawers were migrated to React Hook Form + Zod, but shop forms (Checkout, Account Profile) still use manual React state validation.
- **Impact**: Inconsistent validation patterns between public storefront forms and back-office CRM forms.
- **Reference**: Established in earlier phases (`crm-products`, `sales-flow-manual-fixes`). Dedicated refactor phase needed.

### 2. Mock Boundary Simplification and Full Showcase Live Transition
- **Context**: While the real catalog (649 products, 1,119 variants) and core backend modules are operational, fallback mock adapters still exist under `src/lib/data` for selected preview/standalone surfaces.
- **Impact**: Maintenance overhead for duplicate mock structures alongside production REST adapters under `src/lib/api`.
- **Reference**: `src/lib/data/` fallback harnesses.

### 3. Operator Bank Transfer Configuration (Placeholder Demo Credentials)
- **Context**: While real online card payment processing with Mercado Pago (Card Payment Brick + Orders API) is now fully delivered and verified, backend database seeds configure placeholder bank transfer data (`EntrenAR Demo`, zeroed CBU/CUIT). Frontend checkout includes defensive guards (`bank-transfer-config.ts`) that block transfer completion and prevent displaying placeholder credentials when placeholder data is detected. Enabling production bank transfers requires an operator to configure authentic banking credentials in the backend commerce settings or database environment.
- **Impact**: Customer bank transfer orders remain defensively blocked in demo/seed environments until authentic credentials are provided.
- **Reference**: `src/components/checkout/bank-transfer-config.ts`, `docs/product-specs/static-support-pages/spec.md`.

### 4. Media Asset Pipeline & Showcase Visuals
- **Context**: While real catalog data and Cloudflare R2 handoff exist, certain product visuals still rely on fallback static SVGs and mock image tones rather than fully uploaded and optimized assets.
- **Impact**: Product cards display placeholder visuals in select categories during offline or preview runs.
- **Reference**: `docs/references/prds/realistic-showcase-seeder-and-media.md`.

### 5. Automated Showcase CRM Reset Simulator
- **Context**: The hourly showcase data reset mechanism for public demo environments is specified but remains pending full implementation and cron scheduling.
- **Impact**: Showcase demo modifications accumulate until manual database re-seeding occurs.
- **Reference**: `docs/design-docs/2026-09-24-showcase-crm-data-reset-hourly.md`.

### 6. Variant Name Normalization Telemetry Distinction (`customNames`)
- **Context**: In `backend/src/modules/catalog/variant-name-normalization.ts`, `planVariantNameNormalization` classifies any non-empty variant name that differs from the SKU as custom (`customNames`). Re-running the script against an already-normalized database counts previously normalized names under `customNames` rather than distinguishing previously normalized records from user-defined custom names.
- **Impact**: Minor diagnostic telemetry imprecision during maintenance runs; zero impact on normalization safety, database integrity, or runtime behavior.
- **Reference**: `backend/src/modules/catalog/variant-name-normalization.ts`, `docs/exec-plans/completed/structured-variant-selectors.md`.

### 7. Online Customer Support Request Intake (Returns & Repentance)
- **Context**: Frontend mock submission forms on `/boton-de-arrepentimiento` and `/cambios-y-devoluciones` were removed to eliminate fictitious submission confirmations ("Solicitud recibida"), replaced by `SupportRequestUnavailable` stating that online requests are currently unavailable. The repository lacks a backend intake endpoint, processing queue, or transactional email service to receive and manage customer returns, exchanges, or statutory repentance requests. Additionally, the informational copy in `/politicas/devoluciones` ("Cómo iniciar una solicitud") describes completing order details and reason, while its CTA routes to `/cambios-y-devoluciones` where online requests are marked unavailable.
- **Impact**: Customers cannot submit automated return or cancellation requests online and must be guided to order tracking (`/gestion-de-pedidos`) or account consultation (`/mi-cuenta`).
- **Reference**: `src/components/shop/support/SupportRequestUnavailable.tsx`, `docs/product-specs/client-support-actions/spec.md`, `src/app/(shop)/politicas/devoluciones/page.tsx`.

### 8. Admin Inventory Client-Side Pagination & Full Catalog In-Memory Load
- **Context**: `/admin/inventario` (and `/admin/productos`) loads the complete catalog dataset (649 products, 1,119 variants) into the client Zustand store (`useAdminCatalogStore`) to power instant search, category/stock filtering, and optimistic inline stock edits. Although 25-item client-side pagination and URL parameter synchronization (`page`, `q`, `stock`, `categoria`) keep DOM rendering efficient, the initial request and client-side memory retain the entire catalog.
- **Impact**: Increased initial network payload and client memory usage; represents a scaling boundary if the catalog expands significantly beyond ~1,000 items. Migrating to server-side search and pagination requires redesigning the synchronous optimistic inline stock update flow.
- **Reference**: `docs/design-docs/2026-10-15-admin-correction-flow.md`, `docs/exec-plans/completed/admin-panel-correction-flow.md`, `src/lib/data/admin/inventory-view.ts`.

### 9. Checkout Quote Retry Architecture & Variant Schema Alignment
- **Context**: In `src/stores/cart-checkout.actions.ts`, quote retry depends on a module-scoped `lastQuoteInput` reference rather than persistent store-driven lifecycle management. Additionally, line item `variantId` is typed as optional in frontend checkout schemas (`checkout-api.schemas.ts`) while backend checkout request contracts require an identifier (`checkout-request.schemas.ts`).
- **Impact**: Module-scoped retry state can be lost or desynchronized across complex navigation flows; potential schema divergence between frontend quote/checkout payloads and backend strict schema validations for products with or without variants.
- **Reference**: `src/stores/cart-checkout.actions.ts`, `src/lib/api/checkout/checkout-api.schemas.ts`, `backend/src/modules/checkout/contracts/checkout-request.schemas.ts`, `docs/exec-plans/completed/checkout-fetch-receiver.md`.

### 10. Partial Argentine Postal Code Coverage (GeoNames CP4 / CABA Postal Directory Gap)
- **Context**: Postal code validation uses format checking (CP4 / CPA) plus deterministic CPA 1st-letter province mapping (covering all 24 jurisdictions per ISO 3166-2:AR) and a GeoNames-derived CP4 lookup table (`cp4-province-table.generated.ts`, CC BY 4.0). From 20,260 rows (1,976 distinct CP4 values), 1,853 single-province values are recognized, while 123 multi-province ambiguous codes are omitted from auto-recognition and fall back to manual province entry without blocking checkout. In Ciudad Autónoma de Buenos Aires (CABA), only the explicit fixture entry `1406` is recognized numerically; other CABA postal codes remain unmapped as unknown (manual selection fallback). Georef v2.1 snapshots provide 24 jurisdictions and 4,000+ official localities, but contain no postal code data and do not constitute an exhaustive national postal directory. Correo Argentino publishes no official bulk postal dataset and only offers address-level CPA resolution via a corporate web service. Fictitious range guessing (such as assuming 1000–1440 for CABA) and misrepresenting third-party data as official carrier datasets are explicitly prohibited.
- **Impact**: Shoppers with CABA postal codes other than 1406 or unmapped/ambiguous CP4 codes must manually select their province and locality rather than receiving automatic recognition. Checkout is never blocked, but full verified postal directory coverage across Argentina remains incomplete.
- **Reference**: `docs/design-docs/2026-10-19-checkout-inputs-drafts-delivery.md`, `src/lib/data/locations/postal-code.ts`, `scripts/generate-cp4-province-table.ts`.

### 11. Account Saved Addresses (UserAddress) Lack Structured Floor and Neighborhood Fields
- **Context**: The checkout wizard now supports additive structured optional fields `floor` (≤80 characters) and `neighborhood` (≤120 characters) end-to-end for guest and inline address checkout, persisting them cleanly in the order's `shippingAddressSnapshot` JSON without database migrations, and exposing them in CRM sales detail and editing. However, the pre-existing customer account address entity (`UserAddress` Prisma model and DTOs) only defines `street`, `number`, `city`, `provinceOrState`, `postalCode`, and `country`, omitting `floorOrApartment` and `neighborhood`. The current checkout wizard collects inline addresses and does not yet support selecting/reusing pre-saved `addressId` addresses.
- **Impact**: When saved account addresses (`addressId`) are eventually integrated into the checkout wizard, orders placed with pre-saved account addresses will not carry structured `floor` or `neighborhood` fields until `UserAddress` schema is migrated and customer profile endpoints are updated. This is non-blocking for the current inline wizard.
- **Reference**: `docs/design-docs/2026-10-19-checkout-inputs-drafts-delivery.md`, `backend/prisma/schema.prisma` (`UserAddress`), `docs/design-docs/2026-09-04-backend-core-phase-7-customers-crm.md`.

### 14. Shared Database for Backend Integration and E2E Tests
- **Context**: Backend integration and e2e test suites run against the shared development database configured in `DATABASE_URL`. Running test suites leaves orders, payment attempts, and append-only ledger rows behind in the shared database. If background workers (`PaymentWorkersService`) are active on the development backend concurrently, they can process or expire test orders.
- **Impact**: Shared dev database contamination and potential race conditions between running background workers and active test executions; requires manual or scripted cleanup.
- **Reference**: `docs/exec-plans/completed/mercadopago-card-payments.md`, `backend/test/payments-reconciliation.integration-spec.ts`.

### 15. Checkout Fixture Product Cleanup and Lifecycle (`createCheckoutFixtures`)
- **Context**: The shared test fixture generator `createCheckoutFixtures` creates products with prefix `checkout-api-product-*` set to `isVisible: true`. Because the append-only inventory ledger forbids deleting records linked to inventory history, these test products remain permanently in the database and visible in catalog searches unless manually flagged as HIDDEN.
- **Impact**: Accumulation of visible dummy products in local development and test database catalogs.
- **Reference**: `backend/test/helpers/checkout-fixtures.ts`, `backend/test/payments-card.integration-spec.ts`.

### 16. Pre-existing Variant Validation and Catalog Cutover Test Failures
- **Context**: On the local development database, five integration test suites (`showcase-reset`, `checkout-quote`, `checkout-completion`, `commerce`, `catalog-persistence`) fail with the assertion error "Product p-whey-pro must have at least one ProductVariant". Additionally, two ESLint errors exist in `backend/src/modules/catalog-cutover/catalog-cutover.spec.ts` originating from historical `main`.
- **Impact**: Obscures test suite signal when running comprehensive integration passes; requires targeting specific test suites during verification.
- **Reference**: `backend/src/modules/catalog-cutover/catalog-cutover.spec.ts`, `docs/exec-plans/completed/mercadopago-card-payments.md`.

### 17. Guest Cart Unreachable Items Added During Active Payment Session
- **Context**: When a customer initiates a card payment, the current checkout session and cart generation are locked. If the guest adds new items to their cart in another tab while payment submission or retry is in flight, those additional items become unreachable in that session once the guest checkout session completes upon payment verification.
- **Impact**: Minor edge-case cart desynchronization for multi-tab guest users during active payment processing.
- **Reference**: `src/stores/useCheckoutPaymentStore.ts`, `src/lib/api/payments/checkout-payments.adapter.ts`.

### 18. Database-Level Integration Tests for Edge Payment Operations
- **Context**: Edge-case payment database operations—specifically `cancelUncreated` (compensating stock if process fails prior to attempt creation), cart trim upon placement, and the admin 30-minute eligibility rule on `POST /admin/sales/:id/payment/resolve-unknown`—are covered by unit and mock specs but lack isolated database-level integration tests.
- **Impact**: Risk of undetected regressions in low-level transactional boundary logic for uncreated cancellations or cart trimming under concurrent database workloads.
- **Reference**: `backend/src/modules/payments/payment-unknown-resolution.service.ts`, `backend/src/modules/checkout/checkout-completion.service.ts`.

### 19. Webhook Signature Verification Fixed Test Vectors
- **Context**: Automated webhook signature tests in `mercadopago-webhook.signature.spec.ts` generate signatures dynamically using the internal signer function rather than asserting against an immutable, fixed test vector captured from an authentic Mercado Pago webhook transmission (containing timestamp, v1 HMAC, x-request-id, and data.id).
- **Impact**: Signature verification unit test suite is partially circular (testing the verification algorithm against its own generation logic); a verified fixed vector from production/sandbox telemetry is needed.
- **Reference**: `backend/src/modules/payments/mercadopago/mercadopago-webhook.signature.ts`, `backend/src/modules/payments/mercadopago/mercadopago-webhook.signature.spec.ts`.

### 20. Content Security Policy (CSP) Definition for Mercado Pago SDK and Challenge Origins
- **Context**: Next.js frontend currently does not enforce a Content Security Policy (`next.config.ts`). When a CSP header is introduced in the future, it must explicitly allow the Mercado Pago JS SDK (`https://sdk.mercadopago.com`), secure iframe fields, API endpoints (`https://api.mercadopago.com`), and 3DS challenge frame origins.
- **Impact**: If a strict CSP is deployed without configuring Mercado Pago rules, Card Payment Brick and 3DS challenge frames will fail to load or communicate.
- **Reference**: `next.config.ts`, `docs/design-docs/2026-10-21-mercadopago-card-payments.md`.

### 21. Live Sandbox Verification for Complex Scenarios (CONT Pending, 3DS Challenge, Chargeback/Fraud Signals, CREATE Idempotency Retention)
- **Context**: In the live Mercado Pago Orders API sandbox environment, certain edge flows could not be reproduced: `CONT` (in process) resolves immediately in sandbox; 3DS challenge card (`APRO-CHOK`) approved directly without prompting a challenge iframe; chargebacks and fraud alerts are not triggerable via test cards; and provider idempotency retention under rapid retry could not be proven (leading to `PAYMENT_CREATE_MAX_CALLS = 1`). These paths are validated through comprehensive unit and e2e harness tests, but have not been exercised against live provider sandbox endpoints.
- **Impact**: Behavior for 3DS challenges and risk alerts in production relies on published provider specifications and simulated harnesses rather than observed live sandbox executions.
- **Reference**: `docs/exec-plans/completed/mercadopago-card-payments.md`, `backend/src/modules/payments/mercadopago/mercadopago-orders.http-adapter.ts`.

## Resolved Items

### 12. CRM Showcase Runtime Verification (Resolved: 2026-10-09)
- **Context**: The initial isolated runtime verification was blocked due to pre-existing administrative authentication rows and unconfigured commerce prerequisites.
- **Resolution**: Trusted owner explicitly authorized local execution on `127.0.0.1:5432/entrenar`. Verified with private backup (40 tables restored and validated on isolated port 55439), manual demo commerce options configured, real checkout (2/2) and persistence test suites (9/9) passed on isolated copies. Single-shot generation succeeded (80 orders, 20 customers, 3 suppliers, 4 purchases, 6 coupons, 8 abandoned carts) and rerun proved idempotent (`already-generated` with identical full-state digest). Preserved 42 ADMIN users and 127 refresh tokens. 21 real HTTP endpoints passed with 200 OK. Independent review concluded with PASS WITH FINDINGS (code and runtime accepted).
- **Reference**: `docs/exec-plans/completed/crm-showcase-simulator.md`, `docs/exec-plans/completed/crm-showcase-simulator/local-owner-evidence.md`, `docs/exec-plans/completed/crm-showcase-simulator/backend-operator-guide.md`.

### 13. Mercado Pago Payment Gateway Processing (Resolved: 2026-10-22)
- **Context**: The repository lacked real online payment processing; checkout created pending order intents only, with no gateway integration, no webhook verification, and no automated reconciliation.
- **Resolution**: Delivered end-to-end Mercado Pago Card Payments using Card Payment Brick (`@mercadopago/sdk-react@1.0.7`) and the backend Orders API (`processing_mode: automatic`) across chained branches (`feat/mp-1-backend-base` through `feat/mp-7-closure`). Features include: server-authoritative pricing and stock deduction at card submit; sequential attempts per order; 10-minute retry window on rejection; public HMAC-signed webhook receiver with durable inbox; scheduled `@nestjs/schedule` background workers for expiry, reconciliation, and risk sweeps; admin sales lifecycle guards blocking manual overrides; quarantined risk alerts feed; and UNKNOWN resolution flow. Verified against live Mercado Pago Orders API sandbox with test cards, Cloudflare tunnel webhooks, and Playwright.
- **Reference**: `docs/exec-plans/completed/mercadopago-card-payments.md`, `docs/references/prds/entrenar-mercadopago-payment-prd.md`, `docs/design-docs/2026-10-21-mercadopago-card-payments.md`, `docs/references/operations/mercadopago-runbook.md`.
