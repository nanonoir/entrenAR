# Checkout Quote Specification

## Purpose

Quotes.

## Requirements

### Requirement: Validated Authoritative Quote

`POST /api/v1/checkout/quote` MUST validate input and return totals. Clients MUST use a repository/API adapter and MAY retain mocks until their gate.

#### Scenario: Quote a valid cart
- GIVEN a valid cart and eligible selections
- WHEN a shopper requests a quote
- THEN it SHALL contain server-calculated totals and configuration

#### Scenario: Reject malformed input
- GIVEN an invalid quote payload
- WHEN it is submitted
- THEN it MUST return `{ ok: false, code, message, issues? }` with `VALIDATION_ERROR`

### Requirement: Current Cart and Commerce Eligibility

The quote MUST reconcile guest and account carts without duplicates, derive session ownership, and validate public items, variants, price, stock, payment/transfer, shipping/pickup, coupons, and discounts. It MUST use server values, not client totals, price, stock, or foreign cart.

#### Scenario: Reconcile guest cart on sign-in
- GIVEN guest and account carts with overlapping items
- WHEN the customer requests a quote
- THEN it SHALL use one cart and report unavailable quantity

#### Scenario: Reject stale or ineligible selection
- GIVEN a hidden item, missing variant, expired coupon, unsupported payment, or shipping
- WHEN it is quoted
- THEN the system MUST reject or exclude the selection with a controlled error

#### Scenario: Price or stock changes after quote
- GIVEN a prior quote whose catalog state changed
- WHEN checkout is later revalidated
- THEN the shopper MUST receive the changed quote or a controlled conflict
