# Inventory Management Specification

## Purpose

Make product and variant stock authoritative, auditable, and safe under concurrent mutations.

## Requirements

### Requirement: Authoritative Stock States

The system MUST represent inventory as `limited` with a non-negative integer quantity or `infinite` with no fabricated quantity. Product and variant inventory MUST be independently addressable. Client input MUST specify an operation, not an authoritative resulting stock.

#### Scenario: Infinite to limited
- GIVEN an infinite inventory record
- WHEN an ADMIN replaces it with a non-negative limited quantity
- THEN the record MUST become limited at that quantity

#### Scenario: Invalid state
- GIVEN a negative, fractional, or ambiguous inventory request
- WHEN it is submitted
- THEN it MUST return `VALIDATION_ERROR` without changing stock

### Requirement: Transactional Inventory Operations

The system MUST support `add`, `subtract`, and `replace` operations. Each successful mutation MUST atomically update the targeted record and append an immutable history entry containing operation, delta where applicable, resulting state, actor, origin, timestamp, and optional reason.

#### Scenario: Audited subtraction
- GIVEN limited variant stock of ten
- WHEN an ADMIN subtracts three with a reason
- THEN stock MUST become seven and exactly one corresponding history entry MUST exist

#### Scenario: Impossible subtraction
- GIVEN limited stock of two
- WHEN an ADMIN subtracts three
- THEN it MUST return `OUT_OF_STOCK` and append no history entry

### Requirement: Concurrent Oversell Prevention

The system MUST serialize or conditionally apply competing limited-stock deductions so resulting stock never becomes negative. Concurrent successful deductions MUST each produce one history entry; rejected deductions MUST produce none.

#### Scenario: Competing deductions
- GIVEN limited stock of one and two simultaneous deductions of one
- WHEN both requests complete
- THEN exactly one MUST succeed, one MUST return `OUT_OF_STOCK`, and resulting stock MUST be zero

#### Scenario: History immutability
- GIVEN a recorded inventory history entry
- WHEN a later inventory operation occurs
- THEN prior history fields MUST remain unchanged
