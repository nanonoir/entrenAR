# Design: Local Real Catalog Cutover

## Technical Approach

Revision 5 reconciles both specs/#2018; frontend `not_required`. Proposed capability is **not implementation authorization**: principal separation exceeds scratch provisioning scope. Evidence/decision: `design-correction.md`. Preserve 17/25 history.

## Architecture Decisions

| Option | Tradeoff | Decision/rationale |
|---|---|---|
| Protected capability / caller GUC | Privilege setup / spoofability | Capability; flags cannot authorize. |
| Separate principals / current shared connection | Operational expansion / owner bypass | Separation required; privileged app is a blocker. |
| Durable reservation / transactional consumption | Extra connection / replay after rollback | Reserve once outside cleanup; rollback burns approval. |
| Impact / scheduling graph | Explicit projection / false cycles | Keep closure; exclude membership from precedence. |

## Architecture Contract

`C = backend/src/modules/catalog-cutover/`.

| File | Owns | Must NOT own |
|---|---|---|
| `C/catalog-cutover.command.ts` | Arguments/redaction | Implicit writes |
| `C/catalog-cutover.service.ts` | Evidence/backup/approval gates | SQL/process execution |
| `C/catalog-cutover.repository.ts` | Snapshot/locks/assertions | Classification |
| `C/ledger-cleanup.adapter.ts` | Restricted capability calls | Approval issuance |
| `C/fixture-provenance.ts` | Attested impact closure | Writes |
| `C/deletion-plan.ts` | Pure shared schedule | Scope expansion |
| `C/backup-rehearsal.ts` | Private isolated restore | Active-target restore |

CLI → service → repository/adapter → database; no reverse/frontend dependencies. Reuse `backend/src/common/prisma/mutation-gate.ts`, `backend/src/modules/catalog-scraper/operations/database-target.ts`, existing preflight/import approval and showcase manifest read-only. Importer/reset/schema models remain unchanged.

## Interfaces / Database Boundary

Principals: restricted app; executor; trusted issuer; NOLOGIN function owner; trusted migration owner. App/executor lack superuser, ownership, CREATEROLE, replication, owner/issuer membership, schema CREATE, ledger UPDATE/DELETE/TRUNCATE and private writes. Executor gets capability EXECUTE/enumerated non-ledger DML; app SELECT/INSERT. Revoke PUBLIC access. Owners/issuer/host administration are trusted.

Private `catalog_cutover_guard` stores disabled target enrollment, immutable approvals, exact ledger IDs/full JSONB rows, scope/preservation snapshots and one-use reservations. Issuer attests backup/restore/approval; executor cannot issue. Bind fingerprint, cluster system identifier/database OID/name/schema, run/manifest, evidence digests, expiry/login. Trusted enrollment establishes local deployment, not caller URL; scratch has separate enrollment.

After locks/re-audit, another executor connection commits reservation bound to verified cleanup PID/backend-start/full transaction ID/login. Duplicate/expired requests fail. Consumption survives rollback; new transactions require fresh approval.

SECURITY DEFINER fixes safe search_path/qualified identifiers. Begin verifies destination/snapshots/policy/privileges under all-model locks. `delete_ledger(approvalId,rowId)` checks reservation/OLD equality, creates private transaction/backend/row permit, deletes one row, removes permit. Replace existing trigger function body only: UPDATE raises; DELETE requires permit. No flag/GUC, trigger disable/drop or replication bypass. Deferred context constraint demands finalization: approved absence, zero Product, 61 categories, preserved equality. Failure rolls back data/permits; reservation stays burned.

## Data Flow

```text
restore → audit → issuer-approved scope → exclusive gate/table locks
→ re-audit → durable reservation → bound capability/schedule
→ assertions/finalization → commit → preflight → separately approved import
```

Retain 500-row scans/disconnected records/FK/typed/JSON/group closure/drift checks. Shared planner excludes `kind: group`: child before parent, compensation before original, variants → images → products; true cycles block. Add CUSTOMER-only `User` eligibility; CUSTOMER owner stays mock, ADMIN session preserved, both collateral-blocked.

## File Changes / Testing Strategy

Create `backend/prisma/migrations/20261002000000_scoped_fixture_ledger_cleanup/migration.sql`, `C/ledger-cleanup.adapter.ts`, `C/deletion-plan.ts`, `C/deletion-plan.spec.ts`, `backend/test/catalog-cutover-ledger.integration-spec.ts`. Modify repository/provenance/service/contracts/command and existing cutover tests; update runbook/tasks. No historical migration/model edits.

RED: role/owner preflight, PUBLIC/SET ROLE/DDL denial; ordinary UPDATE/DELETE/TRUNCATE; exact deletion; wrong row/target/evidence, expiry/replay, second session/transaction, concurrent writer, rollback/postcommit failure, policy drift, incomplete finalization; both HMAC orientations/real cycles and CUSTOMER/ADMIN preservation. Scratch PostgreSQL only; retain importer/receipt/assets/public/admin acceptance and quality suites.

## Threat Matrix

| Boundary | Applicability / safe-failure behavior | RED |
|---|---|---|
| Documentation paths | N/A: no execution classification | None |
| Git repository selection | N/A: no Git automation | None |
| Commit state | N/A: no commits | None |
| Push state | N/A: no pushes | None |
| PR commands | N/A: no PR automation | None |
| Restore subprocess | Applicable: fixed argv/no shell; private credentials; reject unsafe destination/path, timeout/nonzero exit | Injection, alias, paths, timeout, exit, redaction |

## Migration / Rollout

Separate privilege-scope decision → tasks → scratch implementation/proof. Real-target migration/enrollment, cleanup and import each require independent approval. Rollback prospectively restores unconditional trigger function and revokes capability grants; retain audit tombstones. Backup/drift/admin/categories/config/R2 remain protected.

## Open Questions

BLOCKING: authorize principal provisioning/runtime-role separation, or retain append-only and blocked cutover. No insecure shared-owner fallback.
