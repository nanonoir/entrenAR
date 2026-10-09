# Checkout Complete Specification

## Purpose

Place orders.

## Requirements

### Requirement: Authorized Revalidated Completion

`POST /api/v1/checkout/complete` MUST validate input, derive authenticated ownership, permit valid guests, and revalidate cart, item visibility, variant, price, stock, discounts, shipping, and payment.

#### Scenario: Complete an eligible quote
- GIVEN a valid quote
- WHEN the shopper completes checkout
- THEN it SHALL create one pending order and return its projection

#### Scenario: Reject stale or foreign completion
- GIVEN changed quote inputs or another customer's cart identity
- WHEN completion is requested
- THEN the system MUST return a controlled conflict or authorization error without an order

### Requirement: Atomic Pending Order Placement

Completion MUST atomically create pending order, snapshots, payment record, referenced stock deductions, inventory policy/effect ownership, and cart cleanup; no real payment SHALL occur. Tracked deductions MUST share one stable effect identity and the created Order MUST own it as `LEDGER_MANAGED`; an infinite-only order MUST be `NOT_APPLICABLE`. No duplicate stock truth MAY be persisted on order or item status fields.

#### Scenario: Persist an order atomically
- GIVEN sufficient stock for every line
- WHEN completion succeeds
- THEN order, referenced deductions, ownership, stock decrement, and cart cleanup SHALL be observable

#### Scenario: Prevent oversell
- GIVEN concurrent requests for the final unit
- WHEN both complete
- THEN at most one MUST succeed and the other MUST preserve stock and cart state

### Requirement: Idempotent, Observable Failure Handling

Completion MUST return the original result for a repeated idempotency key, record retry-safe context, and return safe errors; unexpected failures MUST return `INTERNAL_ERROR`.

#### Scenario: Retry completion
- GIVEN a completed request and the same idempotency key
- WHEN the request is retried
- THEN it SHALL return the original outcome without duplicate stock changes
