# ExecPlan: Admin Panel Correction Flow

## Objective

Fix the blockers, honesty gaps and usability problems found in the admin audit: sales/customers contract failures, `/admin/envios` 500, unusable inventory at 649 products, fixture-backed statistics, customers showing 0 purchases, long hash identifiers, a dead `Configuración` link and spurious unsaved-changes prompts.

## Context

- Admin tokens live in memory only and admin reads run post-bootstrap (see [`2026-09-22-admin-auth-isolation-route-protection-branded-error-system.md`](../../design-docs/2026-09-22-admin-auth-isolation-route-protection-branded-error-system.md)).
- Technical decisions for this plan: [`2026-10-15-admin-correction-flow.md`](../../design-docs/2026-10-15-admin-correction-flow.md).
- Specs touched: `admin-sales-frontend-adapters`, `admin-customers-frontend-adapters`, `admin-statistics-ui-integration`, `admin-navigation`, `admin-dirty-state-guard`, `admin-shipping-tracking`.
- Parallel work on public/commercial copy is owned by another agent and is out of scope.

## Scope & Non-Goals

In scope: admin UI, admin adapters/stores/tests, admin docs, admin copy, and the single backend change needed so the customer list carries `summary`.

Out of scope: storefront, contact, footer, account, checkout; commercial data and the demo seed; a Configuración module; a visits/traffic tracking source; server-side pagination for inventory and products; `/admin/productos` pagination.

## Execution Plan

1. Stage 1 – blockers: strict-but-correct sales summary schema (`customerId`), single safe decode of customer route ids, envíos pages as client components using `useAdminSalesStore`.
2. Stage 2 – inventory: client-side search, stock/category filters and pagination with URL state.
3. Stage 3 – data: customer list `summary` from backend, statistics without fixture fallbacks, honest visits state, capped out-of-stock list with unique keys, short reference + copy for opaque ids.
4. Stage 4 – navigation/forms: remove the `#configuracion` entry, derive the dirty state from normalized values, keep number formats via `es-AR` formatters.
5. Docs and validation.

## Decisions & Rationale

- Envíos become client components: server components cannot hold the in-memory admin token.
- `customerId` is added as optional on the summary schema only; the schemas stay `.strict()`.
- Inventory keeps the full catalog load because inline stock edits depend on the store; server pagination is recorded as a limitation (see design doc and tech debt tracker).
- Customers showed 0 purchases because `GET /admin/customers` omitted `summary`, so the UI fell back to computing it from the sales store (empty or without `customerId`). The backend now returns `summary` on list items.
- Visits have no data source, so the pages state that instead of showing fixtures.
- `Configuración` has no destination; the entry is removed rather than shown as dead.

## Progress Tracking

- [x] Stage 1: sales schema/mapper + harness
- [x] Stage 1: customers route-id decode + harness
- [x] Stage 1: envíos as client components
- [x] Stage 2: inventory search/filters/pagination + harness
- [x] Stage 3: customer list summary (backend + tests)
- [x] Stage 3: statistics without fixtures, visits unavailable, capped alerts
- [x] Stage 3: short reference + copy
- [x] Stage 4: Configuración removed, dirty-state fix + harness
- [x] Docs: design doc, specs, indices
- [x] Authenticated browser verification (completed by independent reviewer: ventas detail/edit no 404, clientes compras summary runtime verified, envíos, inventario filters, mobile 375px no overflow)
- [x] Independent review (PASS on independent re-review ses_ec1c1d244ffehCXwjlGtDUaatG)

## Validation

- `npx tsc --noEmit` (root) – clean (0 errors).
- Backend TypeScript: `npx tsc --noEmit -p tsconfig.json` – clean (0 errors).
- `npm run build` and `npm run build:backend` – passed.
- `npm run verify:frontend-acceptance` – passed (18 harnesses).
- Backend customer test suite: `npx jest customers` – 7 suites, 51 tests passed.
- Unit/acceptance harnesses: `npx tsx` harnesses for sales adapter, customers adapter, inventory view, admin form helpers passed.
- Route cloaking: Unauthenticated `curl` of `/admin/envios` and `/admin/estadisticas/visitas` returns 404 (route cloaking), not 500.
- Docker runtime recreation: Completed by primary session (`docker compose build backend`, image `be40a1561cae`, followed by `docker compose up -d --no-deps backend`). Live readiness check `GET http://localhost:3001/api/v1/health/live` returned 200 OK healthy. Postgres container and persistent database volume (`postgres/data`) remained intact.
- Global linting: Touched files are 100% clean; note that ESLint reports 2 pre-existing errors in `backend/src/modules/catalog-cutover/catalog-cutover.spec.ts` (belonging to separate catalog cutover track), so repository lint is not declared fully clean.
- Authenticated browser verification (Independent Review ses_ec1c1d244ffehCXwjlGtDUaatG):
  - Ventas detail and edit views (`/admin/ventas/[id]`, `/admin/ventas/[id]/editar`) correctly decode route params (including `crm-showcase:...`), loading without 404.
  - Clientes list and detail render real purchase summary (`summary` paid, non-cancelled orders) correctly at runtime without fallback to 0.
  - Envíos tracking list and detail load resiliently post-bootstrap via client store.
  - Inventario search, stock/category filters and URL pagination (25 items/page) work properly, and mobile 375px viewport renders without horizontal overflow.

## Review Remediation (admin review FAIL -> PASS)

- Sales detail/edit routes (`src/app/(admin)/admin/ventas/[id]/page.tsx`, `editar/page.tsx`) now decode the raw `params.id` once with `decodeRouteParam` before the store/repository, fixing `crm-showcase%3A…` being re-encoded to `%253A` (404). `ventas/ordenes/[id]` was not changed (no evidence of the same defect). Regression check added to `src/stores/__tests__/admin-sales-store.harness.ts` (decode-once + both routes use `decodeRouteParam(rawId)`).
- `CustomerResponseDto` in `backend/src/modules/customers/dto/customers-openapi.dto.ts` declared optional `summary` (`CustomerSalesSummaryDto`), matching the mapper and Swagger documentation; `CustomerDetailResponseDto` keeps it required via `override`.
- Runtime finding: `docker-compose.yml` backend service has no volume mounts and builds `backend/Dockerfile` (runs `dist` baked into the image), so host `backend/dist` is NOT used by port 3001. Backend Docker image was rebuilt (`docker compose build backend`, image `be40a1561cae`) and recreated by primary session (`docker compose up -d --no-deps backend`), achieving healthy status on `GET /api/v1/health/live` without touching Postgres data volume.
- Validation re-run: Root `tsc` clean, backend `tsc` clean, backend customer tests (7 suites, 51 tests) passed, 18 acceptance harnesses passed.
- Independent re-review `ses_ec1c1d244ffehCXwjlGtDUaatG` passed.

## Implementation Outcome

### Implemented

1. **Sales & Customers Contracts**:
   - `salesSummarySchema` widened strictly for optional `customerId` without opening schemas to unknown fields.
   - Sales detail and edit routes (`/admin/ventas/[id]`, `/admin/ventas/[id]/editar`) decode route params exactly once using `decodeRouteParam` before store/repository invocation, eliminating 404s on encoded showcase IDs (`crm-showcase%3A...`).
   - Customer route params decode safely once; `CustomerResponseDto` in backend OpenAPI/Swagger aligned with optional `summary` (`CustomerSalesSummaryDto`) while `CustomerDetailResponseDto` enforces required summary.
   - Backend `CustomersService.listCustomers` includes authoritative `summary` calculated from paid, non-cancelled orders.

2. **Shipping (Envíos)**:
   - `/admin/envios` and `/admin/envios/detalle/[envioId]` migrated to client components (`ShipmentTrackingPageClient`, `ShipmentDetailPageClient`) backed by `useAdminSalesStore`, ensuring authenticated post-bootstrap reads without violating the in-memory token boundary.

3. **Inventory UX & URL State**:
   - Client-side search, stock status filtering, category filtering, and 25-item pagination implemented in `inventory-view.ts` and `/admin/inventario`.
   - URL query parameters (`page`, `q`, `stock`, `categoria`) synchronized via `history.replaceState`.
   - Mobile responsive layout verified at 375px viewport with zero horizontal overflow.

4. **Statistics & Data Honesty**:
   - Eliminated fixture-backed fallbacks in statistics views; views display authentic loading, controlled retryable error, or empty states.
   - Explicitly presented unavailable status for metrics lacking a tracking source (site visits, traffic, session duration).
   - Out-of-stock inventory alerts capped at 10 items with real totals, `+N más` indicator, and unique item-id keys.
   - Opaque IDs formatted using `shortReference` (first 6 + last 4 characters) paired with a `CopyReference` button.

5. **Navigation & Form Cleanliness**:
   - Removed dead `#configuracion` link from admin sidebar navigation.
   - Normalized empty-equivalent values (`""`, `null`, `undefined`, `NaN`) in `hasFormChanges` to prevent false unsaved-changes dirty state prompts on untouched forms.

### Deviations from Design

None. Implementation follows the architecture and decisions in `docs/design-docs/2026-10-15-admin-correction-flow.md`. Review findings were remediated during execution (single-decode route param in sales routes and OpenAPI DTO summary alignment).

### Validation

- Root TypeScript: `npx tsc --noEmit` — 0 errors.
- Backend TypeScript: `npx tsc --noEmit -p tsconfig.json` — 0 errors.
- Production builds: `npm run build` and `npm run build:backend` — passed successfully.
- Frontend acceptance harness: `npm run verify:frontend-acceptance` — 18/18 harnesses passed.
- Backend customer test suite: `npx jest customers` — 7 suites, 51 tests passed.
- Global lint: Touched files are 100% clean; 2 pre-existing external errors in `backend/src/modules/catalog-cutover/catalog-cutover.spec.ts` (catalog cutover track) noted, so global lint is not declared fully clean.
- Docker runtime recreation: Backend Docker image rebuilt (`docker compose build backend`, image `be40a1561cae`) and container recreated (`docker compose up -d --no-deps backend`); live health check `GET http://localhost:3001/api/v1/health/live` returned 200 OK healthy; Postgres data volume intact.
- Independent Review: PASS on re-review `ses_ec1c1d244ffehCXwjlGtDUaatG` with full authenticated browser verification:
  - Ventas detail and edit views load without 404 on encoded showcase IDs.
  - Clientes purchase summary loads and computes correctly from backend runtime data.
  - Envíos and Inventario filters render and paginate cleanly without DOM or layout overflow down to 375px mobile viewports.

### Follow-up

- **Inventory Full Catalog Client-Side Load**: Tracked as active technical debt item #8 in `docs/exec-plans/tech-debt-tracker.md`. The inventory page continues to fetch the entire catalog (649 items) to support synchronous client filtering and optimistic inline stock updates. Server-side pagination remains a candidate for future scaling if catalog size expands significantly.
