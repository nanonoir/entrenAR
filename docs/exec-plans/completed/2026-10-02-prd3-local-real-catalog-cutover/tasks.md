# Tasks: Local Real Catalog Cutover

## Work Unit Plan

| Unit | Goal | Tasks | Estimated Code Additions | Focused Test | Runtime Harness | Rollback Boundary |
|---|---|---|---:|---|---|---|
| 1 | Read complete catalog-cutover snapshot | 1.1-1.3 | ~350 | `npm run test:backend` | Read-only disposable-DB scan | Remove typed reader and unit tests |
| 2 | Classify owner-attested population and dependency graph | 2.1-2.3 | ~390 | `npm run test:backend` | Read-only fixture-free audit | Remove classification module and tests |
| 3 | Rehearse private backup in isolated scratch DB | 3.1-3.3 | ~250 | `npm run test:backend` | Scratch DB only; never active target | Remove rehearsal adapter and tests |
| 4 | Add CLI, evidence contracts, and independent approval gates | 4.1-4.4 | ~330 | `npm run test:backend` | Dry/read-only CLI only | Remove command/service/contracts/script |
| 5 | Execute bounded atomic cleanup with integration proof | 5.1-5.4 | ~390 | `npm run test:backend:integration` | Disposable PostgreSQL only | Remove cleanup extension and integration tests |
| 6 | Document frozen-import handoff and operational recovery | 6.1-6.2 | ~20 | `npm run test:backend:e2e` | Existing guards; no import | Revert runbook and focused checks |
| 7 | Produce real-local backup, restore, and read-only audit evidence | 7.1-7.2 | ~0 | N/A | Confirmed local target read-only; restore to scratch | No target mutation |
| 8 | Perform separately approved real-local cleanup | 8.1-8.2 | ~0 | N/A | GATED: explicit cleanup approval | Full-backup recovery after stopping writers |
| 9 | Separately approve frozen import and reconcile outcome | 9.1-9.2 | ~0 | N/A | GATED: explicit import approval | Import transaction rollback; receipt failure read-only |

## Architecture Risk Forecast

| Field | Value |
|---|---|
| New responsibilities added to existing modules | Medium — isolated backend capability; importer/reset remain unchanged |
| Cross-module/layer changes | High — CLI, Prisma reads/transactions, scratch restore, and existing import handoff |
| Existing structurally overloaded modules touched | No |
| Existing abstractions to reuse | `mutation-gate.ts`; `showcase-fixture-manifest.ts` read-only; `database-target.ts`; `preflight.command.ts`; `catalog-import/approval.ts` |
| Local extraction/refactor required | No — importer/reset refactors are forbidden |

Architecture decision needed before apply: No

## Work Unit 1: Read the complete snapshot and relationship evidence

- [x] 1.1 Add RED cases in `backend/src/modules/catalog-cutover/catalog-cutover.spec.ts` for full model enumeration, disconnected rows, stable 500-row primary/composite-key pagination, count equality, and preserved-model coverage. Final focused unit rerun passed the exact model list, composite cursor, preserved row, disconnected row, and count-mismatch cases.
- [x] 1.2 Implement typed read-only snapshot queries in `catalog-cutover.repository.ts` under RepeatableRead: scan every row without seed filters, page by keys, privately digest full rows, and enumerate/hash remaining models as preserved.
- [x] 1.3 Verify exact typed edge extraction inputs and schema-FK/delete-effect comparison against `backend/prisma/schema.prisma`; unmodeled effects become blockers, not expanded scope.

## Work Unit 2: Classify the bounded population and dependency closure

- [ ] 2.1 Add RED cases for owner attestation without manifests, missing/mismatched optional fixtures, classification-versus-approval, `CustomerAddress.customerId` selectors, malformed JSON references, and mixed/out-of-scope ownership. Added a CUSTOMER-owner/ADMIN-session cascade regression; its latest fixture has TypeScript compile evidence but awaits focused test rerun.
- [x] 2.2 Implement `fixture-provenance.ts`: bind `owner-attestation` only to initial candidate keys/digests; use fixture sources as optional evidence, never requirements or classification inference from names/adjacency.
- [x] 2.3 Parse specified snapshots/history metadata; resolve typed references with indexed-map fixed-point traversal and visited keys. Block unresolved/malformed impact, ownership/compensation cycles, mixed ownership, and outside-scope delete effects; never widen attested scope.

## Work Unit 3: Validate backup and isolated restore

- [x] 3.1 Add RED cases in `backend/src/modules/catalog-cutover/backup-rehearsal.spec.ts` for metacharacter injection, scratch/target alias, unsafe paths, timeout, nonzero exit, inadequate deletion coverage, and secret redaction. Final focused unit rerun passed both timeout-like and injected code-1 sanitized failure cases.
- [x] 3.2 Implement `backup-rehearsal.ts` to validate private archive path, size/hash/contents, scratch identity, restored schema/rows, and deletion coverage using fixed executable/argument arrays and no shell.
- [x] 3.3 Refuse active-target restore and unsafe output; keep runtime backup material under Git-excluded `backend/backup/` only.

## Work Unit 4: Expose explicit CLI modes, evidence, and approvals

- [x] 4.1 Add RED cases in `catalog-cutover.spec.ts` for target override/drift, evidence tampering, missing/stale cleanup approval, dry/read-only modes, and sanitized output. The focused CLI/evidence suite passed; coverage limitations are recorded in `apply-progress.md`.
- [x] 4.2 Define Evidence v3, `AuditRow`, `AuditEdge`, attestation, and separate cleanup/import approval contracts in `cutover-contracts.ts`; canonicalize digests and HMAC row references without exposing keys or customer data.
- [x] 4.3 Implement service gates and command argument/mode handling in `catalog-cutover.service.ts` and `catalog-cutover.command.ts`; reuse `database-target.ts`, `preflight.command.ts`, and `catalog-import/approval.ts` read-only. Service owns gates, not SQL/process construction; CLI never bootstraps the full app or writes implicitly.
- [x] 4.4 Add an explicit backend CLI script in `backend/package.json`; prove audit/backup/cleanup/import are distinct modes and each mutation requires its own bound approval.

## Work Unit 5: Implement approved atomic cleanup and disposable-DB proof

- [ ] 5.1 Add RED cases in `backend/test/catalog-cutover.integration-spec.ts` for drift, post-audit rows, disconnected records, outside-scope FK effects, preservation, compensation ordering, rollback, and concurrent/bypass writers. First approved scratch run failed 4/4; fixture/checker corrections are applied and await rerun against the exact disposable DB.
- [x] 5.2 Extend `catalog-cutover.repository.ts` to acquire the established mutation gate/exclusive locks, re-audit rows/edges/fingerprint, and delete only approved keys in child/compensation-dependent-first order.
- [x] 5.3 Assert approved absence, zero products, 61 canonical categories, and equality of preserved state before commit; reject any mismatch and keep database writes out of classification/CLI layers.
- [x] 5.4 On uncertain commit/receipt outcome, allow read-only reconciliation only; never retry cleanup. Integration runs use disposable PostgreSQL, never the real target.

## Work Unit 6: Document and verify the frozen-import handoff

- [x] 6.1 Create change-local `cutover-runbook.md` covering target/quiescence, backup/restore/recovery, audit evidence, independent approvals, stop/reconcile behavior, and separately gated production promotion.
- [x] 6.2 Verify existing category sync, `PREFLIGHT_READY`, import/receipt guards, and late-failure rollback preserve the frozen run `run-20260928232548266-6ca4606a` / SHA-256 `5093a00949525fec13f8814f680a51d50823e3748a3b1d3306c105f6`; the safe focused mocked guard suites passed. No database/R2 E2E or integration harness was run.

## Work Unit 7: Gather actual local evidence without writes

- [ ] 7.1 After Units 1-6, validate the complete private backup and restore only to scratch; run the full read-only local audit and privately record fingerprint, coverage, and sanitized evidence.
- [ ] 7.2 Require complete scope, zero blockers, stopped writers, and confirmed `127.0.0.1:5432/entrenar/public`; missing/mismatched manifests alone do not block. Do not modify the target or request/assume approval when audit evidence is incomplete.

## Work Unit 8: Perform approved cleanup on the real local database

- [ ] 8.1 Remain pending until explicit user cleanup approval binds the audited scope/evidence/selector/deletion digests and confirmed target; reject drift, ambiguity, non-local target, or active writers.
- [ ] 8.2 Run only that approved atomic cleanup; verify approved records absent, Product empty, 61 categories and preserved state equal. No production/R2 writes.

## Work Unit 9: Import frozen catalog and reconcile

- [ ] 9.1 Remain pending until a separate explicit user import approval, successful cleanup, category sync, `PREFLIGHT_READY`, target recheck, and verified assets; invoke only the existing importer with the frozen manifest.
- [ ] 9.2 Reconcile manifest counts/references, 3,790 existing R2 assets, public/admin reads, and every image URL; require transactional rollback or read-only receipt reconciliation, never blind retry.
