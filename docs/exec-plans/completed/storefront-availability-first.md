# Storefront availability-first listings

## Objective
Order matching public products by purchasability before pagination; render depleted cards with a native disabled `Sin stock` action.

## Context
The catalog query service already filters and sorts the full backend result before paging. Public stock is projected from variants. ProductCard uses ProductBuyButton and the existing product-discovery availability selector. Sources: catalog-public-api specification, ARCHITECTURE.md and docs/FRONTEND.md.

## Scope & Non-Goals
Preserve filters, facets, canonical ID ties, existing secondary sorts, detail links, discount/shipping badges and inventory semantics. No schema, migrations, stock writes, seed, frontend fetch-all sorting or generic query engine. Preserve unrelated working-tree changes.

## Execution Plan
1. Prepend existential variant availability to the existing backend comparator; ensure public projection ignores out-of-stock quantities.
2. Reuse the frontend selector and Button primitive for depleted actions and subtle card styling.
3. Update authoritative behavior and focused pagination, mapper and rendering regressions, plus prior E2E badge expectations.
4. Run isolated unit/harness checks, frontend acceptance/type/lint/build and read-only isolated browser verification when runtime is fresh.
5. Resolve review build finding: diagnose sanitized fetch exception metadata, preserve Next.js rendering control flow without hiding runtime API failures, add regression coverage and verify production build with no competing owned frontend process.

## Decisions & Rationale
Keep the existing backend in-memory query mechanism, not a new architecture. Availability means any INFINITE variant or TRACKED variant with positive quantity; OUT_OF_STOCK is never available. Within each group retain the existing comparator unchanged. Summaries consume the backend numeric projection; details use variants.

## Progress Tracking
- [x] Inspect sources and create plan before implementation.
- [x] Backend ordering/projection and regression tests.
- [x] Card/action behavior and regression tests.
- [x] Documentation and validation evidence.
- [x] Review production-build finding diagnosed, fixed and revalidated.

## Validation
- Focused catalog unit suites: 3 suites / 29 tests passed, including stable ID ties (initial invalid array query fixture corrected to the transport's comma-separated string).
- `npm run verify:frontend-acceptance`: all 16 harnesses passed, including card rendering and multi-variant/infinite discovery.
- `npx tsc --noEmit`: passed after correcting a fixture's excess-property type check.
- Focused ESLint on both modified components, card harness and E2E: passed.
- `npm run build:backend`: passed. Rebuilt backend was restarted exclusively through the existing signature-checked manual launcher.
- `npx playwright test --config tests/e2e/crm-showcase.config.ts`: 1 passed. Synthetic in-memory fixture only; no database imports or writes. Manual owned processes were stopped to avoid competing Next dev locks, then restored successfully.
- Isolated browser context, fresh runtime localhost:3300 / backend:3228: all 649 rows traversed for each of five sorts, 307 available consistently precede 342 depleted; desktop 1440 and mobile 390 depleted cards have one disabled button, no quick-buy trigger, actual R2 image loaded at natural width 1024, retained detail navigation, no page errors. Card hover transform/shadow unchanged. Measured button contrast 8.32:1 and opacity 1. Browser evidence caught conflicting primitive text classes; fixed using disabled-state classes before final verification.
- Initial `npm run build` failed with `The catalog API is unavailable`. Follow-up sanitized diagnostic (only exception name/digest/code; temporary logging removed) proved the caught error was Next.js `DYNAMIC_SERVER_USAGE`, not an unreachable backend. The no-store fetch's request-time rendering signal was swallowed first by the transport catch and then by repository error normalization.
- Added `unstable_rethrow(error)` from `next/navigation` at the transport and repository normalization boundaries, following current Next.js documentation. Home's real error behavior and uncached reads remain unchanged; no empty-array error fallback or forced route override was introduced.
- `npx tsx tests/harnesses/catalog-render-control-flow.harness.ts`: passed. Synthetic framework signals propagate by identity through transport and all five public read paths; real network failures still produce `CATALOG_API_UNAVAILABLE` and repository error status.
- Final `npm run verify:frontend-acceptance`: 16/16 passed. Final scoped ESLint, `npx tsc --noEmit`, and catalog unit suites (29 tests) passed.
- `NEXT_PUBLIC_CATALOG_API_BASE_URL=http://127.0.0.1:3228/api/v1 npm run build`: **passed**, including compilation, TypeScript, all 23 prerendered pages and final optimization. `/` is correctly classified dynamic (`ƒ`). Before building, only the manual launcher's signature-verified owned frontend tree was stopped; backend remained reachable on 3228. Afterward the existing launcher restored both owned processes, with catalog total 649 and home/login/backend all HTTP 200.
- Final isolated-context browser smoke after restart: home rendered 16 product cards; last-page depleted card retained disabled action and `/productos/universal-daily-formula-100-tabs` image link; no page errors. Existing user contexts/cookies were not used.

Tests did not mutate the source database. Browser sessions used isolated storefront contexts, not current user cookies. No commits.

## Implementation Outcome

### Implemented
- **Backend Availability Ordering**: Prepended availability sorting to `CatalogQueryService.comparePublicProducts` prior to pagination across all 5 sorts (`relevance`, `price-asc`, `price-desc`, `name-asc`, `name-desc`). Preserved secondary sort criteria, canonical stable ID tie-breakers, and all filter/facet semantics (search, category, brand, offers).
- **Public Stock Projection**: Updated mapper logic (`toPublicStockNumber`, `aggregateVariantStock`) so `OUT_OF_STOCK` variants project `0` vendible stock regardless of stored quantity, `INFINITE` projects safe integer maximum, and `TRACKED` variants project positive quantity. Multi-variant products evaluate to available if any variant has vendible stock.
- **Card Action & Depleted UI**: Removed separate depleted badge in favor of a single native disabled gray `<Button disabled>` labeled `Sin stock` (`disabled:bg-gray-200 disabled:text-gray-700`, contrast ratio 8.32:1), with no quick-buy trigger, no hover elevation/transform on depleted cards, and preserved readable text.
- **Media & Detail Navigation**: Retained product card image link to `/productos/[slug]` with accessible label. Rendered persisted Cloudflare R2 images with subtle opacity attenuation (`opacity-80`) for depleted cards; SVG visual placeholder fallback preserved.
- **Framework Signal Handling**: Resolved production prerender build blocker by adding `unstable_rethrow(error)` from `next/navigation` in `FetchCatalogApiClient` and `CatalogApiRepository` catch boundaries to propagate Next.js `DYNAMIC_SERVER_USAGE` signals during uncached server-side fetches, avoiding false `CATALOG_API_UNAVAILABLE` errors without introducing empty-array (`[]`) fallbacks.

### Deviations from Design
- **Next.js Prerender Control Flow**: The initial production build caught Next.js internal `DYNAMIC_SERVER_USAGE` errors during static prerendering in the transport catch block. Diagnosed via sanitized error digest and resolved using `unstable_rethrow(error)` from `next/navigation` per official Next.js App Router guidelines, rather than using an empty-array error fallback or modifying route configuration.
- **Card Badge Removal**: Eliminated the redundant depleted badge in favor of the accessible, native disabled "Sin stock" button and subtle image attenuation to prevent visual clutter and maintain clean hierarchy.

### Validation
- **Backend Unit Regressions**: 3 suites / 29 tests passed (`catalog-query.service.spec.ts`, `catalog.mapper.spec.ts`, `public-listing.spec.ts`).
- **Frontend Acceptance Harnesses**: 16/16 harnesses passed (`npm run verify:frontend-acceptance`), including `catalog-render-control-flow.harness.ts`.
- **Static Analysis & Types**: `npx tsc --noEmit` and scoped ESLint passed with 0 errors across all affected components, mappers, repositories, and harnesses.
- **E2E Acceptance**: Playwright in-memory synthetic fixture passed (1 passed).
- **Production Builds**: Backend build (`npm run build:backend`) and frontend production build (`NEXT_PUBLIC_CATALOG_API_BASE_URL=http://127.0.0.1:3228/api/v1 npm run build`) passed with all 23 pages generated and `/` designated dynamic (`ƒ`).
- **Real Browser Verification**: Traversed all 649 catalog items across all 5 sorts on fresh runtime (`localhost:3300` / `localhost:3228`), verifying 307 available products strictly precede 342 depleted products before pagination. Verified mobile (390px) and desktop (1440px) viewports, image detail links, natural width loading, and disabled action contrast (8.32:1).
- **Independent Review**: Independent re-review confirmed PASS with zero remaining blockers (`docs/exec-plans/completed/storefront-availability-first-review.md`).
- **Database Safety**: Zero database writes, zero schema alterations, zero migrations executed.

### Follow-up
None. All functional, architectural, build, and runtime acceptance criteria are satisfied with zero remaining blockers or technical debt.
