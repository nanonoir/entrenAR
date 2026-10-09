# Admin Statistics Aggregation Engine Specification

## Purpose

Calculate consistent, server-authoritative commerce metrics and comparative reports.

## Requirements

### Requirement: Qualifying Sales and Safe Metrics

The engine MUST include revenue and sales count only for orders whose status is neither `CANCELLED` nor `REFUNDED` and whose payment status is `PAID`. It MUST calculate average ticket as revenue divided by qualifying sales count and MUST return `0` when that count is `0`.

#### Scenario: Paid non-cancelled order qualifies

- GIVEN an order is paid and its order status is not cancelled or refunded
- WHEN revenue and sales count are aggregated
- THEN its total and count are included

#### Scenario: Empty qualifying set

- GIVEN no order qualifies in a period
- WHEN average ticket is calculated
- THEN the engine returns `0` without a division error

### Requirement: Period and Variation Resolution

The engine MUST resolve current and equal-length prior UTC windows for supported periods; custom ranges MUST compare with the immediately preceding equal duration, and `all-time` MUST report zero variation. It MUST calculate variation as `((current - prior) / prior) * 100`; when prior is zero, it MUST return `100` for positive current and `0` for zero current. Trend MUST be `up`, `down`, or `neutral` according to the comparison.

#### Scenario: Thirty-day comparison

- GIVEN period `30d` ending at the report reference time
- WHEN the engine resolves comparison windows
- THEN it compares the current 30-day window with the preceding 30-day window

#### Scenario: Prior value is zero

- GIVEN current revenue is positive and prior revenue is zero
- WHEN variation is calculated
- THEN variation is `100` and trend is `up`

### Requirement: Sales Distribution and Geography

The engine MUST provide paid-order payment-method revenue, delivery-method distribution, and province rankings. Province extraction MUST use `shippingAddressSnapshot.province`, then `provinceOrState`, then an explicit unspecified value.

#### Scenario: Legacy shipping snapshot

- GIVEN a qualifying order has only `provinceOrState` in its address snapshot
- WHEN provinces are grouped
- THEN the order is attributed to that value

### Requirement: Product and Customer Rankings

The engine MUST rank qualifying order items by units sold and revenue, and MUST expose current tracked-inventory alert groups `OUT_OF_STOCK` and `LOW_STOCK`. It MUST rank customers by qualifying spend and order frequency.

#### Scenario: Low stock bestseller

- GIVEN a tracked product has positive stock at or below the low-stock threshold
- WHEN product alerts are assembled
- THEN the product appears in `LOW_STOCK`

### Requirement: Coupon Performance

The engine MUST report coupon usage counts and qualifying revenue per coupon, and MUST compare qualifying coupon orders with qualifying non-coupon orders by count and revenue.

#### Scenario: Coupon comparison

- GIVEN qualifying orders with and without coupon codes exist
- WHEN the coupon report is requested
- THEN each cohort's count and revenue are returned separately
