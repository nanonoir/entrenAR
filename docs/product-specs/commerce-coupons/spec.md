# Commerce Coupons Specification

## Purpose

Manage coupon and shipping-discount configuration plus its history. This capability excludes redemption, checkout, orders, sales, CRM, payment providers, webhooks, refunds, reconciliation, real emails, and mock removal before its dedicated gate.

## Requirements

### Requirement: Unique Active Coupon Configuration

The system MUST persist valid coupons and standalone shipping discounts, and MUST enforce code uniqueness among non-deleted coupons. A deleted coupon code MAY be reused. Invalid discount rules or duplicate active codes MUST return controlled errors without partial persistence.

#### Scenario: Create shipping-discount coupon

- GIVEN an administrator and a valid unused coupon code
- WHEN the administrator saves a coupon with a shipping discount
- THEN the coupon is persisted and returned by configuration reads

#### Scenario: Reuse deleted code

- GIVEN a coupon code belonging only to a deleted coupon
- WHEN an administrator creates a valid coupon with that code
- THEN the new active coupon is accepted

#### Scenario: Configure shipping discount

- GIVEN an administrator and a valid shipping-discount rule
- WHEN the administrator saves the rule
- THEN configuration reads return the persisted shipping discount

#### Scenario: Reject active duplicate

- GIVEN an active coupon code
- WHEN an administrator submits another coupon with that code
- THEN the system rejects it and retains the existing coupon

### Requirement: Coupon History and Authorized Consumption

The system MUST retain relational history for coupon configuration events and MUST expose coupon configuration only to authorized administrative clients. Frontend consumers MUST use repository/API adapters and MUST fall back to current mocks until the mock-removal gate.

#### Scenario: Record coupon configuration history

- GIVEN an administrator modifies a persisted coupon
- WHEN the modification succeeds
- THEN its history records the coupon relationship and observable change event

#### Scenario: Deny non-admin coupon access

- GIVEN an authenticated non-administrator
- WHEN the client reads or changes administrative coupon configuration
- THEN the system denies access without exposing or changing configuration
