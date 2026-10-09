# Design: Entreno Catalog Scraper and Import Preparation Pipeline

## Technical Approach

Add a source-specific `catalog-scraper` module inside the NestJS modular monolith. It owns HTTP extraction, approved taxonomy materialization/synchronization, transformation, R2 upload, readiness reporting, and CLI orchestration. The existing `catalog-import` module remains the only final manifest validator and product persistence boundary; the Next.js application only consumes relational catalog projections.

## Architecture Decisions

| Decision | Alternatives / tradeoff | Choice and rationale |
|---|---|---|
| Pipeline location | Root script duplicates backend configuration; importer extension mixes source and target concerns | Dedicated `backend/src/modules/catalog-scraper/`, depending inward on catalog/import ports and canonical validation. |
| Extraction/runtime | Playwright handles dynamic pages but adds browser/process risk | Node `fetch` + Cheerio + embedded JSON; max 3 workers, 15-second attempts, at most 3 attempts with jitter for network/429/5xx only. |
| Persistence | Sequential writes are simple but latency-sensitive | Bulk-resolve categories, `createManyAndReturn` products/images in bounded chunks, then bulk links/variants inside the existing exclusive transaction; only ingestion requests 30 seconds. |
| Category projection | Legacy JSON and CUID ordering are stale/nondeterministic | A pure hierarchy projector selects by approved root priority, deepest node, `sortOrder`, then slug; all associated non-root slugs are projected. |
| Asset consistency | Deferred/no-upload mode yields unusable manifests | Mandatory authenticated lifecycle preflight and overwrite uploads; R2 is not transactionally rolled back, while database import remains atomic. |

## Architecture Contract

### Responsibility Map

| Module / File | Owns | Must NOT own |
|---|---|---|
| `backend/src/modules/catalog-scraper/` | Entreno adapters, transformation, category sync, R2 writes, reports, CLIs | Product import execution; frontend behavior; parallel final schema |
| `backend/src/modules/catalog-import/` | Strict canonical validation, zero-product preflight, atomic bulk persistence | Scraping, taxonomy decisions, automatic invocation |
| `backend/src/modules/catalog/` | Hierarchy-derived public/admin projections | Source-specific mappings or `subcategorySlugs` authority |
| `src/lib/product-listing.ts`, `src/lib/{data/shop-routes,routes}.ts` | Route/listing projection | Taxonomy persistence or aliases that contradict synchronized categories |

### Dependency Direction

`CLI → scraper application services → source/storage adapters`; transformer → canonical `normalizeCatalogImportManifest`; category sync/import repositories → Prisma. Frontend → `src/lib/api` → NestJS. Reverse dependencies and Prisma/frontend imports are forbidden.

### Reuse Plan / Structural Constraints

- Reuse `normalizeCatalogImportManifest`, `MutationGate`, `ObjectExistencePort`, Prisma services, and existing catalog API adapters.
- Extend the strict manifest schema with logistics; never add a scraper-owned final validator.
- Keep `Product.subcategorySlugs` legacy-only; relational `ProductCategory` + `Category.parentId` is authoritative.
- No Prisma migration: logistics columns and hierarchy already exist.

## Data and Control Flow

```text
validated env → R2 lifecycle preflight → sitemap → bounded page/category extraction
→ approved reconciliation mapping → transform/exclude → categories.json
→ shared idempotent category-sync service → validated WebP overwrite uploads
→ canonical manifest validation + zero-product/category/object checks
→ products.json + report.md(READY)
→ [later, explicit operator] catalog:import → exclusive atomic bulk transaction
```

Stable sorting occurs after concurrent work. Stage metrics, retry counts, exclusions, warnings, timings, and readiness blockers go to the report/logs; credentials, endpoint, bucket, and signed values are never logged.

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/src/modules/catalog-scraper/**` | Create | HTTP client/worker pool, extractors, transformer, taxonomy validator/sync, R2 adapter, reporter, commands, fixture tests |
| `backend/src/modules/catalog-import/{manifest-validator,catalog-import.repository,catalog-import.service}.ts` | Modify | Logistics, zero-product state, bulk atomic writes, ingestion timeout |
| `backend/src/modules/catalog/catalog.mapper.ts` and repository/query wiring | Modify | Include hierarchy facts and delegate deterministic projection |
| `src/lib/product-listing.ts`, `src/lib/data/shop-routes.ts`, `src/lib/routes.ts` | Modify | First-class `performance`/`control-de-peso` and multi-membership matching |
| `backend/package.json`, root `package.json`, lockfile | Modify | Cheerio and explicit scrape/sync/preflight/validate commands |
| `scrape-output/{categories.json,products.json,report.md}` | Create | Deterministic reviewed handoff |

## Interfaces / Contracts

`CategoryArtifact { slug; name; parentSlug?; visibility; sortOrder }`; `ExtractedEntrenoProduct` remains internal. `ImportProduct` adds required positive `weightGrams` and optional positive dimensions. `PipelineReport` records stage status, counts, typed exclusions/warnings, blockers, and `readiness: "READY" | "NOT_READY"`. R2 and HTTP are ports so automated tests use local fixtures/fakes.

## Testing Strategy

| Layer | Coverage |
|---|---|
| Unit | XML/HTML/JSON/WebP fixtures: parsing, retries, deterministic order, exclusions, logistics maxima, category DAG, keys, redaction/reporting |
| Integration | Idempotent category sync; canonical validation; populated-target rejection; bulk IDs/primary images; forced late rollback |
| Acceptance/full-scale | Route projection/harnesses; 657/1,131/3,869/804 dataset, five clean runs under 8s; explicit live census/R2 checks only |

## Threat Matrix

| Boundary | Applicability | Design response / RED tests |
|---|---|---|
| Documentation-like paths | N/A — CLIs read declared JSON artifacts; they never classify or execute files | No threat task |
| Git repository selection | N/A — no VCS integration | No threat task |
| Commit state | N/A — no VCS integration | No threat task |
| Push state | N/A — no VCS integration | No threat task |
| PR commands | N/A — no PR automation | No threat task |

## Migration / Rollout

Order: canonical contract → import hardening → taxonomy artifact/sync → hierarchy projection/routes → scraper/R2/reporting → fixture suites → full-scale verification. No schema migration. Disable new commands and discard outputs to roll back; category sync never deletes unrelated rows, R2 leftovers are accepted, and failed product imports commit zero rows.

## Open Questions

None.
