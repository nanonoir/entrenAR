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

Quoting MUST NOT create an order or reserve inventory. Mercado Pago availability and the server-authoritative ARS card amount MUST follow [Mercado Pago card payments](../mercadopago-card-payments/spec.md); commerce activation alone MUST NOT advertise an unconfigured integration as payable. Transfer eligibility remains unchanged.

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

### Requirement: Exact Delivery Selection and Shipping Authority

Shipping selection MUST identify the exact quoted service through `shippingMethodId` and its matching `shippingProviderId`; provider identity alone MUST NOT substitute for a service or collapse several services into one selection. A service/provider mismatch, unavailable service or ineligible modality MUST produce a controlled rejection. Pickup selection MUST independently identify an eligible `pickupPointId`.

Shipping charges MUST be calculated by the backend from current merchant configuration, applicable weight band, destination/coverage and eligible free-shipping rules, never from client-supplied prices or display labels. [Commerce shipping](../commerce-shipping/spec.md) owns tariff requirements.

An incomplete quote with no delivery selected MAY have zero shipping, but MUST NOT be interpreted as a selected free service. [Checkout UI flow](../checkout-ui-flow/spec.md) owns pending/free summary presentation and request timing.
