# Tasks: Catalog Listing and Taxonomy Alignment

## Work Unit Plan
| Unit | Goal | Tasks | Estimated Code Additions | Focused Test | Runtime Harness | Rollback Boundary |
|---|---|---|---:|---|---|---|
| 1 | Complete public catalog query/API | 1.1-1.4 | ~360 | `npm run test:backend -- --runInBand` (catalog unit specs) | Mocked Nest/Jest; 15s requests | Catalog listing module/API files |
| 2 | Complete frontend catalog adapters and route mapping | 2.1-2.4 | ~350 | `npm run verify:frontend-acceptance` | Adapter and route harnesses | Listed adapter/lib/type roots |
| 3 | Canonical brand directory and navigation | 3.1-3.3 | ~180 | `npm run verify:frontend-acceptance` | Brand directory/alias route checks | Brand directory component and harness |
| 4 | Paginated, truthful listing experience | 4.1-4.4 | ~576 observed | `npm run lint` + focused harness | Listing page/shell; 30s browser | Catch-all page, listing shell, and UI harness |
| 5 | Active taxonomy overlay and sync selection | 5.1-5.3 | ~280 | `npm run test:backend -- --runInBand` (scraper specs) | Mocked normalization/sync | Active taxonomy and run preparation files |
| 6 | Safe, recoverable authorized local consolidation | 6.1-6.4 | ~390 | Mocked operation Jest specs | Existing local DB only; diagnostics 60s | Operation module + private backup evidence; reverse only evidenced merge |
| 7 | Full-catalog acceptance and invariant evidence | 7.1-7.3 | ~300 | `npm run build:all` (180s) + targeted harnesses | Playwright 30s; read-only except approved merge | E2E/harness tests and evidence only |
| 8 | Repair advertised category and brand navigation | 8.1-8.3 | ~180 | Existing route/brand harnesses | Playwright published-link regression matrix; 30s browser | `product-listing.ts` and named route/brand/acceptance tests only |

## Architecture Risk Forecast
| Field | Value |
|---|---|
| New responsibilities added to existing modules | Medium |
| Cross-module/layer changes | High |
| Existing structurally overloaded modules touched | Yes — catalog catch-all route |
| Existing abstractions to reuse | `CatalogReadResult`, `ZodValidationPipe`, catalog mapper/repositories, `ProductGrid`, existing filters/drawers/`Button`, active run preparation and bounded Prisma reads |
| Local extraction/refactor required | Yes — cohesive public listing predicates/metadata and active-taxonomy overlay |

Architecture decision needed before apply: No

## Work Unit 1: Complete public catalog query/API
Apply roots: `backend/src/modules/catalog/`; catalog Jest specs under `backend/src/modules/catalog/`. Skill domains: NestJS/TypeScript, Zod, Prisma read boundaries.
- [x] 1.1 Add RED Jest cases for beyond-page-one results, unique totals/facets, empty versus controlled failure, filters/sorts, and public detail slug/NOT_FOUND.
- [x] 1.2 Create `public-listing.ts` for eligibility, canonical predicates, scope-wide unique metadata, and brand slugs; reuse bounded complete catalog reads, without transport/Prisma ownership.
- [x] 1.3 Extend schemas, query orchestration, controller/OpenAPI DTOs for validated filters, stable sorts, `totalPages`, facets/bounds, and `/brands`; preserve query compatibility and limit ≤100.
- [x] 1.4 Verify complete-scope totals/facets, controlled errors, and offers condition `compareAtPrice > price`.

## Work Unit 2: Complete frontend catalog adapters and route mapping
Apply roots: `src/lib/api/catalog/{catalog.repository.ts,catalog-api.repository.ts,mock-catalog.repository.ts,catalog-adapter.harness.ts}`; `src/lib/{product-listing.ts,category-membership.ts}`; `src/lib/data/{shop-routes.ts,navigation.ts}`; `src/types/{navigation.ts,product-listing.ts}`; `tests/harnesses/prd2-catalog-routes.harness.ts`. Skill domains: Next.js, TypeScript.
- [x] 2.1 Add RED harness cases for canonical and legacy-only memberships, complete paging, empty/error distinction, and duplicate prevention.
- [x] 2.2 Extend API/mock repositories and mapping for bounded pages, totals, facets, bounds, and brands; frontend remains non-authoritative.
- [x] 2.3 Make every PUBLIC category resolve regardless of count, including Performance/Control de peso; canonical memberships precede explicit legacy fallback. Normalize only unambiguous known aliases and permanently redirect both obsolete shaker URLs to `/shakers`, preserving queries.
- [x] 2.4 Make touched admin array consumers traverse all validated bounded pages or fail, never imply partial completeness.

## Work Unit 3: Canonical brand directory and navigation
Apply roots: `src/components/shop/products/listing/BrandDirectory.tsx` (new); `tests/harnesses/catalog-brand-navigation.harness.ts`. Skill domains: React, TypeScript, Tailwind.
- [x] 3.1 Add RED cases for directory loading/populated/empty/error states and canonical links.
- [x] 3.2 Implement `/marcas` presentation from eligible backend brand entries using storefront hierarchy; no fabricated data or CRUD.
- [x] 3.3 Verify canonical links and unknown-brand not-found; brand listing reuses Work Unit 4's paginated route.

## Work Unit 4: Paginated, truthful listing experience
Apply roots: `src/app/(shop)/[...segments]/page.tsx`; `src/components/shop/products/listing/ProductListingShell.tsx`; `tests/harnesses/catalog-listing-ui.harness.ts`. Skill domains: Next.js, React, TypeScript, Tailwind.
- [x] 4.1 Add cases for populated, valid-empty, filtered no-match, controlled-error, and pagination query retention/reset.
- [x] 4.2 Update catch-all flow to render Work Unit 3 directory at `/marcas` and use server totals/facets/pages; no client fetching or duplicate reads.
- [x] 4.3 Reuse established filters/drawers/`ProductGrid`/`Button`; retain filters/sort on pagination, reset page on filter/sort/clear, and separate errors from empty results.
- [x] 4.4 Check responsive layout, 4-column large/2-column mobile grid, accessible focus/touch, pagination boundaries, and no overflow.

## Work Unit 5: Active taxonomy overlay and sync selection
Apply roots: `backend/src/modules/catalog-scraper/active-taxonomy.ts`; `backend/src/modules/catalog-scraper/run/prepare-run.ts`; `backend/src/modules/catalog-scraper/category-sync.command.ts`; mocked scraper specs under `backend/src/modules/catalog-scraper/`. Skill domains: NestJS/TypeScript, Prisma boundaries.
- [x] 5.1 Add RED mocked cases mapping obsolete shaker memberships to root without resurrection.
- [x] 5.2 Create active overlay and select it for preparation/editable sync; retain source URLs and explicit many-to-one mapping.
- [x] 5.3 Keep historical 61-category loader, frozen artifacts/receipts, and frozen bound sync unchanged; active taxonomy has 60 categories.

## Work Unit 6: Safe, recoverable authorized local consolidation
Apply roots: `backend/src/modules/catalog-scraper/operations/shaker-consolidation.ts`; its mocked unit spec under `backend/src/modules/catalog-scraper/operations/`; private ignored `backend/backup/` evidence only. Skill domains: TypeScript, Prisma transaction/integration safety.
- [x] 6.1 Add mocked RED cases for missing prerequisites, drift/unknown references, rollback, idempotence, and conflict-safe recovery; no destructive test DB.
- [x] 6.2 Identify configured existing local `entrenar` target/schema/fingerprint; audit 19-root/23-obsolete baseline, duplicates, and child/ProductCategory/CouponCategory/ShippingDiscountCategory references; stop on drift/unknown references.
- [x] 6.3 Create/read-back validate new private backup (never overwrite) with original rows/timestamps/links, four additions, target/invariant hashes. Under finite table/row locks, transactionally re-audit; add four/remove 23/delete one; support rollback, no-op rerun, evidence-limited recovery.
- [x] 6.4 After audit and validated backup only, run the single approved merge on the existing local DB. Verify 60 categories/2,105 links/23 shakers; preserve 649 products/1,119 variants/3,790 images, IDs, other memberships, prices/stock, admin/config/R2. No new/scratch DB, reimport, reset, or frozen-history edits.

## Work Unit 7: Full-catalog acceptance and invariant evidence
Apply roots: `tests/e2e/catalog-listing.spec.ts`; `tests/harnesses/catalog-listing-acceptance.harness.ts`; `src/` and `backend/` read-only during this unit. Skill domains: Playwright.
- [x] 7.1 Author dynamic public-category acceptance comparing unique eligible totals, page coverage, facets, and memberships against an independent complete reference, including zero-count categories.
- [x] 7.2 Author acceptance for brands (baseline Star Nutrition 51/ENA 67 across pages), offers, both legacy redirects, unknown brand, error versus empty, and desktop/mobile controls; expected totals derive from the current reference.
- [x] 7.3 Implement read-only protected-data integrity/hash comparisons and existing-operation evidence checks; integrate verifier-provided current snapshots without DB writes.

WU7 partial authoring checkpoint: existing-evidence invariant checker authored in `tests/harnesses/catalog-listing-acceptance.harness.ts` (94 gross lines). No runner execution, fresh DB snapshot, or E2E coverage completed. All three tasks remain pending; see cumulative `apply-progress.md`.

Completion checkpoint supersedes the preceding partial authoring note. WU7 implementation is ready (399 gross source lines across both files); all executable acceptance and the original task 7.3 runtime action (run current comparisons/capture fresh evidence) are explicitly owned by `sdd-verify` and remain unexecuted. Checked boxes mean implementation completion, not runtime PASS.

Targeted compilation-correction receipt: all four assigned fixes are present; 25/25 implementation tasks remain complete. Conservative WU2/WU4/WU7 addition budgets now348/568/408 respectively. Affected frontend verification must rerun; historical Stage A backend PASS evidence is preserved. See cumulative apply-progress for scope and stale targets.

Stage B1 canonical nested-category correction implemented in six approved files; original hierarchical navigation URLs remain acceptance targets. Canonical filters/facets and validated parent-child route translation corrected; tests authored only. Cumulative WU1/WU2/WU4/WU7 budgets386/348/576/451. Tasks stay25/25 implementationcomplete; backend republish and affected checks/full60category runtime verification are pending with verify.

## Work Unit 8: Repair advertised category and brand navigation
Apply roots: `src/lib/product-listing.ts`; `src/components/shop/products/listing/ProductListingSort.tsx` (focused accessible label correction); `src/components/shop/cart/CartDrawer.tsx` (closed drawer must not fetch the complete catalog); `tests/harnesses/prd2-catalog-routes.harness.ts`; `tests/harnesses/catalog-brand-navigation.harness.ts`; `tests/harnesses/catalog-listing-ui.harness.ts` (sort label regression); `tests/harnesses/catalog-listing-acceptance.harness.ts`; `tests/e2e/catalog-listing.spec.ts` (real soft pagination and closed-drawer request regression). Skill domains: Next.js, React, TypeScript, Tailwind, build-form, Playwright.
- [x] 8.1 Add RED route/brand/E2E cases for all 14 published nested paths (`/market/{alfajor,barras,endulzantes,enlatado,frutos-secos,hierba-mate,jerky,pastas-de-mani,polvos-mezclas,salsas}`; `/indumentaria/{entreno,shark,symmetry,xbelt}`), four known aliases and canonical targets (balboa-fit→balboafit, framingham→framingham-pharma, notco→not-co, natures-bounty→nature-s-bounty), query preservation, self-loop guard, wrong-parent/unknown 404, and API-unavailable controlled error. Assert actual published URLs directly; do not weaken or game the URL generator.
- [x] 8.2 Fix known route resolution in `product-listing.ts`: serve the correct category scope or permanently 308-redirect each nested path to its already-proven canonical flat target; issue canonical 308 redirects for the four known aliases only after confirming targets exist. Preserve queries; unknown brands/routes remain not-found; failures remain controlled errors.
- [x] 8.3 Complete executable focused acceptance harness coverage plus Playwright navigation matrix; runtime execution of the existing route/brand/acceptance harnesses and navigation matrix is owned by sdd-verify. Keep taxonomy, brand CRUD, auth, schema/cache, database, and visual redesign out of scope.

WU8 implementation28/28 complete;122 conservative additions across3 existing files, independently attributed to WU8 (old WU4~576 unchanged). RED cases are authored, not executed. Original8.3 run requirement remains pending with verify under apply's no-runner contract; checked tasks mean code readiness, not formal/runtime PASS.

WU8 fixture correction:10added/1removed test-only lines, cumulativeWU8budget132. Pagination mock echoes requestedpage/limit and models valid empty known-resource scope, with page3/limit7 and routedpage2 regressions authored. No app behavior change;28/28implementationdone. Acceptance harness/typecheck/lint rerun pending; canonical60/liveNav6 proof retained for unchanged app targets.

Latest WU8 measuredfanout correction: closedCartDrawer passesexistingenabled:isOpen; allcompleteListingbrowserpagesafterfirst useactualNextpagination, withcompleteindependentURLsetassertions andreadonlyclosed/open networkregression authored.44added/1removed,WU8cumulative228;28implementationtasksremaincomplete/formalPARTIAL. Compiler/deployment/lifecycle/network/fullOffers649/Sup579/freshintegrity verification pending,notexecutedbyapply.
