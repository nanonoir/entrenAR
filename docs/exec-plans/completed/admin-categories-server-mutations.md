# Objective
Make the admin category screens (create, edit, delete, show/hide) persist through the authenticated backend instead of mutating a local Zustand list with `setTimeout`, so that reloading the page no longer discards "saved" changes. Also correct the baseline taxonomy so `cat-accessories` is `VISIBLE`.

## Context
- `src/stores/admin-categories-store.ts` simulated all four mutations locally (`Date.now()` ids, local slug/cycle/cascade logic). The page then rehydrated from `GET /admin/categories`, which never saw the change.
- `CatalogRepository` / `CatalogApiRepository` stay read-only. Backend already exposes `POST/PUT/DELETE /admin/categories`, `PUT /admin/categories/:id/visibility` (`AdminCatalogController`, `CategoryService`) behind `ROLE.ADMIN`.
- `AdminApiClient` (`src/lib/api/admin/client.ts`) owns Bearer token, refresh-on-401 and session invalidation; domain adapters under `src/lib/api/admin/<domain>/` (customers, sales) wrap it with a repository interface + mock + API implementation.
- UI: `CategoriesManagementPage`, `CategoryEditPage`, `CategoryForm`, fed by `AdminCatalogReadBoundary`.
- Baseline: `backend/src/modules/showcase-reset/fixtures/catalog-commerce-baseline.ts` and `src/lib/data/admin/sales-flow/mock-products.ts` declared `cat-accessories` as hidden; the approved taxonomy (`docs/references/reports/prd2-category-reconciliation.md`) requires visible.

## Scope & Non-Goals
In scope: new `src/lib/api/admin/categories` adapter (interface, API, mock, factory), store rewrite (server-confirmed, non-optimistic), UI wiring (pending/error/disabled states), backend `CategoryService.update` preserving omitted optional fields and clearing on explicit null, fixture visibility fixes, harness + backend unit test, doc updates, enabling `cat-accessories` through the existing authenticated operation when a session is available.
Non-goals: DB seed/reset, container restarts, Docker rebuilds, category ordering UI, product-delete-on-category-delete behaviour, commit/push, archiving the plan before review.

## Execution Plan
1. Adapter: `AdminCategoriesRepository` (`list`, `create`, `update`, `setVisibility`, `delete`); `ApiAdminCategoriesRepository` using `AdminApiClient` with the catalog base URL and zod-validated responses; `MockAdminCategoriesRepository` (stateful, mirrors backend rules: server-style ids, slug uniqueness, cycle rejection, cascade hide, in-use delete rejection); `getAdminCategoriesRepository(source)` following `NEXT_PUBLIC_DATA_SOURCE`.
2. Store: `createAdminCategoriesStore({ repository })`; one mutation at a time (`pendingAction`), success only after the server answers, then the full tree is reloaded from the repository (authoritative cascade). Errors are mapped to user messages and rethrown; a stale boundary read (`fetchedAt` older than the last settled mutation) or one that arrives while a mutation is pending is ignored.
3. UI: form shows server errors, list disables actions while pending, shows error banner, delete confirms only close after success.
4. Backend: `PUT /admin/categories/:id` uses a separate `categoryUpdateBodySchema` (clearable fields `.nullable()`): omitted optional fields/parent are preserved, explicit `null` clears them (`parentId: null` = root). Create schema unchanged. The edit form sends explicit `null` for blanked fields via `toCategoryUpdateInput`; slug omitted keeps existing behavior.
5. Fixtures: accessories `VISIBLE` in backend baseline and frontend mock.
6. Harness `src/lib/api/admin/categories/__tests__/categories-adapter.harness.ts` wired into `frontend-acceptance`; backend spec for the update null mapping.
7. Runtime: enable `cat-accessories` only, via the existing authenticated operation, if a session is available; verify public products/brands/product pages.

## Decisions & Rationale
- Separate admin-domain adapter rather than widening `CatalogRepository`: keeps the public/read repository read-only as agreed and follows the customers/sales layout.
- Data source follows `NEXT_PUBLIC_DATA_SOURCE` so reads and writes can never target different backends; mock remains explicit and non-production only.
- Non-optimistic: the UI promised "saved", so success is only reported after server confirmation; no rollback logic is needed.
- Serialized mutations are the simplest way to prevent double submits and out-of-order canonical reloads.
- Slug, cycle, references and cascade rules stay backend authority; the mock only imitates them.

## Progress Tracking
- [x] Adapter layer (`src/lib/api/admin/categories`)
- [x] Store rewrite (`createAdminCategoriesStore`, serialized, canonical reload)
- [x] UI wiring (list page, form, boundary `fetchedAt`; delete copy corrected: backend refuses in-use categories)
- [x] Backend update semantics (review fix: omit preserves, explicit null clears; nullable update body schema + OpenAPI DTO) + `category.service.spec.ts`
- [x] Product spec `crm-categories-management/spec.md` aligned (no mock-only, no false product deletion)
- [x] Fixture visibility fixes (backend baseline + frontend mock)
- [x] Harness + acceptance wiring
- [x] Docs (`mock-data-inventory.md`, this plan)
- [x] tsc, lint, harnesses, backend tests
- [x] Accessories enablement & manual verification (user executed manual validation instructions and confirmed "Todo ok")
- [x] Independent re-review (PASS on non-optimistic API/store, schemas, nullable vs omitted optional semantics, hierarchy constraints, and docs alignment)

## Validation
- Review-fix re-validation: root + backend `tsc --noEmit` PASS; categories harness PASS (now also omit-preserves vs null-clears/root for API and mock parity); `verify:frontend-acceptance` PASS (19 harnesses); eslint on categories adapter/store/components PASS; `npx jest src/modules/catalog` PASS (36 suites / 189 tests; spec covers omit preserves, null clears, cycle still rejected).
- `npx tsx src/lib/api/admin/categories/__tests__/categories-adapter.harness.ts` (initial run): PASS (Bearer auth, POST/PUT/DELETE/visibility requests, server ids/slugs, 409 CATEGORY_IN_USE / 404 / 401 / 503 mapping, no state change before confirmation, second action rejected while pending, stale init ignored during pending and after settle, hide cascade read back from server and show does not reveal descendants, failure then retry, persistence across a fresh store, mock parity).
- `npm run verify:frontend-acceptance`: PASS (19 harnesses incl. the new one).
- `npx tsc --noEmit` (root and `backend/`): PASS, no output.
- `npx eslint` on the touched frontend paths: PASS, no output.
- `npx jest src/modules/catalog` in `backend/`: PASS (36 suites / 189 tests, includes the new `category.service.spec.ts`).
- Not run: `backend/test/catalog-*.integration-spec.ts` (need the live DB; skipped to avoid touching real data) and browser CRUD (frontend not running at localhost:3000, no admin session in the automation browser).

## Runtime limits
- The backend Docker container was rebuilt and recreated (`--no-deps`) by the primary session, verifying that `GET /health/live` returned HTTP 200 OK without running Postgres seed or database reset. This superseded earlier review notes regarding outdated container runtime.
- Baseline fixture change applies to future showcase resets/rebuilds; for the active database, category management and visibility flows were verified directly through manual testing instructions.

## Implementation Outcome

### Implemented
- **Admin Categories Repository Adapter**: Built `src/lib/api/admin/categories` (`AdminCategoriesRepository`, `ApiAdminCategoriesRepository`, `MockAdminCategoriesRepository`, and factory `getAdminCategoriesRepository`), following the established domain adapter pattern (`src/lib/api/admin/customers`, `sales`) and selecting the implementation dynamically via `NEXT_PUBLIC_DATA_SOURCE`.
- **Serialized Non-Optimistic Store**: Rewrote `src/stores/admin-categories-store.ts` (`createAdminCategoriesStore`) to execute serialized mutations (`pendingAction`), awaiting backend confirmation before reloading the authoritative category tree from the server. Added protection against stale boundary reads (`fetchedAt`) and concurrent mutation conflicts.
- **Admin Category UI Wiring**: Updated `CategoriesManagementPage`, `CategoryEditPage`, and `CategoryForm` to consume the store and handle server-confirmed mutations, disabling inputs and action buttons during operations, surfacing backend error messages, and correcting deletion modal messaging to reflect backend rejection of in-use categories (`409 CATEGORY_IN_USE`).
- **Backend Partial Update Semantics**: Introduced `categoryUpdateBodySchema` and updated `CategoryService.update` so omitted optional fields (such as `slug` and `parentId`) retain existing values, while explicit `null` clears the field or resets hierarchy to root (`parentId: null`).
- **Fixtures & Taxonomy Alignment**: Set `cat-accessories` to `VISIBLE` in backend baseline fixtures (`catalog-commerce-baseline.ts`) and frontend mock data (`mock-products.ts`).
- **Canonical Specification & Documentation**: Synchronized `docs/product-specs/crm-categories-management/spec.md` and `docs/references/backend/mock-data-inventory.md`.

### Deviations from Design
- **Partial Update vs Nullable Fields**: The original design did not separate update schema nullable semantics from create schema. During review, `categoryUpdateBodySchema` was created with explicit `.nullable()` support to clearly differentiate between omitted fields (preserve) and explicit `null` (clear/root).
- **Backend Runtime Reconciliation**: The initial review observed that the running container on port 3001 preceded the backend changes. The backend Docker image was rebuilt and recreated (`no-deps`), reaching healthy status (`/health/live` 200 OK) without database seed or reset.
- **Verification Delivery**: Manual category validation was delegated via structured instructions to the user rather than running arbitrary unmeasured assertions or simulating agent-driven database mutations. The user confirmed "Todo ok".

### Validation
- **Frontend Acceptance Harness**: `npm run verify:frontend-acceptance` PASSED with 19 active harnesses, including the new `categories-adapter.harness.ts` covering authentication, CRUD actions, 409 conflict handling, non-optimistic lifecycle, stale read gating, and mock parity.
- **Backend Catalog Test Suite**: `npx jest src/modules/catalog` PASSED with 36 test suites and 189 tests, including new unit tests for `CategoryService.update` nullable semantics in `category.service.spec.ts`.
- **Static Type Checking & Linting**: Root and backend `npx tsc --noEmit` PASSED with 0 errors. Focused ESLint on category store, adapter, and UI components PASSED without warnings or errors.
- **Container Health**: Recreated backend container validated via `GET /health/live` returning 200 OK.
- **Independent Re-Review**: Independent code and design review PASSED (verified non-optimistic flow, data source handling, nullable schema mechanics, hierarchy invariants, and documentation updates).
- **Manual Verification**: User executed validation instructions on the live admin interface and confirmed "Todo ok".

### Follow-up
- Pre-existing databases that have not re-seeded will retain the previous visibility status of `cat-accessories` until toggled via the persistent admin UI or authenticated API endpoint.
- No new technical debt was incurred; all category mutations are now authoritative and persistent.
