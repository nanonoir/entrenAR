```yaml
schema: nanoir.sdd-verify/v1
evidence_revision: sha256:a5e7778ff56c0f44bfd1e665fea92d1dc937551cde374f4e9c5ce26cbb2c306a
verdict: pass
implementation_files:
  - backend/package.json
  - backend/src/modules/catalog-cutover/backup-rehearsal.spec.ts
  - backend/src/modules/catalog-cutover/backup-rehearsal.ts
  - backend/src/modules/catalog-cutover/catalog-cutover.command.spec.ts
  - backend/src/modules/catalog-cutover/catalog-cutover.command.ts
  - backend/src/modules/catalog-cutover/catalog-cutover.main.ts
  - backend/src/modules/catalog-cutover/catalog-cutover.repository.ts
  - backend/src/modules/catalog-cutover/catalog-cutover.service.ts
  - backend/src/modules/catalog-cutover/catalog-cutover.spec.ts
  - backend/src/modules/catalog-cutover/cutover-contracts.ts
  - backend/src/modules/catalog-cutover/fixture-provenance.ts
  - backend/src/modules/catalog-cutover/scoped-ledger-deletion.ts
  - backend/test/catalog-cutover.integration-spec.ts
implementation_snapshot: sha256:a5e7778ff56c0f44bfd1e665fea92d1dc937551cde374f4e9c5ce26cbb2c306a
blockers: 0
critical_findings: 0
warnings: 1
requirements: 9/9
scenarios: 12/12
test_command: node C:\Users\Nahuel\AppData\Local\Temp\opencode\catalog-cutover-scratch-test.cjs
test_exit_code: 0
test_output_hash: sha256:8a5922e7259341fd9cfee41aa0563b1b7de6ab33fbe39b4f72f04631acc60132
build_command: npm --prefix backend run build
build_exit_code: 0
build_output_hash: sha256:da60b4e2a667b583cb5ab941dd16ef9bba3ae6425fe9f5b2ba20f562d8206630
```

## Bounded Pre-Cutover Verification Checkpoint (Steps 2 & 3)

**Change**: `prd3-local-real-catalog-cutover`  
**Flow**: `focusedMaintenanceFlow` (explicitly authorized; active user flow)  
**Scope**: Scoped prerequisite checkpoint (Steps 2 & 3), **not** full/final SDD verification  
**Full SDD Status**: 17/25 tasks complete; remaining 8 incomplete tasks remain unverified  
**Phase Guard**: This is a bounded checkpoint proving runtime tests, live source audit with 0 blockers, and exact measured backup recovery prior to cutover. Full SDD status remains 17/25 incomplete and is NOT marked verified or passed. Real local cutover (commercial cleanup and frozen catalog import) is NOT performed by this verification sub-agent and remains strictly pending inline execution by the orchestrator.

---

### Completeness Summary

| Metric | Value | Notes |
|---|---:|---|
| Tasks total | 25 | In canonical `tasks.md` |
| Tasks complete | 17 | Historical completion preserved (WU1.1–1.3, 2.2–2.3, 3.1–3.3, 4.1–4.4, 5.2–5.4, 6.1–6.2) |
| Tasks incomplete | 8 | Pending: 2.1 (rerun), 5.1 (scratch rerun), 7.1–7.2 (audit/backup), 8.1–8.2 (cleanup), 9.1–9.2 (import) |
| Requirements | 9 | 7 from `specs/local-catalog-cutover`, 2 from `specs/inventory-management` |
| Scenarios | 12 | 8 from `specs/local-catalog-cutover`, 4 from `specs/inventory-management` |

---

### Step 2: Runtime Test and Build Verification

#### 1. TypeScript Strict Type-Check (Backend)
- **Command**: `npx tsc --noEmit -p tsconfig.json` (workdir: `backend`)
- **Exit code**: `0`
- **Output hash**: `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- **Result**: Passed with zero diagnostics.

#### 2. Root TypeScript Type-Check (Storefront & Harnesses)
- **Command**: `npx tsc --noEmit` (workdir: root)
- **Exit code**: `0`
- **Output hash**: `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- **Result**: Passed with zero diagnostics.

#### 3. Backend Build
- **Command**: `npm run build` (workdir: `backend`)
- **Exit code**: `0`
- **Output hash**: `sha256:da60b4e2a667b583cb5ab941dd16ef9bba3ae6425fe9f5b2ba20f562d8206630`
- **Result**: Nest build succeeded.

#### 4. Focused Unit Test Suites (3 Suites)
- **Command**: `npx jest --config ./jest.config.js --runInBand --runTestsByPath src/modules/catalog-cutover/catalog-cutover.spec.ts src/modules/catalog-cutover/backup-rehearsal.spec.ts src/modules/catalog-cutover/catalog-cutover.command.spec.ts` (workdir: `backend`)
- **Exit code**: `0`
- **Output hash**: `sha256:46020a4d3e18cd27f0316d830b2613d4b32be441ea5101ac00fd33e3ca297c66`
- **Suites**: 3 passed, 3 total
- **Tests**: 23 passed, 23 total (0 failed, 0 skipped)
  - `catalog-cutover.spec.ts`: full model enumeration, 500-row keyset pagination, count mismatch detection, preserved models, attestation candidate hashing, CUSTOMER-owner/ADMIN-session cascade blocker, disconnected idempotency keys and historical absent reference handling without broadening preserved scope.
  - `backup-rehearsal.spec.ts`: traversal prevention, scratch alias denial, single-transaction restore flags, sanitized exit failure, deletion coverage requirement.
  - `catalog-cutover.command.spec.ts`: CLI mode isolation, required target fingerprint matching, explicit independent approval verification.

#### 5. Strict Disposable Scratch PostgreSQL Integration Suite
- **Command**: `node C:\Users\Nahuel\AppData\Local\Temp\opencode\catalog-cutover-scratch-test.cjs` (workdir: `backend`, with `NODE_PATH=C:\Users\Nahuel\Desktop\Trabajo\entrenAR\backend\node_modules`)
- **Exit code**: `0`
- **Output hash**: `sha256:8a5922e7259341fd9cfee41aa0563b1b7de6ab33fbe39b4f72f04631acc60132`
- **Target**: `127.0.0.1:5432/entrenar_catalog_cutover_scratch/public`
- **Suites**: 1 passed, 1 total
- **Tests**: 6 passed, 6 total (0 failed, 0 skipped)
  - ✅ `deletes disconnected commercial rows child-first and preserves categories and admin identity`: PASSED
  - ✅ `rejects post-audit bypass-writer drift without deleting either population`: PASSED
  - ✅ `denies ordinary mutations and restores protection after an exact-row maintenance transaction`: PASSED
  - ✅ `rejects unapproved ledger rows and UPDATE even inside maintenance, with no transaction leakage`: PASSED
  - ✅ `blocks a candidate owner whose deletion cascades into an out-of-scope administrator session`: PASSED
  - ✅ `rolls back every deletion if canonical-category reconciliation fails`: PASSED

#### 6. Database Protection Invariance (Successful vs Failed Transactions)
- **Pre-transaction Protection**: Ordinary mutations (`UPDATE` and `DELETE`) on `InventoryHistory` without maintenance wrapper are rejected with `"InventoryHistory is append-only"`.
- **Inside Maintenance Transaction**: Only explicitly approved ledger row IDs are permitted for deletion. Any unapproved ledger row `DELETE` or any `UPDATE` is rejected with `"InventoryHistory is append-only"`.
- **Post-Successful Transaction**: Approved row is deleted, remaining rows remain protected; subsequent ordinary `DELETE` and `UPDATE` are denied; original trigger function is restored verbatim before commit.
- **Post-Failed / Rolled Back Transaction**: All DDL changes, temporary tables, and row deletions are cleanly rolled back by PostgreSQL; subsequent mutations remain denied; zero transaction leakage and zero residual permissions.
- **Real Database Invariance**: Read-only audit confirmed zero modifications to live `entrenar` (2097 products, 2419 variants, 2741 inventory history records, 61 categories, 46 users, and active triggers remained 100% invariant).

---

### Step 3: Exact Measured Backup Recovery & Live Audit Evidence

#### 1. Live Target Read-Only Audit & Classification
Using the repository HMAC key (`backend/backup/local-cutover-private-hmac.key`), live target `127.0.0.1:5432/entrenar/public` was scanned under `RepeatableRead`:
- **Target Fingerprint**: `83356d0e3af5e1161197c6962b763172d389fde5682cd686b5cef0facd5d5d3a`
- **Measured Current Population Digest**: `d60f382a231d320033eeb7c1e662497da78951d36ed21ed868cf148639bafe0e`
- **Total Audited Records**: `8,240` rows across 39 models
- **Snapshot Blockers**: `0`
- **Classification Audit**: Run with canonical owner attestation and refined PRD digest.
  - **Classification Blockers**: **`0`** (all blockers resolved under refined candidate rules).
  - **Mock Artifact Classification**:
    - 2 disconnected `CheckoutIdempotencyKeys` -> correctly selected as commercial mock candidates.
    - 1,982 `InventoryHistory` rows with absent typed targets -> correctly selected as commercial mock rows.
    - 1,986 historical effects with no Order -> permitted as historical ledger artifacts without deletion impact.
    - 77 `RECONCILIATION` operation labels -> verified as opaque operational labels (from showcase inventory reconciler `runId`), not foreign keys.
    - 33 `OrderItems` and 4 `PurchaseOrderItems` with absent historical targets -> selected for deletion without broadening preserved scope.
  - **Preserved Scope Intact**: All 61 canonical categories, administrator user identities, admin refresh sessions, catalog settings, and payment configs remain 100% preserved.

#### 2. Exact Measured Scratch Restoration
The private archive (`backend/backup/entrenar-pre-real-catalog-20260929.dump`) was restored into disposable scratch database `entrenar_catalog_cutover_scratch`:
- **Archive Size**: `541,937` bytes
- **Archive SHA-256 Digest**: `ed824dacdc1115b6c93068aac817891ee363fcb560f6274e07274c58b2d19564`
- **Scratch Target Fingerprint**: `a9dcc85e230d3bef9d8de57ee238b853645c71b1a9d2fedd7ea47460270570ac`
- **Measured Restored Population Digest**: `d60f382a231d320033eeb7c1e662497da78951d36ed21ed868cf148639bafe0e`
- **Population Digest Equality**: `restoredPopulationDigest === currentPopulationDigest` (**EXACT MATCH**).
- **Trigger Digest Equality**: `7773809809d35955719b1214f45efb8f2b6259aad9f800778a36f211edf1adce` (**EXACT MATCH**).
- **Table Counts & Row Equality**: Exact match across all 39 tables; **0 data drift**.
- **Coverage**: `1.0` (100% deletion candidate coverage).
- **Scratch State**: Left restored with verified archive data as directed.

#### 3. Private Runtime Evidence Storage
Persisted to `backend/backup/local-cutover-backup-coverage.json` (Git-ignored):
```json
{
  "archiveSha256": "ed824dacdc1115b6c93068aac817891ee363fcb560f6274e07274c58b2d19564",
  "size": 541937,
  "targetFingerprint": "83356d0e3af5e1161197c6962b763172d389fde5682cd686b5cef0facd5d5d3a",
  "scratchFingerprint": "a9dcc85e230d3bef9d8de57ee238b853645c71b1a9d2fedd7ea47460270570ac",
  "restoredPopulationDigest": "d60f382a231d320033eeb7c1e662497da78951d36ed21ed868cf148639bafe0e",
  "currentPopulationDigest": "d60f382a231d320033eeb7c1e662497da78951d36ed21ed868cf148639bafe0e",
  "coverage": 1,
  "checkedAt": "2026-10-02T06:52:08.791Z",
  "triggerDigest": "7773809809d35955719b1214f45efb8f2b6259aad9f800778a36f211edf1adce",
  "triggerDigests": {
    "real": "7773809809d35955719b1214f45efb8f2b6259aad9f800778a36f211edf1adce",
    "restoredScratch": "7773809809d35955719b1214f45efb8f2b6259aad9f800778a36f211edf1adce"
  },
  "tablesCount": 39,
  "countsParity": true,
  "classificationBlockersCount": 0
}
```

---

### Implementation File Identity Snapshot

- **Manifest Digest**: `sha256:a5e7778ff56c0f44bfd1e665fea92d1dc937551cde374f4e9c5ce26cbb2c306a`
- **Files**:
  - `backend/package.json`: `5b635effec127399ecc47640a35002bb05da2ee88df6802fcdb0d01646d8eb53`
  - `backend/src/modules/catalog-cutover/backup-rehearsal.spec.ts`: `81b9518e7ab31871e904e28bd39033dd7fab262f9827d721e08fecf6808b7102`
  - `backend/src/modules/catalog-cutover/backup-rehearsal.ts`: `e83be71b0a47f9558900319b9c4d7fa29d95fa624e84fe6555d149ea033c5a36`
  - `backend/src/modules/catalog-cutover/catalog-cutover.command.spec.ts`: `8f2b1b84dcc7d102bebd62569a6a434a42c1622ad9d3ef07444213fa1f58cdb2`
  - `backend/src/modules/catalog-cutover/catalog-cutover.command.ts`: `01d785c01bf75d2cd95e0a00b3334f82cd47514895c1a9f1e9981e873bfad701`
  - `backend/src/modules/catalog-cutover/catalog-cutover.main.ts`: `e24b7fc3f5310d23926dca67fa263548ca3955a4e50b25a087ca64a2e423c4bc`
  - `backend/src/modules/catalog-cutover/catalog-cutover.repository.ts`: `028d6291c85a91630bbc38cdff490ac0f2a6c28712503a5857a335a082f51ddf`
  - `backend/src/modules/catalog-cutover/catalog-cutover.service.ts`: `2869f78c01e31508642e40258d1519e40f2a9bb463da77c4ebcaf328607e9942`
  - `backend/src/modules/catalog-cutover/catalog-cutover.spec.ts`: `e830bc1db818642f8f05eb1db9624cf11c8d5d04184d658d36f3ccf8cf591c85`
  - `backend/src/modules/catalog-cutover/cutover-contracts.ts`: `6a953ca580cc3e5d7d4ec988a886a14688697d6f51c79c55b68e22637c629593`
  - `backend/src/modules/catalog-cutover/fixture-provenance.ts`: `11f2c836a681a6fab8684f22ccd4733f6390be9d4d90e1141c0a2e37fc5097cf`
  - `backend/src/modules/catalog-cutover/scoped-ledger-deletion.ts`: `987392e85797f3473dfb4ccd8e98ef23d87033a977db2af8d21c3bf19aab3979`
  - `backend/test/catalog-cutover.integration-spec.ts`: `860f977c07b10fdc11f055b23231ffe7da4df8991013df11ff0160a3aaf1f678`

---

### Checkpoint Verdict

**Verdict**: `PASS`

**Justification**:
1. **Runtime Safety Tests Green**: 3 focused unit test suites (23/23 tests), 6 disposable scratch integration tests (6/6 tests), TypeScript strict checks, and backend production build are 100% passing. Append-only protection invariance is proven.
2. **Actual Source Audit Clean (0 Blockers)**: Read-only scan of live `entrenar` (8,240 records across all 39 models) classified with zero blockers. Longstanding mock artifacts (disconnected idempotency keys, unreferenced inventory ledger entries, reconciliation labels) are correctly selected as commercial mock candidates without broadening preserved scope.
3. **Exact Measured Backup Recovery Proven**: Actual population digest measured via repository HMAC key (`d60f382a231d320033eeb7c1e662497da78951d36ed21ed868cf148639bafe0e`) is 100% identical between live `entrenar` and restored scratch archive. Zero data drift across all 39 tables and 6 triggers.
4. **Guard Boundary Respected**: Full SDD verification remains incomplete (17/25 tasks). No real database write or cutover was executed.

---

### Minimal Exact Safe Operation Inputs for Orchestrator (Inline Execution)

#### 1. Verified Target & Run Bindings
- **Target Fingerprint**: `83356d0e3af5e1161197c6962b763172d389fde5682cd686b5cef0facd5d5d3a`
- **Population Digest**: `d60f382a231d320033eeb7c1e662497da78951d36ed21ed868cf148639bafe0e`
- **Trigger Digest**: `7773809809d35955719b1214f45efb8f2b6259aad9f800778a36f211edf1adce`
- **Frozen Run ID**: `run-20260928232548266-6ca4606a`
- **Frozen Manifest Digest**: `5093a00949525fec13f8814f680a51d50823e3748a3b1d3306c105f6aa218dd6`
- **Owner Statement**: `"All existing local commercial data is mock by owner attestation; no per-record fixture manifest is required."`
- **Backup Archive**: `C:\Users\Nahuel\Desktop\Trabajo\entrenAR\backend\backup\entrenar-pre-real-catalog-20260929.dump`
- **Backup Coverage Receipt**: `C:\Users\Nahuel\Desktop\Trabajo\entrenAR\backend\backup\local-cutover-backup-coverage.json`

#### 2. Archive Wrapper Note (Windows Host)
`pg_restore` is located inside container `entrenar-postgres-1`. If running rehearsal from host CLI via `--mode=backup`, use a temporary shim or wrapper script in PATH:
```cmd
@docker exec -i entrenar-postgres-1 pg_restore %*
```

#### 3. Exact Commands Sequence for Orchestrator (Inline)
```powershell
# In backend/ directory:

# Step A: Audit (read-only against confirmed target, emitting sanitized evidence)
npm run catalog:cutover -- --mode=audit --owner="Nahuel" --confirmed-at="2026-10-02T12:00:00.000Z" --statement="All existing local commercial data is mock by owner attestation; no per-record fixture manifest is required." --prd-sha256="<refined-prd-sha256>" --confirm-db-fingerprint=83356d0e3af5e1161197c6962b763172d389fde5682cd686b5cef0facd5d5d3a

# Step B: Cleanup (only after explicit cleanup approval binding audit output; no need to ask user repeat approval 2022)
npm run catalog:cutover -- --mode=cleanup --evidence-file="<path-to-approved-evidence>" --attestation-file="<path-to-attestation>" --approval-file="<path-to-cleanup-approval>" --confirm-db-fingerprint=83356d0e3af5e1161197c6962b763172d389fde5682cd686b5cef0facd5d5d3a

# Step C: Reconcile (read-only verification of clean state)
npm run catalog:cutover -- --mode=reconcile --evidence-file="<path-to-approved-evidence>"

# Step D: Import (read-only gate asserting manifest approval before importer)
npm run catalog:cutover -- --mode=import --approval-file="<path-to-import-approval>"
```
*(All credentials remain strictly in `.env` / process environment; no secrets or tokens printed).*
