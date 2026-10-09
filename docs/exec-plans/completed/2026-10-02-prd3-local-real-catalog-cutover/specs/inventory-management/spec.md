# Delta for Inventory Management

## ADDED Requirements

### Requirement: Scoped Local Ledger Deletion Exception
The database MUST deny ordinary ledger UPDATE/DELETE, permitting only exact approved mock-row DELETE on the confirmed local target within one audited cleanup transaction. Backup, scope/dependencies, fingerprint, approval and drift gates MUST hold; immutable fields, normal operations, importer/reset/compensation contracts remain unchanged outside this exception. Privileges/mechanism belong to design.

#### Scenario: Exact approved deletion
- GIVEN restored backup and valid target/scope approval
- WHEN the bound transaction deletes selected ledger rows
- THEN only those rows disappear and ADMIN/category/configuration state survives

#### Scenario: Unauthorized mutation
- GIVEN ordinary operations, wrong row/target, UPDATE, missing/stale/replayed approval, or drift
- WHEN mutation is attempted
- THEN the database denies it without ledger or preserved-state changes

### Requirement: Transaction Isolation and Rollback
Permission MUST NOT leak across sessions/transactions or authorize concurrent writers. Failed gates/transactions MUST roll back cleanup and leave no residual permission.

#### Scenario: Concurrent or subsequent caller
- GIVEN an authorized cleanup transaction
- WHEN another session or subsequent transaction attempts deletion
- THEN it is denied without its own fresh bound approval

#### Scenario: Rollback
- GIVEN approved deletions started
- WHEN a later gate/write fails
- THEN all cleanup writes roll back and subsequent unapproved mutation is denied
