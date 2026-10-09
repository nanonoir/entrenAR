# Design: Catalog Listing and Taxonomy Alignment

## Technical Approach
Implement four behavioral specs/frontend-spec with server-filtered pages and complete unique metadata. Reuse existing NestJS complete reads; retain limit≤100. No schema changes.

Abbreviations: `B=backend/src/modules`; `C=src/lib/api/catalog`; `L=src/components/shop/products/listing`.

## Architecture Decisions

| Option | Tradeoff | Decision/rationale |
|---|---|---|
| Server pages / download everything | Bounded responses / simpler filtering | Server pages: truthful totals |
| Existing reads / new SQL infrastructure | 649-product scan / expansion | Reuse reads: targeted change |
| Active overlay / rewrite historical taxonomy | Explicit contracts / corrupted evidence | Overlay: preserve historical validation |
| Targeted recovery / BackupRehearsal | Narrow evidence / scratch restoration | Targeted: scratch unauthorized |

## Architecture Contract / File Changes

| Paths | Action; owns | Forbidden |
|---|---|---|
| `B/catalog/public-listing.ts` | Create; eligibility/predicates/metadata/brand-slugs | Transport/Prisma |
| `B/catalog/{catalog-query.service.ts,catalog.schemas.ts,public-catalog.controller.ts,dto/catalog-openapi.dto.ts}` | Modify; orchestration/contracts | UI/mutations |
| `C/{catalog.repository.ts,catalog-api.repository.ts,mock-catalog.repository.ts}` | Extend; pages/directory/mapping | Authority |
| `src/lib/{product-listing.ts,category-membership.ts,routes.ts}`, `src/lib/data/{shop-routes.ts,navigation.ts}`, `src/types/{navigation.ts,product-listing.ts}` | Modify; routing/translation/fixture compatibility | Prisma |
| `src/app/(shop)/[...segments]/page.tsx`, `L/ProductListingShell.tsx` | Modify; directory/states/pagination | Client fetching |
| `B/catalog-scraper/active-taxonomy.ts`, `B/catalog-scraper/operations/shaker-consolidation.ts` | Create; overlay/audit/merge/recovery | Reimport/reset/R2 |
| `B/catalog-scraper/run/prepare-run.ts`, `B/catalog-scraper/category-sync.command.ts` | Modify; active selection | Frozen rewriting |

Route→adapter→controller→service→CatalogRepository→Prisma; no reverse dependencies. Reuse mapper, ZodValidationPipe, CatalogReadResult, ProductGrid, filters/drawers/Button. Extract cohesive helpers; no brand entity/auth/cache platform.

## Interfaces / Data Flow

`GET /products`: retain strict `categorySlug,page,limit,sort` compatibility. Add validated `brandSlug,offersOnly,categorySlugs,subcategorySlugs,brandSlugs` (bounded CSV), `minPrice,maxPrice,search`; add `best-selling` sort. OR within facets, AND across facets/route; inclusive price; offers `compareAtPrice>price`. Stable ID tie-breaks; newest=createdAt; best-selling=isBestSeller/salesCount.

Existing `{items,page,limit,total}` gains `totalPages,facets,priceBounds`. Facets/bounds cover distinct IDs across route scope before optional filters, preserving existing semantics; total follows filters. Out-of-range pages empty. `GET /brands` returns eligible `{slug,label,count}`.

Metadata→route→query→complete eligibility/filter/count/sort→slice→UI. Preserve category ID/parent metadata; resolve every PUBLIC category independently of counts, including Performance/Control de peso. Canonical memberships dominate; explicit legacy fixtures fall back to primary/subcategory arrays. Directory slugs drive brand links; redirect only unambiguous normalized/known-navigation aliases. Permanently redirect both obsolete shaker URLs to `/shakers`, preserving queries. Unknown resources=404; failures=controlled errors, never empty. Avoid duplicate catch-all reads. Existing array consumers, including touched admin reads, traverse validated bounded pages completely or fail. Filters/sort/clear reset page; pagination retains query.

## Migration / Rollout

Active overlay removes obsolete category, maps both source shaker memberships to root, preserves source URLs, explicitly permits many-to-one mapping. Preparation/editable sync use overlay; v1 loader/61-category validation and frozen bound sync remain unchanged.

Authorized operation: identify configured/connected local `entrenar` target/schema/fingerprint. Audit exact rows/duplicate pairs/all FK references: children, ProductCategory, CouponCategory, ShippingDiscountCategory; unknown references/drift stop. Exclusively write private ignored `backend/backup/` evidence: original rows/timestamps/links, four additions, target/invariant hashes; read-back validate, never overwrite. Finite category/membership-table and target-row locks; re-audit transactionally. Add four links/remove23/delete1→60 categories/2,105 links/23 shakers. Preserve unrelated memberships, IDs/prices/stock, 649/1,119/3,790 rows, admin/config/R2. Failure rolls back; verified rerun no-ops. Recovery restores original category/links, removes only evidenced additions; conflicting subsequent edits stop. Preserve unrelated worktree changes.

## Testing Strategy

Mocked Jest: `B/catalog/*.spec.ts`, `B/catalog-scraper/*.spec.ts`, `operations/*.spec.ts`. Harnesses: `C/catalog-adapter.harness.ts`, `tests/harnesses/prd2-catalog-routes.harness.ts`. RED: beyond-page-one, uniqueness, legacy, failures/empty, aliases, rollback/idempotence. No destructive DB Jest.

Read-only integrity plus `tests/e2e/catalog-listing.spec.ts`: dynamically discover DB/API/navigation/aliases; every retained category, unique IDs/totals/totalPages/facets, baseline counts, empty/error, desktop/mobile filters/sorts. Compare protected hashes; distinguish auth tokens. Units≤600 additions including tests: backend, adapters, routes, UI, taxonomy, operation/recovery, browser evidence; split excess.

## Threat Matrix

| Boundary | Applicability/reason |
|---|---|
| Documentation-like paths | N/A: no classification |
| Git repository selection | N/A: no automation |
| Commit state | N/A: no commits |
| Push state | N/A: no pushes |
| PR commands | N/A: no PRs |

Routing RED cases propagate unchanged. Requests15s/browser30s/diagnostics60s/tests-build180s. Startup if necessary: detached Windows WMI, PID/log/readiness evidence; never await foreground watch.

## Open Questions
None; operation prerequisites remain apply-time gates, not completed audits.
