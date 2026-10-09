# Design: PRD3 Real R2 Operational Handoff

## Technical Approach

Add selected-run CLI boundaries around the existing `RunStore`, guarded R2 functions, taxonomy sync, and canonical `CatalogImportService.preflight()`. One validated binding object identifies the run, target, frozen files, and expected inventory; commands never accept unbound payloads or invoke `catalog:import`.

## Architecture Decisions

| Decision | Alternatives / tradeoff | Choice and rationale |
|---|---|---|
| Command contract | Positional paths are shorter but ambiguous | Strict named flags parsed with Zod; reject unknown, duplicate, missing, or mismatched values before adapters are created. |
| R2 adapter | Extend fixture-level object API vs duplicate clients | Add one S3-backed `R2StoragePort` adapter using shared environment validation: paginated ListObjectsV2, DeleteObjects batches, PutObject SHA metadata, authenticated HeadObject, and public HTTP HEAD. |
| Readiness | Let commands set status directly | Centralize stage evidence and readiness evaluation in `RunStore`; only successful preflight may transition `CATEGORIES_SYNCED → READY`. |
| Handoff | Modify fixture generator in place | Create a production selected-run handoff; retain fixture generation behind an explicitly fixture-named script so synthetic output cannot enter operational commands. |

## Architecture Contract

### Responsibility Map

| Module / File | Owns | Must NOT own |
|---|---|---|
| `catalog-scraper/operations/run-binding.ts` | CLI schema, realpath containment, six-field/run-file validation | R2, Prisma, or status mutation |
| `catalog-scraper/storage/storage.command.ts` + `storage.main.ts` | reset/upload dispatch and sanitized rendering | parsing manifests or importing products |
| `catalog-scraper/storage/s3-r2-storage.adapter.ts` | authenticated S3 list/delete/put/head and public HEAD | lifecycle decisions |
| `catalog-scraper/run/run-store.ts` | atomic evidence, legal transitions, readiness invariant | external I/O orchestration |
| `catalog-scraper/handoff.command.ts` | selected frozen-run validation and stage coordination | scraping or fixture synthesis |
| `catalog-scraper/preflight.command.ts` | no-write checks and READY decision | category/R2/product mutation |
| `catalog-import/*` | canonical validation and sole product persistence | scraper orchestration |

### Dependency Direction

`*.main.ts → command → run-binding/orchestrator → ports → filesystem/R2/Nest adapters`. Preflight may call `CatalogImportService.preflight()`; scraper code must never call `importCatalog()` or repositories directly.

### Reuse Plan

Reuse `RunStore`, `assertProductsPrefix`, `resetProductsPrefix`, `uploadExactSet`, `verifyExactSet`, `runBoundCategorySync`, `normalizeCatalogImportManifest`, and `CatalogImportService.preflight()`; consolidate, do not duplicate, R2 environment parsing from `asset-storage.ts`.

### Structural Constraints

- Every operational command requires `--run-id`, `--environment`, `--destination-fingerprint`, `--manifest-sha256`, `--expected-count`, and `--run-root`; storage commands additionally require literal `--prefix products/`.
- `--categories-path`, `--manifest-path`, `--inventory-path`, and `--assets-root` must resolve exactly under `{real(run-root)}/{run-id}`; symlinks, traversal, fixture tags, digest/count disagreement, and noncanonical keys fail before I/O.
- Environment/fingerprint must equal sanitized environment-derived values and persisted run evidence. Logs expose command code, run ID, fingerprints, stages, and counts only.

## Data Flow

```text
CLI → binding validation → frozen run/files
 reset → paginated list → batched delete → empty verification → R2_RESET
 upload → local digest/size checks → put → list/auth/public HEAD → ASSETS_UPLOADED
 handoff → category sync → manifest validation → CATEGORIES_SYNCED
 preflight → canonical DB checks + frozen/R2 recheck → evidence → READY
```

Failures before freeze become terminal `FAILED`. Recoverable post-freeze failures record sanitized blockers while retaining the last successful state; partial upload remains `R2_RESET` and requires a newly confirmed reset plus full upload. Tampered frozen inputs invalidate the run. Evidence is written atomically only after the operation result is known.

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/src/modules/catalog-scraper/operations/run-binding.ts` | Create | Strict CLI/path/frozen inventory binding. |
| `backend/src/modules/catalog-scraper/storage/{storage.main,storage.command,s3-r2-storage.adapter}.ts` | Create | Executable storage boundary and real adapter. |
| `backend/src/modules/catalog-scraper/{handoff,preflight}.{main,command}.ts` | Create | Production handoff and no-write entrypoint. |
| `backend/src/modules/catalog-scraper/{run/run-store,r2-storage,asset-storage,scrape.command,generate-handoff}.ts`, `backend/package.json` | Modify | Evidence gates, adapter reuse, non-ready scrape, fixture isolation, scripts. |
| Matching `*.spec.ts` and integration specs | Create/Modify | Mocked filesystem/S3/Nest command seams. |

## Interfaces / Contracts

`OperationalRunBinding` contains the six confirmation values plus canonical categories, manifest, inventory, and asset-root paths. `R2StoragePort` returns continuation tokens and metadata; public HEAD is explicit. Command dependencies (`filesystem`, `storage`, `preflight`, `runStore`, `output`) are injectable and side effects start only after binding succeeds.

## Testing Strategy

| Layer | What to prove |
|---|---|
| Unit | parser/path/prefix guards, pagination/batches, digest/size/exact-set/public-head failures, readiness evidence, redaction |
| Integration | compiled command dispatch with fake S3/filesystem/Nest; partial upload recovery; no forbidden writes/import |
| E2E | build resolves all scripts; preflight remains no-write and importer stays manual |

## Threat Matrix

| Boundary | Minimum adversarial cases | Applicability | Design response | Planned RED tests |
|---|---|---|---|---|
| Documentation-like paths | executable docs/config names | N/A: JSON/WebP inputs are data, never executable | Reject paths outside selected run | None |
| Git repository selection | relative/absolute repository selectors | N/A: no Git process | — | None |
| Commit state | staged, `-a`, empty index | N/A: no Git process | — | None |
| Push state | tracking, first push, refspec | N/A: no Git process | — | None |
| PR commands | head, environment, composition | N/A: no PR automation | — | None |

## Migration / Rollout

No data migration. Ship and test command wiring with fakes; live reset/upload requires separate explicit approval. Rollback leaves the run non-ready and requires fresh reset/upload confirmation.

## Open Questions

None.
