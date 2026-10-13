# Reconnect the administrative product list

## Objective
Restore the implemented product list at `/admin/productos` after session bootstrap and redirect `/admin/productos/listado` to that canonical route.

## Context
`ProductListClient` is implemented but the canonical route renders a placeholder. `AdminCatalogReadBoundary` already loads protected catalog data after `AdminBootstrapBoundary`. References: [CRM products design](../../design-docs/2026-09-24-crm-products.md) and [current architecture](../../../ARCHITECTURE.md), especially authentication and transport. The historical mock/SSR design is superseded by the current authenticated adapter boundary.

## Scope & Non-Goals
Reconnect the existing UI, fetch all catalog pages and categories through existing admin adapters, preserve loading/error conventions, and add route regression coverage. No redesign, mock production data, authentication bypass, data writes, server restart, configuration changes, or commits. Existing user browser sessions remain untouched.

## Execution Plan
1. Add list mode to the catalog boundary and connect the canonical page.
2. Add a static listado redirect so it cannot resolve as a product ID.
3. Tighten regression guards and run focused harness, type and lint checks.
4. Verify with an isolated browser context where safely possible; document any live-auth limitation.

## Decisions & Rationale
Reuse `getAdminProducts()` (complete paginated, authenticated catalog) and `getAdminCategories()`. Retain existing table/search/filter behavior, including its all-rows display rather than inventing UI pagination.

## Progress Tracking
- [x] Boundary and routes connected.
- [x] Regression guards and focused validation completed.
- [x] Browser evidence or limitations recorded.

## Validation
Executed successfully: `npm run verify:frontend-acceptance` (16 harnesses), `npx tsc --noEmit`, and scoped ESLint for the boundary, both routes and the changed admin boundary harness. Regression guards explicitly reject the canonical placeholder and require list mode, product/category loading, existing list client rendering and static alias redirect.

Initial isolated unauthenticated checks: frontend port 3300 cloaked both product routes with 404; protected backend port 3228 returned 401 without a token.

Follow-up live smoke (2026-10-09) used a separate headless Chromium browser/context, closed in `finally`, against the retained frontend 3300/backend 3228. The approved private manual launcher was inspected for its environment source. A read-only database query selected only the ID of an existing ADMIN. The backend environment supplied an in-memory five-minute JWT, confirmed by a real protected auth probe (200). The frontend gate cookie was created with the repository's `createAdminGate` function and the approved signing secret. Only `/api/admin-session/refresh` was intercepted inside the isolated test context to supply a synthetic session containing that valid JWT. Catalog requests were not mocked: they reached the real protected backend with authorization. All non-GET `/api/v1/*` requests were blocked defensively; none were attempted. This verifies synthetic bootstrap authentication with real protected data, not credential login or real refresh-token persistence.

Observed assertions:
- Canonical table: 649 desktop rows, no placeholder, no page errors before alias navigation.
- Real paginated product reads: pages 1–7 returned 200; pages 1–6 contained 100 products each and page 7 contained 49, with declared total 649. Development effects issued duplicate reads; the displayed total remained 649.
- Searching the first displayed SKU reduced the table to one row; an unmatched query produced zero rows and the existing empty state; clearing restored 649.
- Applying the existing `Sin stock` radio filter using `Filtrar` produced 342 rows, all with the `Sin stock` label.
- The static alias returned a streaming HTML response (200 containing the canonical `NEXT_REDIRECT`, rather than a Location header after streaming). Browser navigation ended at `/admin/productos` and rendered 649 rows, not the dynamic edit route.
- A development Performance instrumentation exception occurred during alias navigation: `ProductListAliasPage cannot have a negative time stamp`. It did not prevent the redirect or table rendering. This is recorded as a runtime caveat, not silently counted as an error-free alias run; no production framework changes were made for it.

Private screenshots: `C:/Users/Nahuel/AppData/Local/Temp/opencode/admin-products-canonical.png` and `admin-products-filtered.png`. The private helper `admin-products-smoke.cjs` contains no persisted tokens/secrets or row exports. Existing user cookies/sessions were never read or changed; no database writes, config edits, credential login, token persistence, runtime restarts or server stops occurred. The database connection, isolated browser and context were closed after each attempt. Real login/refresh lifecycle validation remains outside this focused smoke scope.

## Implementation Outcome

### Implemented
- Connected the canonical `/admin/productos` route to `AdminCatalogReadBoundary` in `mode="list"`, rendering the existing `ProductListClient` with authenticated catalog products and categories fetched via `getCatalogRepository()`.
- Added the static route `/admin/productos/listado` that performs a clean Next.js `redirect("/admin/productos")` to ensure alias requests do not resolve as dynamic `[id]` product detail pages.
- Extended `tests/harnesses/admin-mock-boundary.harness.ts` with regression guards that enforce `mode="list"` wiring, category/product fetching, list client rendering, and prevent placeholder regressions.
- Preserved existing full-catalog fetching semantics, table rendering, search, filtering, and error fallback conventions without SSR security bypasses, schema modifications, or mock production fallbacks.

### Deviations from Design
None. The implementation follows the boundary architecture and preserves the existing client components and transport layers as intended.

### Validation
- **Static & Harness Verification**: Passed all 16 frontend acceptance harnesses (`npm run verify:frontend-acceptance`), TypeScript compiler check (`npx tsc --noEmit`), and scoped ESLint checks. Git diff verified minimal and targeted.
- **Runtime Pre-Auth Verification**: Confirmed frontend port 3300 cloaks protected product routes (404) and backend port 3228 rejects unauthenticated requests (401).
- **Isolated Live Smoke (Synthetic Auth & Real Catalog)**:
  - Executed in a dedicated headless Chromium context without modifying existing browser sessions, credentials, or writing to the database.
  - Used an in-memory 5-minute JWT for an existing ADMIN user, signed gate cookie via `createAdminGate`, and an isolated test intercept on `/api/admin-session/refresh`.
  - Protected backend requests succeeded: pages 1–7 loaded (100 * 6 + 49 = 649 items, total 649) with 200 OK.
  - UI verified: 649 rows rendered in the canonical table.
  - Search verified: first SKU search filtered to 1 row; unmatched query returned 0 rows and empty state; clear restored all 649 rows.
  - Filter verified: `Sin stock` filter produced 342 rows with matching badges.
  - Alias verified: `/admin/productos/listado` redirected to `/admin/productos`, rendering all 649 rows.
  - Runtime caveat noted: Non-blocking development Performance instrumentation exception (`ProductListAliasPage cannot have a negative time stamp`) observed during alias navigation; no production framework changes were made.

### Follow-up
Full credential login and persistent refresh token rotation lifecycle remain part of broader end-to-end CRM auth suites, outside this isolated list reconnection scope.
