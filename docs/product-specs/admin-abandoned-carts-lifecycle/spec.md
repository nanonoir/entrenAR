# Admin Abandoned Carts Lifecycle Specification

## Purpose

Defines authoritative identification, recovery, and audit lifecycle rules for abandoned checkout sessions.

## Requirements

### Requirement: Abandoned Session Identification

The system MUST classify an ACTIVE checkout session as ABANDONED when it has recoverable checkout data and `lastActivityAt` exceeds the configured inactivity threshold. Classification MUST be idempotent and append a `SESSION_ABANDONED` history record.

#### Scenario: Stale active session
- Given a recoverable ACTIVE session exceeds the configured threshold
- When abandonment is evaluated
- Then the session is ABANDONED with recovery status PENDING and a history event

#### Scenario: Recent session
- Given an ACTIVE session is within the threshold
- When abandonment is evaluated
- Then it remains ACTIVE without a history event

### Requirement: Recovery State Machine and Audit Trail

An ABANDONED session MUST transition from PENDING, SENT, or MANUAL to SENT, MANUAL, RECOVERED, or DISCARDED only through its corresponding command. RECOVERED and DISCARDED are terminal; every accepted transition MUST create a `CheckoutSessionHistory` record.

#### Scenario: Forbidden terminal transition
- Given a session is RECOVERED or DISCARDED
- When an ADMIN submits a recovery command
- Then the command is rejected without state or history changes

### Requirement: Recovery Actions

Sending email MUST set SENT, record `lastEmailSentAt`, store only a SHA-256 hash of a new secure token with a seven-day expiry, and log `RECOVERY_EMAIL_SENT`. Manual contact MUST set MANUAL and log agent notes. Conversion MUST transactionally create and link the Order, deduct tracked product/variant inventory through referenced movements, assign policy/effect ownership, set COMPLETED and RECOVERED, and log `SESSION_RECOVERED`. Insufficient stock MUST leave the cart recoverable with no Order or inventory effect. Discarding MUST require a reason, set DISCARDED, and log `SESSION_DISCARDED`.

#### Scenario: Convert recoverable cart
- GIVEN an ADMIN converts an ABANDONED PENDING, SENT, or MANUAL session with sufficient inventory
- WHEN order creation succeeds
- THEN the linked session is COMPLETED and RECOVERED with referenced deduction and history

#### Scenario: Insufficient conversion stock
- GIVEN a recoverable cart exceeds tracked stock
- WHEN conversion is requested
- THEN it MUST return an out-of-stock conflict and leave the session recoverable

#### Scenario: Discard without reason
- GIVEN an ADMIN selects an eligible abandoned session
- WHEN the discard reason is absent
- THEN validation rejects the command without changes
