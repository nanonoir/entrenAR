# Showcase CRM Data Reset Specification

## Purpose

Restore the canonical CRM showcase dataset without disrupting visitor activity or authentication.

## Requirements

### Requirement: Selective Canonical Restoration

The system MUST restore only explicit canonical fixture IDs in place. It MUST preserve stable catalog IDs, unknown records, and visitor-owned CUSTOMER users, carts, checkout data, orders, payments, profiles, and snapshots. It MUST NOT use ownership heuristics, broad deletion, truncation, database recreation, or a public endpoint.

#### Scenario: Restore and preserve
- GIVEN a changed canonical fixture and a non-fixture visitor record
- WHEN a reset succeeds
- THEN the fixture returns to its canonical state without changing its ID
- AND the visitor record and references remain unchanged

### Requirement: Exclusive Atomic Reset

The reset MUST prevent concurrent runs and atomically commit canonical restoration and inventory reconciliation only. It SHALL wait up to 10 seconds for active checkout or ADMIN mutations; continued contention or a required failure MUST roll back all reset work, exit non-zero, and not interrupt the active mutation. Repeated runs MUST converge to the same canonical state.

#### Scenario: Lock contention
- GIVEN a reset holds the exclusive lock
- WHEN another invocation starts
- THEN it exits without starting a second reset

#### Scenario: Mutation contention or failure
- GIVEN a conflicting mutation exceeds 10 seconds or a required family fails
- WHEN the reset ends
- THEN no reset changes commit and it exits non-zero

#### Scenario: Idempotent retry
- GIVEN a completed or interrupted reset
- WHEN the command runs again
- THEN it produces no duplicate or partial canonical state

### Requirement: Refresh Session Preservation

The reset MUST preserve `RefreshSessionType.ADMIN` and `RefreshSessionType.CUSTOMER` sessions. It MUST NOT revoke sessions or intentionally trigger the frontend expired-session flow; existing expiry, rotation, logout, and independent authentication-failure behavior remain authoritative.

#### Scenario: Successful reset retains sessions
- GIVEN valid ADMIN and CUSTOMER refresh sessions exist
- WHEN a reset commits successfully
- THEN both sessions remain valid under normal authentication policy

### Requirement: Bounded Operational Reporting

Each run MUST emit bounded, secret-free timing, outcome, fixture-family, created/updated/preserved-count, lock, and failure-category reporting. Successful normal-load runs SHOULD finish within 30 seconds.

#### Scenario: Observable outcome
- GIVEN a reset succeeds, fails, or finds a held lock
- WHEN an operator inspects status and logs
- THEN the outcome and diagnostics are available without secrets
