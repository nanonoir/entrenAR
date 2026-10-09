# Design: Entreno Real Catalog Ingestion and R2 Handoff

## Technical Approach

Make `catalog-scraper` run-oriented and keep `catalog-import` as the only product-write boundary. Commands verify SHA-256 digests and target fingerprint, execute one guarded stage, then atomically replace control evidence. `normalizeCatalogImportManifest` remains final manifest authority; `PrismaCatalogImportRepository.persist()` retains the exclusive transaction.

## Architecture Decisions

| Decision | Alternatives / tradeoff | Choice and rationale |
|---|---|---|
| Run persistence | DB migrations vs unsafe ad-hoc files | Local Zod-validated `RunStore`; canonical hashes and atomic writes make frozen payload tampering detectable. |
| R2 authority | Public HEAD cannot prove set/integrity | Extend storage port with paginated list/delete, upload metadata, authenticated/public HEAD; hard-code `products/`. |
| Taxonomy | Regeneration hides drift | Track `source-data/entreno-taxonomy.v1.json` with 61 nodes, mappings, rejects; unknown/ambiguous drift blocks. |
| Import binding | Earlier reports become stale | Require run/digest/environment and repeat no-write preflight immediately before atomic persistence. |

## Architecture Contract

### Responsibility Map

| Module / File | Owns | Must NOT own |
|---|---|---|
| `backend/src/modules/catalog-scraper/run/*` | lifecycle, snapshots, digests, recovery, sanitized evidence | Prisma product writes or implicit import |
| `backend/src/modules/catalog-scraper/extraction/*` | bounded HTTP extraction/classification | R2/DB mutation |
| `backend/src/modules/catalog-scraper/taxonomy.ts` + `source-data/*` | fixed taxonomy, drift, idempotent sync | regeneration/deletion |
| `backend/src/modules/catalog-scraper/storage/*` | local WebP and confirmed R2 reset/upload | non-`products/` keys |
| `backend/src/modules/catalog-import/*` | canonical readiness, approval, atomic persistence | scraping/category sync |

### Dependency Direction

`*.main.ts → command → service → port → HTTP/filesystem/R2/Prisma adapter`. Scraper may call exported import preflight; import never depends on scraper orchestration. Only repositories import Prisma.

### Reuse Plan

Reuse `fetchWithRetry`/`mapBounded`, taxonomy and manifest validators, `MutationGate`, and existing atomic `persist`; never duplicate them.

### Structural Constraints

- `CatalogScrapeCommand` only parses arguments and renders sanitized results; orchestration belongs in a service.
- Duplicate-SKU ownership is evaluated globally before manifest freeze; all owners are excluded.
- Frozen source, taxonomy, manifest, and bytes never change; interrupted upload resumes only after newly confirmed reset and full upload.
- Per-run/target filesystem locks serialize preparation/R2 commands; import also takes a transaction-scoped PostgreSQL advisory lock before the clean-target check.

## Data Flow

```text
Operator → Prepare CLI → RunStore: allocate, extract, freeze source/manifest/assets
Prepare CLI → Taxonomy: reconcile/drift check → RunStore: ASSETS_VALIDATED
Operator → Reset CLI → R2: paginated list/delete/relist → RunStore: R2_RESET
Upload CLI → R2: upload/head/list exact set → RunStore: ASSETS_UPLOADED

Operator → Sync CLI → PostgreSQL: idempotent categories → RunStore: CATEGORIES_SYNCED
Operator → Preflight CLI → Files/R2/PostgreSQL: verify without writes → READY
User approval → Import CLI → Preflight: repeat mutable checks → Repository: atomic persist
```

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/src/modules/catalog-scraper/{run,extraction,storage,source-data}/*` | Create | Run orchestration, adapters, taxonomy v1 |
| `backend/src/modules/catalog-scraper/{scraper,transformer,taxonomy,report,*.command,module}.ts` | Modify | Real parsing, exclusions, drift, stages |
| `backend/src/modules/catalog-import/{catalog-import.*,ports/*,adapters/*}` | Modify | Exact-set preflight and approval binding |
| `backend/package.json`, `.gitignore`; old fixture | Modify/Delete | Commands, ignored runs, taxonomy relocation |

## Interfaces / Contracts

`RunRecord` carries lifecycle, timestamps, fingerprints, SHA-256 digests, `{key,sha256,size}` inventory, counts, blockers, and results. States are `CREATED → EXTRACTING → SNAPSHOT_FROZEN → ASSETS_VALIDATED → R2_RESET → ASSETS_UPLOADED → CATEGORIES_SYNCED → READY → IMPORTING → IMPORTED`, with guarded `FAILED`. Commands: `catalog:scrape --sitemap`; `catalog:reset-assets --run-id --confirm-*`; `catalog:upload-assets --run-id`; run-bound sync/preflight; approved `catalog:import <products.json> --run-id --manifest-sha256 --confirm-environment`. Unknown/duplicate flags fail closed. Outputs expose sanitized fingerprints/counts; path traversal, escaping symlinks, secret-bearing errors, and non-`products/` keys are rejected.

## Testing Strategy

| Layer | Coverage |
|---|---|
| Unit | transitions/digests, variants/SKUs, drift, prefix/pagination/exact-set, redaction |
| Integration | resume/tamper/lock contention, idempotent sync, fake-S3 adapter, no-write preflight |
| E2E | approval/target rejection, concurrent import rejection, rollback, committed counts/public reads |

## Threat Matrix

| Boundary | Adversarial cases | Applicability / response / RED tests |
|---|---|---|
| Documentation-like paths | executable docs/config names | N/A: JSON/run inputs are never executed |
| Git repository selection | `git -C`, relative/absolute | N/A: no Git invocation |
| Commit state | staged, `-a`, empty index | N/A: no Git invocation |
| Push state | tracking/first/refspec | N/A: no Git invocation |
| PR commands | head/env/composition | N/A: no PR automation |

## Migration / Rollout

Move the 61-category fixture before ignoring `scrape-output/**`. Roll out preparation commands first; no database migration. Any failure remains `NOT_READY`/`FAILED`; R2 recovery requires confirmed reset and full re-upload, while import rollback remains transactional.

## Open Questions

None.
