# Design: Run-Bound Catalog Import Safety

## Technical Approach

Bind the five delta specs to frozen run evidence, a confirmed DB, and read-only R2 reconciliation. Frontend `not_required`.

## Architecture Decisions

| Option | Tradeoff | Decision / rationale |
|---|---|---|
| Label vs DB identity | Labels lie; URLs leak secrets | SHA-256(normalized host, port, database, effective schema), excluding credentials/query secrets. Report sanitized identity; reject ambiguity; recompute before writes. |
| Per-target receipts vs one-target run | Receipts add cross-target concurrency | Persist immutable `targetFingerprint` claim **before** category mutation; receipt follows success. Current run is local; production uses another prepared run, same commands. R2 fingerprint remains separate. |
| Replay R2 vs attest objects | Replay destroys data | Read-only paginated exact set plus authenticated HEAD size/required SHA and public HEAD; record `R2_RESET → ASSETS_UPLOADED` as verified reconstruction, not historical proof. |
| Trust success vs reconcile | Receipt may fail after commit | Report `RECONCILIATION_REQUIRED`, forbid retry; compare exact slugs, SKUs, images, links and counts before repairing `IMPORTED`. |

## Architecture Contract

| Module / file | Owns | Must NOT own |
|---|---|---|
| `backend/src/modules/catalog-scraper/operations/{database-target,run-binding}.ts` | Sanitized identity; frozen paths/digests; distinct confirmations | Secrets, mutations |
| `backend/src/modules/catalog-scraper/run/run-store.ts` | One-target lifecycle, receipts/transitions | Remote operations |
| `backend/src/modules/catalog-scraper/storage/{r2-storage,storage.command}.ts` | R2 verification and explicit storage operations | DB writes |
| `backend/src/modules/catalog-scraper/{handoff,category-sync,preflight}.*.ts` | Target-checked sync and readiness | Import/R2 writes |
| `backend/src/modules/catalog-import/{approval,catalog-import.command,catalog-import.service}.ts` | Required approval, owned manifest, guards, outcomes | Scraping/category sync |
| `backend/src/modules/catalog-import/catalog-import.repository.ts` | Exclusive transaction/empty-target guard; reconciliation queries | CLI/lifecycle |

`*.main.ts → commands → binding/target + RunStore → services → repositories/adapters`. Reuse `normalizeCatalogImportManifest`, `CatalogTaxonomySyncService.sync`, `CatalogImportService.preflight`, `verifyExactSet`, `MutationGate` and atomic `persist`; do not grow `AppModule`/`PrismaService`. Require SHA metadata (currently optional). Hash raw `categories.json` against its `fileDigests` entry, never taxonomy digest. Preserve failed run/prior outputs.

## Data Flow

```text
target-info → operator confirms DB fingerprint
run binding + frozen files → read-only R2 exact-set/auth/public verification
  → record verified R2_RESET/ASSETS_UPLOADED (no R2 writes)
confirmed DB + categories.json digest → idempotent sync → CATEGORIES_SYNCED
confirmed DB + actual Product count/Category slugs + canonical manifest
  + exact R2 checks → local preflight receipt → READY
explicit import approval + owned products.json + repeated mutable checks
  → IMPORTING → exclusive transaction/empty Product guard → IMPORTED receipt
  └─ commit but receipt fails → block retry → read-only exact-row reconciliation
```

Preflight failure records sanitized blockers at `CATEGORIES_SYNCED`, revoking stale `READY`. Import failure is non-ready; evidence failure is indeterminate. If sync commits but receipt fails, reconcile categories read-only before marking success. Recheck DB identity before sync/transaction and full DB/R2 preflight before import.

## File Changes

| Path | Action | Purpose |
|---|---|---|
| `backend/src/modules/catalog-scraper/operations/database-target.ts` | Create | Identity adapter |
| `backend/src/modules/catalog-scraper/operations/run-binding.ts`, `run/run-store.ts`, `storage/{r2-storage,storage.command}.ts` | Modify | Distinct targets, receipts, HEAD |
| `backend/src/modules/catalog-scraper/{category-sync.command,handoff.command,handoff.main,preflight.command,preflight.main}.ts` | Modify | Bound handoff/real preflight |
| `backend/src/modules/catalog-import/{approval,catalog-import.command,catalog-import.service,catalog-import.repository}.ts` | Modify | Approval/outcome/reconciliation |
| `backend/package.json`, `backend/OPERATIONS.md`, focused `*.spec.ts`/integration tests | Modify/Create | Scripts, guidance, coverage |

## Interfaces / Contracts

Import requires `--run-id`, `--manifest-sha256`, `--run-root`, owned `products.json`, `--confirm-db-fingerprint`; handoff/preflight require DB confirmation. Storage retains R2 `--destination-fingerprint`. Reject omitted/duplicate/unknown flags and symlink/escaped paths. `RunRecord.targetFingerprint` is DB-only; receipts include digests, target and four committed counts. Never upgrade incomplete evidence silently.

## Testing Strategy

| Layer | Coverage |
|---|---|
| Unit (RED first) | Credential-free fingerprints, approval/path rejection, category digest, revocation, missing SHA/extra key/public HEAD |
| Integration (isolated DB/fake R2) | Target switch, idempotent sync, actual DB facts, no R2 writes, rollback, post-commit reconciliation |
| CLI/build | Compiled dispatch with injected fakes; no live import |

## Threat Matrix

CLI process integration applies; no executable inputs or VCS integration.

| Boundary | Minimum adversarial cases | Applicability | Design response | Planned RED tests |
|---|---|---|---|---|
| Documentation-like paths | `requirements.txt`, `CMakeLists.txt`, executable MD/MDX, `README.sh` | N/A: only frozen JSON/WebP data, never executed | Owned-path guard | None |
| Git repository selection | `git -C`, relative, absolute | N/A: no Git invocation | — | None |
| Commit state | staged, `commit -a`, empty index | N/A: no Git invocation | — | None |
| Push state | tracking, first push, refspec | N/A: no Git invocation | — | None |
| PR commands | `--head`, environment prefix, composed commands | N/A: no PR automation | — | None |

## Migration / Rollout

No DB migration. Reconcile 3,790 objects read-only; uncertain evidence stays non-ready. Work units: identity, storage, sync, preflight, import/recovery. Local writes need separate confirmation.

## Open Questions

None blocking: production uses a separate prepared run, not a second target receipt on this run.
