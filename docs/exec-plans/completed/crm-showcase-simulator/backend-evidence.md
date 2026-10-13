# Backend execution evidence — 2026-10-09

**Result:** backend implementation builds and unit tests pass. Real persistence/CRM acceptance is blocked by the available source baseline. No dump, clone, destination, schema change, database repair, seed/reset, outbound integration or source write was performed. No persistent process was launched by this workstream.

## Source/tooling inspection

All source SQL used `PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=10000'`, `psql -X -v ON_ERROR_STOP=1` inside the existing PostgreSQL container, with tool timeouts of 15 seconds. Credentials were resolved inside the container and never printed. No row-level contact/token values were exported.

| Evidence | Observed result |
| --- | --- |
| Tool discovery: `command -v docker; command -v pg_dump; command -v psql; command -v pg_restore; docker info --format '{{.ServerVersion}}'` | Docker available, server 29.6.1; PostgreSQL client tools not on host PATH; clients available inside existing PostgreSQL container |
| `docker ps --format '{{.Names}} {{.Image}} {{.Ports}}'` | Existing backend and PostgreSQL 16 containers; source PostgreSQL published on port 5432. No new container started |
| Read-only catalog counts | 649 products, 1,119 variants, 3,790 images, 60 categories; 10 weight bands |
| Read-only commercial counts | 0 customers, orders, user addresses, checkout sessions and suppliers |
| Read-only account contamination check | 42 ADMIN users; 38 emails outside reserved example domains; 127 refresh tokens. Zero first/last name/DNI/phone fields and zero password-reset tokens do **not** prove absence of PII |
| Read-only commerce status query | Four payment configurations INACTIVE; two shipping providers NOT_CONFIGURED; main pickup NOT_CONFIGURED |
| Read-only trigger query | `InventoryHistory_append_only`, `OrderItem_snapshot_immutable`, `Order_snapshot_immutable`, `OrderPayment_snapshot_immutable` enabled (`O`) |
| Credential-free source identity parsing via compiled `identifyDatabaseTarget(explicitUrl)` | Fingerprint `83356d0e3af5e1161197c6962b763172d389fde5682cd686b5cef0facd5d5d3a`; published loopback source, port 5432, public schema. No destination fingerprint exists |

The first aggregate contamination query had a shell-quoting error and made no database query; it was corrected and rerun successfully. Provisioning stopped on the contamination/configuration findings. No permission to clean these records or activate commerce was assumed. A source read-only **role for backup** was not provisioned because that would itself change the source; no backup was attempted.

### Scheduler/process checks

- `powershell.exe -NoProfile -NonInteractive -Command "... Get-ScheduledTask ... TaskName -match 'entrenar|showcase' ..."`: zero matching local Windows tasks.
- Initial non-root container crontab inspection hit permission denied; repeated read-only inspection with `docker exec -u 0 <existing-backend-container> crontab -l` showed Alpine periodic maintenance entries, not a directly named showcase job.
- `docker exec -u 0 <existing-backend-container> sh -c 'ps -o comm'`: existing `node` process and the inspection `ps`; no running `crond` observed.
- No systemd client available in that container. Periodic script contents, remote hosts and future demo scheduler state were **not** certified. No scheduler-disabled manifest was fabricated.
- Repository process-name glob found no dedicated process-management helper for this scope. No backend/frontend/demo server was started; no task-created persistent processes need cleanup.

## Exact validation commands/results

Commands ran at repository root, with explicit tool limits (120 seconds for build/focused tests, 180 seconds for full unit tests, 45 seconds for fail-closed fixture setup).

```bash
npm run build:backend

npm --prefix backend run test:unit -- --runTestsByPath src/modules/crm-showcase/target-policy.spec.ts src/modules/crm-showcase/scenario.spec.ts src/modules/crm-showcase/crm-showcase.service.spec.ts src/modules/inventory/inventory.repository.spec.ts src/modules/sales/sales.state-machine.spec.ts src/modules/sales/sales.service.spec.ts src/modules/purchase-orders/purchase-orders.state-machine.spec.ts test/purchase-orders-service.spec.ts

npm run test:backend

env -u CRM_SHOWCASE_DATABASE_URL -u CRM_SHOWCASE_AUTHORIZATION -u CRM_SHOWCASE_DATABASE_URL_B -u CRM_SHOWCASE_AUTHORIZATION_B npm run test:crm-showcase

npm run build:backend && env -u CRM_SHOWCASE_DATABASE_URL npm run seed:crm-showcase -- --seed review-demo --reference-date 2026-10-09T15:00:00Z --authorization "C:/Users/Nahuel/AppData/Local/Temp/opencode/missing-showcase-authorization.json"

git diff --check
```

| Check | Result |
| --- | --- |
| Backend production build | Passed after local TypeScript corrections |
| Focused unit checks | 8 suites / 90 tests passed; final rerun after graph verification additions: 9.019 seconds |
| Full backend unit suite | 87 suites / 521 tests passed (48.628 seconds); existing exception-filter test prints an intentionally synthetic error string, not an exposed database credential |
| Dedicated persistence fixture without authorization | Failed closed at `beforeAll`, before client construction; missing explicit A/B URLs/manifests/seed/reference. **No persistence test body ran**; not persistence acceptance |
| Compiled root CLI forwarding with missing authorization | Exit 1, generic non-secret refusal; no client constructed and no database writes |
| Diff whitespace check | Initial local trailing blank line identified and removed; final `git diff --check` passed (only Git LF/CRLF advisory warnings) |

Earlier focused/build attempts revealed three implementation typing errors and a missing delivered-state distribution; corrected before the successful checks. An initial root focused-test invocation also demonstrated legacy npm argument-forwarding warnings; the exact successful focused command above uses backend `--` forwarding. Those failed attempts are not counted as passing validation.

## Reviewer path and limits

1. Review `target-policy.ts` and `crm-showcase.command.ts` first: no habitual URL fallback, explicit isolation evidence, no application/integration bootstrap, credentials omitted from logs.
2. Review `CrmShowcaseService.run`: gate before marker/baseline reads, READ COMMITTED, bounded single transaction, fixed validated marker, no mutable-data comparison on rerun.
3. Review `historical-writer.ts`, inventory historical context and shared calculation helpers: final snapshot inserts, chronological receipts/deductions/restorations, imported balances, unchanged stock modes/timestamps/catalog structure, real quote/mapper/state-machine reuse.
4. Review the dedicated fixture/config and [operator guide](./backend-operator-guide.md). Runtime evidence still required: authorized PII-free/configured dump/copies, actual transaction duration, full rollback/concurrency/A-B reproduction/live-operation/read-consumer execution, authenticated HTTP/browser routes and independent review.

The generator is CLI-only; frontend files, normal seed/reset, schema/migrations and `AppModule` are untouched by this backend workstream. Do not mark the plan's database/runtime/independent-review acceptance as complete from this evidence.

## Reviewer correction: receipt-funded zero-stock preflight

The blocking review finding was confirmed: completion quotes ran before purchases, so a selected TRACKED variant with imported quantity zero failed even though early simulated receipts would fund it. `HistoricalWriter.write` now inserts parents and purchases/receipts before validating both quote branches, within the existing single transaction. Destination/baseline/namespace/persistence reads in the service still precede writes; any quote failure rolls the transaction back. No zero-stock variants are filtered out and imported balance evidence remains zero.

`historical-writer.spec.ts` uses twelve zero-stock variants, actual purchase orchestration/calculation and a mocked inventory receipt boundary that adds 10 twice to each balance. Its quote mock throws OutOfStock if invoked before receipt. The test asserts parents/purchases/receipts precede both quote branches, balances become 20 without changing imported quantities, abandonment orchestration proceeds and downstream balance verification receives zero initial balances. Unrelated order snapshots and final invariants are isolated with test seams; this is not database acceptance.

Exact correction checks (120-second tool bounds):

```bash
npm --prefix backend run test:unit -- --runTestsByPath src/modules/crm-showcase/historical-writer.spec.ts src/modules/crm-showcase/scenario.spec.ts src/modules/crm-showcase/crm-showcase.service.spec.ts src/modules/crm-showcase/target-policy.spec.ts
npm run build:backend
npx eslint backend/src/modules/crm-showcase/historical-writer.ts backend/src/modules/crm-showcase/historical-writer.spec.ts --max-warnings 0
npm --prefix backend run test:unit -- --runTestsByPath src/modules/crm-showcase/historical-writer.spec.ts
```

- Scoped unit suite: **4 suites / 51 tests passed** (11.112 seconds).
- Mutation check: temporarily restoring the old quote-before-purchase order made the new test **fail as expected**, receiving `OutOfStock: quote ran before receipt` instead of the downstream invariant sentinel. The corrected order was immediately restored.
- Final regression rerun: **1 suite / 1 test passed** (6.750 seconds); backend build and scoped ESLint passed afterward, with zero lint warnings.
- Primary's existing warning fixes were retained. No source/demo provisioning, database access, frontend changes, persistent processes or commits were performed for this correction. Existing real-persistence prerequisites remain blocked.
