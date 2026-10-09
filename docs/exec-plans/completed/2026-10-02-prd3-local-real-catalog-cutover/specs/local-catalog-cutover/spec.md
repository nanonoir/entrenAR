# Local Catalog Cutover Specification

## Purpose
Recoverable local replacement.

## Requirements

### Requirement: Recoverable Private Backup
Cleanup MUST require complete private Git-excluded `backend/backup/` backup, size/SHA-256, archive validation and isolated restoration.

#### Scenario: Backup gate
- GIVEN a pre-cleanup archive
- WHEN validation/restoration passes or fails
- THEN failure blocks deletion

### Requirement: Complete Scope and Classification Audit
Read-only audit MUST enumerate catalog/inventory/cart/checkout/order/snapshot/CRM/customer/sales scope/counts/dependencies bound to target/audit. Attestation classifies existing local commerce without per-row manifests, not verifies/authorizes; reports MUST include available fixture evidence without credentials/customer data.

#### Scenario: Attested population
- GIVEN attestation without manifests
- WHEN auditing
- THEN enumeration succeeds without mutation

### Requirement: Fail-Closed Approved Cleanup
Cleanup MUST require separate scope/fingerprint approval for `127.0.0.1:5432/entrenar/public`, restored backup and database-enforced exact-row ledger exception. Unknown classification, ambiguous impact, unverified preservation or drift MUST block deletion. Broad/showcase reset, real truncation, trigger disable/drop, unrestricted flags/GUC/replication bypass and historical migration edits MUST NOT occur. Real migration/cleanup/import require independent approvals, not scratch authorization.

#### Scenario: Approved scope
- GIVEN all gates satisfied
- WHEN cleanup commits
- THEN only enumerated approved mock records/dependencies disappear

#### Scenario: Invalid gate
- GIVEN missing gates or target/scope/dependency/schema-policy drift
- WHEN cleanup starts
- THEN no deletion occurs

### Requirement: Preserved State
Cleanup MUST preserve 61 canonical categories, ADMIN identities/access/sessions, configuration, outside-scope/post-audit records and snapshots unless attested and explicitly approved.

#### Scenario: Preservation
- GIVEN approved cleanup
- WHEN completing or detecting post-audit records
- THEN preservation holds; drift blocks cleanup

### Requirement: Frozen Local Import Handoff
Run `run-20260928232548266-6ca4606a`, digest `5093a00949525fec13f8814f680a51d50823e3748a3b1d3306c105f6aa218dd6` MUST remain frozen. Unchanged importer contracts MUST govern idempotent sync, `PREFLIGHT_READY`, separate run/digest/fingerprint approval and transactional empty-Product recheck.

#### Scenario: Import gate
- GIVEN synchronized categories, verified assets and zero products
- WHEN approved preflight/import runs or evidence changes
- THEN valid gates permit exact import; otherwise no writes

### Requirement: Atomic Failure and Recovery
Failed cleanup/import MUST roll back writes/permissions. Committed receipt failure MUST require read-only reconciliation, never blind retry; restoration MUST require stopped writes/reconfirmed target.

#### Scenario: Failure handling
- GIVEN cleanup/import writes
- WHEN precommit failure or committed receipt failure occurs
- THEN rollback or read-only reconciliation applies, respectively

### Requirement: Verified Outcome and Deferred Operations
Verification MUST reconcile manifest counts/references, 3,790 assets, public/admin reads and every image URL. Run/source/assets/R2 mutation, production import and new inventory/sales/orders/CRM activity MUST NOT occur; notes MUST gate future production promotion separately.

#### Scenario: Outcome
- GIVEN committed import
- WHEN verifying
- THEN counts/references/images match without forbidden operations
