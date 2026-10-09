# Local Catalog Cutover Runbook

## Scope and safety boundary

This runbook describes the approved local-only cutover workflow. Implementation Work Units 1–6 provide tooling and disposable-database proof; they do not authorize running a real-local cleanup, frozen import, R2 mutation, production operation, or inventory/CRM activity. Work Units 7–9 remain separate gates. Do not run `showcase:reset` as a cutover mechanism.

The only permitted target is `127.0.0.1:5432/entrenar`, schema `public`. The command derives the configured target and requires the exact fingerprint supplied with `--confirm-db-fingerprint`; it does not accept a database URL override. Stop storefront/admin writers and all background jobs before any eventual cleanup. Keep them stopped through cleanup and reconciliation.

## Required evidence and secrets

- Owner attestation is the approved classification basis for the initial existing local commercial population. No per-record fixture/provenance manifest is required. Missing or mismatched showcase fixtures are informational only; they cannot block classification or authorize cleanup.
- The attestation statement must be exactly: `All existing local commercial data is mock by owner attestation; no per-record fixture manifest is required.` The audit binds its candidate key/row-digest population to the audit ID and target fingerprint. Classification alone is not cleanup approval.
- Set `CATALOG_CUTOVER_HMAC_KEY` to a stable secret of at least 32 characters before audit, backup, or cleanup. Keep it out of source control, command output, and evidence files. Losing or rotating it prevents stable private row-reference comparison.
- Evidence v3 contains counts, HMAC row references/digests, typed edges, optional fixture-source names, and blocker codes. It must not contain raw customer data, credentials, connection strings, or unredacted selectors. Store approval and evidence artifacts in a protected local location; do not commit them.
- The archive must be a non-empty private regular file below `backend/backup/`, with private permissions where the platform exposes them, a recorded size/SHA-256, successful archive listing, scratch restore, exact full-snapshot comparison, and complete approved-selector coverage.
- `backend/backup/.gitignore` is tracked and contains `*` plus `!.gitignore`, so backup contents are ignored while the ignore file remains tracked. Backup rehearsal also checks the actual archive path with read-only `git check-ignore`; a matching rule is required before archive validation. No root ignore-file change is needed.

## Audit and backup rehearsal

After the repository ignore prerequisite and writer-quiescence requirements are met, build the backend, obtain the target fingerprint using the read-only target-information command, and retain it for every later mode. Audit is read-only and scans every schema model, including disconnected rows and preservation-only models, in stable 500-row keyset pages under RepeatableRead. It compares observed counts and live FK/delete effects with the canonical Prisma schema. Any incomplete scan, drift, malformed/unresolved reference, mixed ownership, unknown impact, or unmodeled effect is a blocker.

Run only explicit modes; the CLI has no default mode and no implicit write mode:

```text
npm --prefix backend run catalog:cutover -- --mode=audit --owner=<owner> --confirmed-at=<RFC3339> --statement="All existing local commercial data is mock by owner attestation; no per-record fixture manifest is required." --prd-sha256=<refined-prd-sha256> --confirm-db-fingerprint=<target-fingerprint>
npm --prefix backend run catalog:cutover -- --mode=backup --owner=<owner> --confirmed-at=<RFC3339> --statement="All existing local commercial data is mock by owner attestation; no per-record fixture manifest is required." --prd-sha256=<refined-prd-sha256> --archive=<absolute-private-archive-path> --scratch-database-url=<scratch-postgres-url> --confirm-db-fingerprint=<target-fingerprint>
```

The scratch database must be on the same local host/port as the target, have a distinct database name identifying it as scratch/test/disposable, and never alias `entrenar`. Restore uses the fixed `pg_restore` executable with an argument array, no shell, timeout, and credentials supplied via child-process environment rather than command arguments. Its output is not surfaced. The archive path is checked with read-only `git check-ignore`; an unignored file is rejected.

The report binds frozen run `run-20260928232548266-6ca4606a` and manifest SHA-256 `5093a00949525fec13f8814f680a51d50823e3748a3b1d3306c105f6aa218dd6`. Preserve the complete sanitized evidence and its digest separately from the owner attestation. Do not substitute a fixture manifest or report as an approval.

## Independent cleanup approval and cleanup

Cleanup requires a separately recorded explicit `kind: cleanup` approval from the owner. It must bind the attestation digest, evidence digest, selector digest, deletion digest, frozen run ID and manifest digest, and exact local target fingerprint. It also requires the successful private backup/restore evidence and zero audit blockers. Approval must be created only after reviewing the complete report and confirming writers are stopped. A missing, stale, mismatched, or unverified prerequisite means no cleanup.

Only after that separate approval exists may an operator invoke:

```text
npm --prefix backend run catalog:cutover -- --mode=cleanup --evidence-file=<approved-evidence-report> --attestation-file=<owner-attestation> --approval-file=<explicit-cleanup-approval> --confirm-db-fingerprint=<target-fingerprint>
```

The implementation acquires the established exclusive mutation gate and access-exclusive table locks, rescans the full population and FK evidence, rejects drift, and deletes only the exact approved selectors in dependent/child-first order. It verifies approved row absence, zero products, exactly 61 unchanged categories, and identical preserved-state digest before commit. Customer addresses are selected by `customerId`; fixture IDs do not replace the database key contract.

## Uncertain outcomes and recovery

Never retry cleanup after a timeout, connection loss, or uncertain receipt/commit outcome. Stop writers and use read-only reconciliation only:

```text
npm --prefix backend run catalog:cutover -- --mode=reconcile --evidence-file=<approved-evidence-report>
```

Reconciliation reports whether approved references are absent, products are empty, categories remain at 61, and preserved rows match. It does not mutate or retry. If evidence cannot establish a definitive outcome, stop and escalate to the database owner; do not infer success from process exit alone.

For full-backup recovery, first stop all writers/jobs, independently reconfirm the exact local destination, and obtain the appropriate recovery authorization. The rehearsal command deliberately refuses to restore into the active target. Use an approved database-operator recovery procedure, not a workaround or the normal cutover CLI, and validate the restored database read-only before resuming writers. Preserve the original archive and evidence for investigation.

## Frozen-import handoff

After a separately authorized cleanup, the existing category sync and importer remain authoritative and unchanged:

1. Synchronize the frozen run's categories using the existing bound category-sync command and the same confirmed target fingerprint. It requires an uploaded frozen run, matching frozen `categories.json` digest, and zero conflicts.
2. Run existing preflight and require persisted `PREFLIGHT_READY`. It checks target identity, frozen file digests, category slugs, an empty Product table, and the exact verified R2 asset set.
3. Obtain a second, independent `kind: import` approval bound to the same target, audit/evidence, successful cleanup receipt, run ID, and frozen manifest digest. Cleanup approval never authorizes import.
4. The cutover CLI `--mode=import` validates that independent approval and calls the existing read-only `assertManifestApproval` guard. It does not invoke the importer. Actual import is a later separately gated operation; never run it from Work Units 1–6.
5. Existing import writes remain transactional. A pre-commit failure must roll back all attempted product/variant/image/category-link rows. If import commits but receipt persistence fails, use read-only reconciliation and never blindly reimport.

Do not change the frozen run, source, manifest, or assets; do not reset, delete, upload, or reconcile R2 as part of this cutover. Verify the existing e2e/integration guard suites during the dedicated `sdd-verify` phase before any later operational phase. Production promotion requires its own independent target/evidence/approval gate and is not part of this local runbook execution.
