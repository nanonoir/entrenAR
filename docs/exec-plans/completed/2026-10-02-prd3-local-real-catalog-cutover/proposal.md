# Proposal: Local Real Catalog Cutover

## Intent
Replace owner-attested local mock commerce with the frozen real catalog while preserving recoverability, taxonomy, administrators, configuration and R2.

## Scope
### In Scope
- Validate private backup and isolated restoration.
- Enumerate commercial candidates/dependencies; accept attestation without per-record manifests.
- Separately approve bounded cleanup preserving unrelated/post-audit records and administrative/configuration state.
- Design database-enforced local-only transaction-bound deletion of exact approved mock ledger rows.
- Require `PREFLIGHT_READY` and separately approved atomic import.
- Verify counts/references/assets/public/admin reads; document future production gates.

### Out of Scope
- Re-scraping, manifest changes, R2 writes or production import.
- New inventory/sales/orders/CRM activity.
- Database-wide reset or unrelated deletion/configuration changes.

## Capabilities
### New Capabilities
- `local-catalog-cutover`: Backup/restore, attested audit, separately approved cleanup, drift rejection, preservation and verification.

### Modified Capabilities
- `inventory-management`: Exact-approved-row ledger deletion exception; ordinary UPDATE/DELETE denied. Require database-backed local/transaction authorization, wrong-row/target/stale/replayed-approval denial, concurrency isolation, rollback and no permission leakage.

Importer safety, showcase retention and sales compensation remain unchanged.

## Approach
Restore → audit → approved cleanup → preflight → approved import → reconciliation. Bind the PRD's frozen run/digest to `127.0.0.1:5432/entrenar/public`. Attestation classifies, not authorizes. Recheck dependencies/preservation/drift/schema-policy evidence under locks. Prospective migration planning only; privileges belong to design/tasks. No historical migration edits, trigger disable/drop, unrestricted GUC/replication bypass, real truncation or showcase reset. Real migration/cleanup/import require independent approvals; scratch authorization remains unchanged.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `backend/backup/` | Modified | Private evidence |
| `backend/src/modules/catalog-cutover/` | Modified | Scoped orchestration |
| `backend/prisma/migrations/<new>_scoped_fixture_ledger_cleanup/migration.sql` | New | Prospective; planning only |
| `backend/test/` | Modified | Boundary/preservation/rollback proofs |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Scope/privilege leakage | High | Bound evidence; database enforcement; scratch denial proofs |
| Wrong target/unrestorable backup | Med | Fingerprint; isolated restore |
| Commit/receipt mismatch | Med | Read-only reconciliation; no blind retry |

## Rollback Plan
Failed cleanup/import rolls back writes without residual permission. Design prospective migration rollback restoring unconditional append-only enforcement without historical edits or trigger disabling. Reverse completed cutover by stopping local writes and restoring the validated full pre-cleanup archive to the reconfirmed target. Reconcile receipts; never mutate R2.

## Dependencies
- Restorable backup, attestation, audited scope, independent approvals, importer safety, frozen run/manifest, 61 categories and 3,790 assets.

## Success Criteria
- [ ] Restore/audit pass; drift or ambiguous impact blocks cleanup; preserved state remains intact.
- [ ] Scratch proofs cover approved deletion, ordinary/wrong-row/target/approval denial, concurrency, rollback and transaction isolation.
- [ ] Empty target reaches preflight readiness; confirmed import matches manifest/references/public/admin/image reads; late failure leaves no partial catalog.
- [ ] No forbidden writes/activity; lint/typecheck/backend/integration tests/builds pass.
