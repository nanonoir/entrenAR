# Local Cutover Execution Receipt

## Authorization and Prerequisites

The owner explicitly approved the focused flow: inline correction, delegated isolated tests and backup restoration, inline bounded cleanup/import after both pass, then delegated final data and Playwright verification. No production, R2 mutation, role provisioning, database drop, or Git delivery was authorized.

Pre-cutover checkpoint passed: 23 unit tests and 6 disposable PostgreSQL integration tests. The existing private archive was restored and its measured population digest matched the live database exactly. The scope audit had zero blockers.

## Bindings

- Database: `127.0.0.1:5432/entrenar/public`.
- Fingerprint: `83356d0e3af5e1161197c6962b763172d389fde5682cd686b5cef0facd5d5d3a`.
- Run: `run-20260928232548266-6ca4606a`.
- Manifest SHA-256: `5093a00949525fec13f8814f680a51d50823e3748a3b1d3306c105f6aa218dd6`.
- Verified archive SHA-256: `ed824dacdc1115b6c93068aac817891ee363fcb560f6274e07274c58b2d19564`.
- Audited population digest: `d60f382a231d320033eeb7c1e662497da78951d36ed21ed868cf148639bafe0e`.

## Cleanup

- Completed at `2026-10-02T07:02:00.421Z`.
- Deleted 8,007 enumerated commercial mock records in one transaction.
- Preserved 233 audited administrative/category/configuration records.
- Preserved digest: `9a5f6a8d31f2e15442088d932223036d60ef0328f9876460de9df7003d0528aa`.
- Reconciliation: `ok: true`, no blockers; zero products and 61 categories before import.
- Original append-only function restored before commit; no persistent schema migration or trigger disable/drop.

## Import

- Existing frozen-run preflight returned `PREFLIGHT_READY`, no blockers, 3,790 expected R2 objects verified read-only.
- Existing importer command/service/repository and independent evidence-bound import approval used; no full Nest bootstrap or fixture reset.
- Import reported success: 649 products, 1,119 variants, 3,790 images, 2,124 category links.
- Immediate importer reconciliation: `matches: true`, `mismatches: []`, all counts identical to the frozen manifest.
- Existing R2 assets were neither uploaded nor deleted.

## Evidence and Next Gate

Private approvals, backup coverage, audit, cleanup and import receipts are under Git-ignored `backend/backup/local-cutover-*.json`; HMAC key is separate private material and must not be printed or committed. Operational helper is in the preapproved temporary directory, not application source.

Final independent data and Playwright functional verification is pending. This execution receipt is not a final SDD verification or archive result. Historical core SDD progress must not be marked fully verified merely because operational import succeeded.
