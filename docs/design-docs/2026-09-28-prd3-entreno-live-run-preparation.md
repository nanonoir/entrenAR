# Design: Entreno Live Run Preparation

## Technical Approach

Produce the PRD3 frozen run from structured Tiendanube observations, PRD2 transformation rules and accepted-only validated assets. No R2, DB, preflight or import invocation.

## Architecture Decisions

| Option | Tradeoff | Decision / rationale |
|---|---|---|
| DOM fallbacks vs structured source | DOM is incomplete; embedded schemas can drift | Decode recognized embedded state with Zod into `SourceProduct`; HTML supplies presentation text only. Systemic schema drift fails closed; no SDK-script-string variant fallback. |
| Derive taxonomy vs approved mapping | Derivation silently changes semantics | Load `backend/source-data/entreno-taxonomy.v1.json` plus versioned mapping distilled from the approved reconciliation report; validate unique source identities, 61 nodes and targets. Reject unknown/ambiguous IDs or paths; report absent approved categories. |
| Write assets directly vs staging | Direct writes leak excluded images | Stage per product outside final `assets/`; promote only valid galleries after acceptance, roll back partial promotion, then verify inventory/manifest exact-set equality. |
| Rewrite run vs atomic publication | Mutable payloads undermine handoff | Exclusive run allocation, immutable payloads via temporary write/rename, `run.json` published last. Only later operational stage evidence may update `run.json`. |

## Architecture Contract

### Responsibility Map

| Module / file | Owns | Must NOT own |
|---|---|---|
| `scraper.ts`, `source-data/tiendanube-product.ts` | Bounded HTTP, structured parsing into typed source observations | Fixture synthesis, manifest, R2 |
| `transformer.ts` | Global SKU ownership, PRD2 rules, canonical projection | HTTP, asset bytes, silent defaults |
| `taxonomy.ts`, `source-data/source-category-map.ts` | Approved artifact loading, explicit source resolution, drift | Regeneration, DB sync |
| `storage/local-assets.ts` | Bounded WebP validation, per-product staging | R2 upload, lifecycle |
| `run/prepare-run.ts` | Pipeline ordering, exclusions, exact-set reconciliation | CLI parsing, Prisma |
| `run/run-store.ts`, `report.ts` | Immutable payload publication, digests/state; sanitized accountability | Extraction/business mapping |
| `scrape.command.ts` | Arguments, injected ports, sanitized exit | Downstream operational calls |

### Dependency Direction and Reuse Plan

`scrape.main.ts → scrape.command.ts → run/prepare-run.ts → scraper/transformer/taxonomy/local-assets → RunStore`; only import the existing `normalizeCatalogImportManifest`, never duplicate it. Reuse `fetchWithRetry`, `mapBounded`, `validateCategoryArtifact`, `reconcileCategoryMembership`, `downloadLocalAsset`, `canonicalAssetKey`, and `digest`. Keep `catalog-import` and `operations/*` downstream-only; no reverse dependency or Prisma/R2 adapter in preparation. Extract orchestration from the already overloaded command; do not extend `writePipelineOutputs` to overwrite frozen files.

## Data Flow

```text
Sitemap → sorted URLs → live/fixture HTTP adapter → typed SourceProduct[] + failures
  → approved mapping/reconcile → global SKU-owner pass (all variants, all owners)
  → per-product transform/exclude → selected gallery staging/validate
  → exclude whole failed gallery + delete its staging → accepted-only canonical validation
  → exact manifest-image ↔ inventory ↔ local-byte reconciliation → frozen files → run.json
```

Preserve sparse combinations, tracked zero stock, real prices, ordered galleries and image references; missing required values exclude rather than fabricate. Bound page/image concurrency to three and use timeouts/retries only for transport/429/5xx; never retry invalid bytes/schema. Isolated failures produce one stable per-URL outcome; systemic parser/sitemap/taxonomy drift fails the run. Sort payloads independent of completion order.

## File Changes

| File(s) | Action | Purpose |
|---|---|---|
| `backend/src/modules/catalog-scraper/source-data/{tiendanube-product,source-category-map}.ts`, `backend/source-data/entreno-source-category-map.v1.json`, `run/prepare-run.ts` | Create | Typed decoding, approved mapping, orchestration |
| `backend/src/modules/catalog-scraper/{scraper,transformer,taxonomy,scrape.command,report}.ts`, `storage/local-assets.ts`, `run/run-store.ts` | Modify | Extract, reconcile, stage and freeze |
| `backend/src/modules/catalog-scraper/storage/storage.command.ts`, `operations/run-binding.ts` | Modify | Align upload path and reject incomplete/non-ready preparation evidence |
| `backend/src/modules/catalog-scraper/{fixtures/*,*.spec.ts,run/*.spec.ts,storage/*.spec.ts}` | Create/modify | Mocked source, failure and file-contract tests |

## Interfaces / Contracts

`SourceProduct` carries source URL/identity, category IDs/paths, ordered gallery with image IDs, variants with explicit SKU, price, options, stock mode/quantity, image ID and logistics; a live decoder and fixture decoder implement the same validated input contract. Mapping is source identity/path → one approved canonical slug, never a slugified guess. `products.json` serializes only the canonical import input (`{products: ...}`), not the validator's `skuSet` or derived plan fields; revalidate on read. Layout: `scrape-output/{run-id}/{run.json,source.json,taxonomy.json,categories.json,products.json,inventory.json,report.md,assets/products/{slug}/{position}.webp}`. `run.json` holds SHA-256 for each frozen file, inventory entries, counts and observation start/end; exclude run ID/time from deterministic payloads. Align upload reader to `assets/{key}`.

## Testing Strategy

| Layer | Approach |
|---|---|
| Unit | Structured fixtures: sparse variants, category overlaps/drift, all duplicate-SKU owners, bad price/logistics, image association, stable ordering. |
| Integration | Fake HTTP/filesystem: bounded retry/concurrency, later-image failure deletes staging, no excluded inventory/files, exact size/hash, unique runs, failed atomic publication and immutable prior runs. |
| CLI | Mocked dependencies: `NOT_READY`, complete URL accounting, no R2/DB/import calls; operational binder rejects incomplete runs. |

## Threat Matrix

CLI integration changes no executable classification, shell/subprocess, VCS or PR routing. Documentation-like paths: N/A (JSON/WebP data never executed); Git repository selection: N/A (no Git); commit state: N/A (no Git); push state: N/A (no Git); PR commands: N/A (no PR automation). No applicable RED cases from this matrix.

## Migration / Rollout

No database migration. Exclusive `mkdir` allocation rejects collisions. Failed attempts remain `FAILED`/`NOT_READY`, with no publishable inventory; best-effort staging cleanup never masks the failure. Retry allocates a fresh run, not resume. Operational commands retain exclusive R2/DB/preflight authority; scrape reaches `ASSETS_VALIDATED`/`NOT_READY`, never `READY`. Generated runs are ignored local data, not SDD state.

## Open Questions

None; implementation must verify the approved report's source identities cover the chosen live embedded-state identifiers and fail closed on drift.
