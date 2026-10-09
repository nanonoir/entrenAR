# Inventory Sales Transactions Specification

## Purpose

Defines auditable inventory restoration caused by sales cancellation and purchase-order receipt.

## Requirements

### Requirement: Cancellation Stock Restoration

The system MUST restore stock atomically only when `restoreStock: true`, the Order is `LEDGER_MANAGED`, and referenced uncompensated deductions exist. Restoration MUST derive exact targets and quantities from those movements and append one immutable uniquely linked compensation movement per deduction. `restoreStock: false` MUST not change inventory. `NOT_APPLICABLE` MUST perform no inventory operation; `UNKNOWN` and `TRANSFERRED` MUST reject restoration with controlled 409 conflicts.

#### Scenario: Restore on cancellation
- GIVEN a cancellable ledger-managed sale with outstanding deductions and `restoreStock: true`
- WHEN an ADMIN cancels the sale
- THEN exact stock is restored and linked cancellation movements are committed atomically

#### Scenario: Do not restore
- GIVEN a cancellable sale and `restoreStock: false`
- WHEN an ADMIN cancels the sale
- THEN no inventory quantity or movement is changed

#### Scenario: Duplicate cancellation race
- GIVEN two restoration cancellations race for one outstanding deduction
- WHEN both commands execute
- THEN at most one succeeds and stock is restored once

### Requirement: Purchase Receipt Inventory Movements

The system MUST append an immutable inventory movement with origin `purchase_order` for every stock increment caused by receiving a purchase order.

#### Scenario: Receipt audit
- GIVEN an ORDERED purchase order with multiple items
- WHEN it is received
- THEN every increment has exactly one `purchase_order` movement linked to that order

### Requirement: Authoritative Referenced Inventory Ledger

`InventoryHistory` MUST be the sole authority for exact inventory effects, targets, quantities, and compensation eligibility. Business movements MUST carry nullable structured reference, operation, effect, kind, and compensation-link metadata; human-readable origin/reason MUST NOT establish an invariant. Every restoration MUST link to one exact deduction, and a deduction MUST have at most one compensation. Reopen MUST create new deductions under the same effect; it MUST NOT reactivate old movements.

#### Scenario: Exact compensation
- GIVEN an effect has two outstanding product or variant deductions
- WHEN its owner cancels with restoration
- THEN one restoration per deduction links to that deduction and no other target is changed

#### Scenario: Changed catalog target
- GIVEN a referenced deduction target becomes incompatible or unavailable
- WHEN automatic restoration or re-deduction is requested
- THEN the operation MUST return a controlled conflict without guessed stock changes

### Requirement: Exclusive Inventory Effect Ownership

An Order MUST use `UNKNOWN`, `NOT_APPLICABLE`, `LEDGER_MANAGED`, or `TRANSFERRED` policy. Only `LEDGER_MANAGED` MAY hold one current effect identity; no effect may have multiple owners. `UNKNOWN`, `NOT_APPLICABLE`, and `TRANSFERRED` MUST hold no ownership pointer. `UNKNOWN` and `TRANSFERRED` MUST fail closed for inventory-changing commands.

#### Scenario: Atomic transfer
- GIVEN a ledger-managed source order is converted to a sale
- WHEN conversion succeeds
- THEN the source becomes TRANSFERRED and the destination exclusively owns the same effect atomically

#### Scenario: Fail-closed source
- GIVEN an UNKNOWN or TRANSFERRED order
- WHEN cancellation with restoration or reopen is requested
- THEN the system MUST return 409 and leave order and inventory unchanged

### Requirement: Historical Migration and Reconciliation

Data-preserving migration MUST classify historical Orders as `UNKNOWN` with no effect pointer; it MUST NOT infer policy from current catalog state, order numbers, or free text. Reconciliation MUST require an authorized operator decision and immutable baseline movements that identify exact targets, quantities, and outstanding/compensated state without changing stock.

#### Scenario: Historical order safeguard
- GIVEN a pre-migration order without provable movements
- WHEN automatic restoration or reopen is requested
- THEN it is blocked until explicit reconciliation assigns a valid effect owner

### Requirement: Showcase Canonical Stock Reconciliation

The system MUST restore explicit canonical tracked product and variant stock through an auditable reconciliation with `origin=showcase-reset` and `referenceType=RECONCILIATION`. It MUST retain existing inventory history and MUST NOT infer targets or alter unknown stock.

#### Scenario: Reconcile canonical stock
- GIVEN a tracked canonical target differs from its baseline
- WHEN a reset commits
- THEN its baseline is restored and an identifiable reconciliation is retained

#### Scenario: Preserve inventory audit history
- GIVEN prior inventory movements and an unknown target exist
- WHEN a reset commits
- THEN prior movements remain and the unknown target is unchanged

#### Scenario: Rollback leaves stock history intact
- GIVEN fixture restoration or reconciliation cannot complete
- WHEN the reset rolls back
- THEN no showcase-reset reconciliation or stock baseline change is retained

