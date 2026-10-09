# Apply Progress: Local Real Catalog Cutover

## Execution State

- Change: `prd3-local-real-catalog-cutover`
- Artifact store: hybrid
- Assigned scope: Work Units 1–6 only
- Current structured status: `applyState: ready`; `artifacts.applyProgress: partial`; 17/25 tasks complete. WU2.1 regression rerun, WU5.1 integration rerun, and WU7–9 remain pending.
- Authorization: reread current `state.yaml` and Engram observation #1996. Both authorize the exact backend module, integration test, package script, and change-root paths used here.
- Previous apply attempt: blocked before source edits due to stale authorization; no prior tasks or code changes existed to merge.
- Work Units 7–9 remain unassigned/pending; no real-local cleanup or import approval is inferred.
- Size exceptions: none.

## Implementation Progress by Work Unit

| Unit | Completed tasks | Estimated/observed code additions | Verification status | Runtime verification status | Rollback boundary |
|---|---|---:|---|---|---|
| 1 | Tasks 1.1–1.3 complete | ~570 | Final focused suite passed exact schema model set, disconnected/preserved rows, composite 500+1 cursor, and count mismatch cases | No database scan run | Remove `cutover-contracts.ts`, snapshot reader/schema comparison, and its unit cases. |
| 2 | Implementation 2.2–2.3 done; regression task 2.1 pending rerun | ~520 | CUSTOMER-owner/ADMIN-session collateral guard and unit regression added; TypeScript-compiled, runtime rerun pending | No live audit run | Remove `fixture-provenance.ts` and its classification/graph cases. |
| 3 | Tasks 3.1–3.3 complete | ~330 | Final focused suite passed distinct timeout-like and code-1 subprocess rejection sanitization cases | No archive/process/restore executed | Remove `backup-rehearsal.ts` and its tests. |
| 4 | Tasks 4.1–4.4 complete | ~460 | Focused CLI/evidence suite passed | CLI not run against real dependencies | Remove cutover service/CLI/contracts additions and the single CLI script entry. |
| 5 | Implementation 5.2–5.4 done; test task 5.1 pending | ~420 | Seed stock state and preserved-session collateral guard fixed after reported failure; integration rerun pending | No integration test runner invoked by this executor | Remove atomic cleanup extension, cleanup service flow, and `backend/test/catalog-cutover.integration-spec.ts`. |
| 6 | Tasks 6.1–6.2 complete | ~0 code additions (runbook is documentation) | Focused mocked category-sync, preflight, approval, importer/receipt, handoff and rollback guard suites passed | No live importer, DB or R2 operation | Remove `cutover-runbook.md`. |

All work-unit estimates are independent; no units were combined. Backend source and source-level Jest files passed `npx tsc --noEmit -p tsconfig.json`; the integration spec passed separate no-emit TypeScript compilation. The orchestrator's earlier combined focused run passed 12 suites/57 tests before the new CUSTOMER-owner/ADMIN-session regression was added. That regression has compile-only evidence and needs a focused rerun. This executor did not invoke a test runner; earlier unit evidence is not final SDD verification.

## Implementation Summary

- Work Unit 1 scans every Prisma model, including preservation-only tables and disconnected rows, in a RepeatableRead transaction. It uses stable 500-row primary/composite-key pagination, count equality checks, HMAC row/reference digests, and compares live PostgreSQL FK/delete effects with explicit Prisma schema relations.
- Work Unit 2 binds the owner declaration to the initial candidate population digest, classifies without requiring fixture manifests, and emits optional fixture evidence only. Indexed typed references, JSON snapshot/history references, customer-address `customerId` association, fixed-point closure, mixed-ownership blockers, and compensation-cycle detection remain bounded to the initial population. CUSTOMER owners with ADMIN refresh sessions are blocked as collateral ownership; the session remains preserved. The new regression awaits rerun.
- Work Unit 3 validates a private archive, SHA-256/size, pg_restore listing, a distinct same-host scratch database, restored full-population equality, and approved-row coverage. `pg_restore` uses a fixed executable, argv, timeout, no shell, sanitized failures, and credentials via child environment. Active-target restore is rejected.
- Work Unit 4 adds Evidence v3, canonical digests, HMAC references, exact local target binding, separate cleanup/import approvals, explicit audit/backup/cleanup/reconcile/import modes, and the `catalog:cutover` script. The command constructs Prisma directly without bootstrapping the full Nest application. Import mode runs the existing read-only manifest-approval gate and never invokes the importer.
- Work Unit 5 performs an exclusive MutationGate transaction with table locks, full row/FK drift re-audit, exact selector validation, dependency-first deletion order, transactional assertions for zero products/61 categories/preserved digest, and a read-only reconciliation path. The integration suite is hard-gated to `127.0.0.1:5432/entrenar_catalog_cutover_scratch/public` and rerun remains pending.
- Work Unit 6 records the frozen run and digest, target/quiescence controls, backup/recovery flow, two independent approvals, stop/reconcile behavior, existing category-sync/import guards, and separately gated production promotion. The final combined unit run exercises the existing mock-bound category sync, `PREFLIGHT_READY`, import approval/receipt and late-failure rollback guards; it performs no live DB/R2 operation.

## Architecture Contract

- Responsibility boundaries: Preserved — CLI, service, repository, provenance classifier, backup rehearsal, and contracts remain separate.
- Dependency direction: Preserved — CLI → service → classifier/backup/repository; Prisma and process execution remain outside classification.
- Reuse requirements: Satisfied — mutation gate, target identity, importer approval, existing preflight, and fixture manifest are consumed read-only where applicable.
- Structural constraints: Satisfied — no frontend, schema/migration, importer/reset, R2, or production code paths were changed.

## Risks / Deviations

- Backup-ignore check verified: tracked `backend/backup/.gitignore` contains `*` and `!.gitignore`; read-only `git check-ignore -v -- backend/backup/entrenar-pre-real-catalog-20260929.dump` reports `backend/backup/.gitignore:2:*`. The archive path is ignored; no ignore-rule change is required.
- WU5.1 approved scratch preparation evidence: read-only inspection verified configured source `127.0.0.1:5432/entrenar/public`; the scratch DB was absent and contained no prior data. Under approval #2014, created only `entrenar_catalog_cutover_scratch` and ran `prisma migrate deploy` with a child-process-only scratch `DATABASE_URL`; post-check found 16 migration records, 39 public model tables, zero application-table rows and zero large objects. No seed/reset or integration test truncation/seeding occurred. `.env` and persistent environment were not changed.
- Orchestrator's latest WU5.1 attempt failed 1 suite/4 tests with no real-target mutation: three inserts violated `ProductVariant_stockState_check`; the collateral test observed no blocker for an ADMIN refresh token owned by a CUSTOMER user. Canonical migration check requires TRACKED with non-null quantity >= 0 (or INFINITE/OUT_OF_STOCK with NULL); Prisma has no `isAvailable` field. Fixture now sets TRACKED/0 and preserves the deferred Product-Variant constraint. Classifier now explicitly blocks collateral ADMIN sessions and keeps them preserved; regression asserts the User→RefreshToken Cascade edge and both blocker rows. No candidate scope was expanded.
- The earlier raw PostgreSQL `char` issue remains fixed by `confdeltype::text` and related catalog text casts. Backend and integration-test TypeScript compilation pass; integration rerun remains pending.
- After the failed run, read-only scratch inspection verified the exact dedicated database/schema, 16 migration records, zero application-table rows, and zero large objects. A retry-safe helper in the preapproved temp directory validates exact source/scratch identity and known test fixture keys without requiring an empty schema; it scopes scratch URLs to Jest's child process. The integration suite's own truncation is permitted only on this authorized DB.
- The passing unit suite exercises the full schema-name list, composite cursor, preserved row, count mismatch, and injected code-1 restore failure; no actual PostgreSQL snapshot or `pg_restore` process ran.
- Windows does not expose POSIX file permission bits consistently; the rehearsal checks them only on platforms where those bits are meaningful and always requires an ignored private archive path.
- No active target was read or changed by these implementation tasks. No actual backup, restore, cleanup, import, R2 operation, or Git write was performed. Existing unrelated changes were preserved.

## WU6.2 Focused Existing-Test Handoff

These suites use injected DB/R2/service ports and temporary files only. Suggested focused command (not run by this executor):

```text
npm run test:unit -- --runTestsByPath src/modules/catalog-import/catalog-import.service.spec.ts src/modules/catalog-import/catalog-import.repository.spec.ts src/modules/catalog-import/catalog-import.command.spec.ts src/modules/catalog-import/reconcile-import.command.spec.ts src/modules/catalog-import/approval.spec.ts src/modules/catalog-scraper/category-sync.command.spec.ts src/modules/catalog-scraper/preflight.command.spec.ts src/modules/catalog-scraper/operations/run-binding.spec.ts src/modules/catalog-scraper/operational-handoff.integration.spec.ts
```


The orchestrator's final 12-suite/57-test run included this safe command. The repository spec's transaction/gate are mocks; category sync and preflight use injected callbacks/storage mocks; import command/approval suites use mock targets/assets and temporary `RunStore` files. They perform no real DB or R2 writes. By contrast, `backend/test/catalog-import.e2e-spec.ts` creates a Category and catalog rows, installs/drops a PostgreSQL trigger/function, and deletes test rows; it requires an isolated `DATABASE_URL_E2E` and must not point at `entrenar`. `backend/test/catalog-import-foundation.integration-spec.ts` performs read-only SQL through generic `DATABASE_URL`, so it also requires a positively isolated DB before running. Neither was invoked.

**Deprecated—do not use the following earlier inline invocation for retries:** it requires an empty scratch database and would reject known test fixtures left by a failed run. Use the preflight helper below instead; the helper allows only this approval-bound scratch target and lets the integration suite truncate/reseed its own known test rows.

```text
node --% -r dotenv/config -e "const {Client}=require('pg'),{spawnSync}=require('node:child_process'),path=require('node:path'),q=String.fromCharCode(34);const base=new URL(process.env.DATABASE_URL||'');const ident=u=>({host:u.hostname,port:Number(u.port||5432),database:decodeURIComponent(u.pathname.replace(/^\\//,'')),schema:u.searchParams.get('schema')||'public'});const src=ident(base);for(const k of ['host','hostaddr','port','dbname','options','search_path'])if(base.searchParams.has(k))throw Error();if(src.host!=='127.0.0.1'||src.port!==5432||src.database!=='entrenar'||src.schema!=='public')throw Error();const scratch=new URL(base.href);scratch.pathname='/entrenar_catalog_cutover_scratch';scratch.searchParams.set('schema','public');const dst=ident(scratch);if(dst.host!=='127.0.0.1'||dst.port!==5432||dst.database!=='entrenar_catalog_cutover_scratch'||dst.schema!=='public')throw Error();(async()=>{const c=new Client({connectionString:scratch.href});await c.connect();const current=await c.query('SELECT current_database() AS d,current_schema() AS s');if(current.rows[0].d!==dst.database||current.rows[0].s!=='public')throw Error();const ts=await c.query('SELECT table_schema,table_name FROM information_schema.tables WHERE table_type=$1 AND table_schema NOT IN ($2,$3) ORDER BY table_schema,table_name',['BASE TABLE','pg_catalog','information_schema']);for(const t of ts.rows){const n=q+t.table_schema.replaceAll(q,q+q)+q+'.'+q+t.table_name.replaceAll(q,q+q)+q;const r=await c.query('SELECT count(*)::bigint AS n FROM '+n);if(!(t.table_schema==='public'&&t.table_name==='_prisma_migrations')&&Number(r.rows[0].n)>0)throw Error()}const l=await c.query('SELECT count(*)::bigint AS n FROM pg_largeobject_metadata');if(Number(l.rows[0].n)>0)throw Error();await c.end();const env={...process.env,DATABASE_URL:scratch.href,CATALOG_CUTOVER_TEST_DATABASE_URL:scratch.href};delete env.DATABASE_URL_E2E;const r=spawnSync(process.execPath,[path.resolve('node_modules/jest/bin/jest.js'),'--config','./jest.integration.config.js','--runInBand','--runTestsByPath','test/catalog-cutover.integration-spec.ts'],{cwd:process.cwd(),env,stdio:'inherit'});if(r.error)throw Error();process.exitCode=r.status===null?2:r.status})().catch(()=>{console.error('Scratch preflight refused or integration runner failed; connection details suppressed.');process.exitCode=2})"
```

Prepared retry-safe invocation (not run by this executor): `node C:\Users\Nahuel\AppData\Local\Temp\opencode\catalog-cutover-scratch-test.cjs` from `backend`. The helper derives URLs from local `.env` using `URL`, validates source/scratch identities and actual connection, compares public tables to the canonical Prisma model list, and permits only known integration fixture primary/composite keys if rows remain. It then injects both DB URLs only into Jest's child process. It does not require an empty schema; `beforeEach` truncates the approved scratch database. `node --check` passed. No credentials are stored in the helper or printed; do not persist connection overrides in `.env` or global environment.

## Latest WU5.1 Integration Evidence

- First orchestrator run: 1 suite/4 failures from Product-before-Variant deferred trigger and unsupported pg catalog `char`; fixed by wrapping the complete fixture graph in a transaction and casting returned catalog text/char fields to text.
- Subsequent orchestrator run: 1 suite/4 failures from invalid TRACKED variant quantity and missing collateral blocker for a preserved ADMIN RefreshToken owned by a CUSTOMER user. Fixed fixture to `stockMode: TRACKED, quantity: 0`; added a fail-closed owner/session blocker without broadening candidate scope; added FK direction/Cascade assertions.
- Current code and integration spec pass TypeScript compilation. Integration rerun remains pending; no runner invoked by this executor. Latest scratch post-failure rows were not re-inspected; retry helper accepts only known fixture keys and uses the exact scratch DB.

## Remaining Tasks / Gates

- [ ] 2.1: rerun the newly added CUSTOMER-owner/ADMIN-session cascade unit regression.
- [ ] 5.1: execute disposable PostgreSQL integration cases with process-scoped scratch connection variables; the approved scratch DB is prepared, but no runner has executed.
- [ ] Work Unit 7: after assignment, create/validate private backup, restore only to isolated scratch, and audit the confirmed local target read-only.
- [ ] Work Unit 8: remains pending until separate explicit cleanup approval and all evidence prerequisites.
- [ ] Work Unit 9: remains pending until a separate explicit import approval and all cleanup/category-sync/preflight/assets prerequisites.

## Files Changed

| File | Action | Scope |
|---|---|---|
| `backend/src/modules/catalog-cutover/cutover-contracts.ts` | Created | Evidence, edge, attestation, and approval contracts |
| `backend/src/modules/catalog-cutover/catalog-cutover.repository.ts` | Created/modified | Complete snapshot, schema-FK comparison, and gated cleanup repository |
| `backend/src/modules/catalog-cutover/fixture-provenance.ts` | Created | Owner-attested classification and bounded dependency graph |
| `backend/src/modules/catalog-cutover/backup-rehearsal.ts` | Created | Private archive validation and isolated restore |
| `backend/src/modules/catalog-cutover/catalog-cutover.service.ts` | Created | Audit, backup, approval, cleanup, and reconciliation gates |
| `backend/src/modules/catalog-cutover/catalog-cutover.command.ts` | Created | Explicit CLI modes and sanitized output |
| `backend/src/modules/catalog-cutover/catalog-cutover.main.ts` | Created | CLI entry point |
| `backend/src/modules/catalog-cutover/catalog-cutover.spec.ts` | Created | Snapshot and classification unit cases |
| `backend/src/modules/catalog-cutover/backup-rehearsal.spec.ts` | Created | Backup safety unit cases |
| `backend/src/modules/catalog-cutover/catalog-cutover.command.spec.ts` | Created | CLI/evidence/approval unit cases |
| `backend/test/catalog-cutover.integration-spec.ts` | Created | Scratch-only cleanup integration cases; not run |
| `backend/package.json` | Modified | Added only `catalog:cutover`; preserved pre-existing edits |
| `openspec/changes/prd3-local-real-catalog-cutover/tasks.md` | Modified | Marked only assigned WU1–6 tasks complete |
| `openspec/changes/prd3-local-real-catalog-cutover/state.yaml` | Modified | Added apply-progress path and partial task counts |
| `openspec/changes/prd3-local-real-catalog-cutover/cutover-runbook.md` | Created | Operational handoff and recovery notes |
