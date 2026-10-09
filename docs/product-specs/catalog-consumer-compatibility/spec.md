# Catalog Consumer Compatibility Specification

## Purpose

Maintain observable canonical behavior across consumers.

## Requirements

### Requirement: Canonical Consumer Contracts

Storefront, wishlist, cart, checkout, orders, admin, inventory, statistics, seeds, and fixtures MUST consume Product prices, all categories/galleries, and variant SKU/inventory. New transactional operations MUST target a variant. Simple variants MUST remain invisible; zero-stock variants MUST be unavailable, not omitted.

#### Scenario: Transactional variant line
- GIVEN a selected simple or configurable variant
- WHEN it is added, quoted, or sold
- THEN stock and SKU resolve from that variant and pricing resolves from its Product

#### Scenario: Legacy ownership rejection
- GIVEN a new consumer operation targeting Product SKU, price override, or inventory
- WHEN it is validated
- THEN it MUST be rejected or excluded from its contract

### Requirement: Historical and Savings Compatibility

Order and sale lines MUST preserve charged and compare-at snapshots. Cart and checkout MUST show line/total catalog savings separately from coupons. Public URLs MUST resolve through public slugs. Imported Products MUST use persisted galleries; non-imported fixture fallbacks MAY remain scoped.

#### Scenario: Stable historical order
- GIVEN an order created before a later catalog price change
- WHEN its details are read
- THEN its stored charged price, compare-at price, and savings remain unchanged

#### Scenario: No legacy image fallback for imports
- GIVEN an imported Product with persisted gallery images
- WHEN a storefront or admin consumer renders it
- THEN it uses the ordered persisted gallery rather than a synthetic visual fallback
