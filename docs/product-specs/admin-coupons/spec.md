# Admin Coupons Specification

## Purpose

Define CRM-only coupon management for code-based discounts, including percentage, fixed amount, and free-shipping coupon types. This stage SHALL remain mock/local and SHALL NOT apply coupons to public checkout.

## Requirements

### Requirement: Coupon CRUD and visible state

The system MUST let admins create, list, edit, activate/deactivate, and delete coupons in the CRM using in-memory Zustand state only. Initial visible coupon state MUST be empty; no `localStorage` or persisted seed data SHALL be visible.

#### Scenario: Empty state before creation

- GIVEN no coupons exist in the in-memory state
- WHEN the admin opens `Cupones`
- THEN the system shows the coupon onboarding empty state and `Crear cupón`

#### Scenario: Create coupon

- GIVEN a valid coupon form
- WHEN the admin submits `Crear`
- THEN the system stores the coupon locally, redirects to its detail, and shows a success toast

### Requirement: Coupon form validation and types

The system MUST validate coupon forms with visible labels, helper/error text, and submit-time validation. Coupon codes MUST normalize to uppercase and enforce case-insensitive uniqueness. Fixed amount discount MUST use technical value `fixed`; free shipping MUST remain a code-based coupon type.

#### Scenario: Duplicate code normalization

- GIVEN coupon `ENVIO10` already exists
- WHEN the admin submits code `envio10`
- THEN validation fails as duplicate and no coupon is created

#### Scenario: Free-shipping coupon type

- GIVEN the admin selects `Envío gratis` as coupon type
- WHEN the form renders
- THEN it does not request amount, percentage, or shipping-method selection

### Requirement: Coupon listing, filters, sorting, and history

The system MUST list coupons with searchable code, combined filters, supported sort options, status badges, activation/deletion actions, and clickable code navigation. Coupon history MUST remain mock and update for create, edit, activate, and deactivate events. The existing coupon report SHALL remain static.

#### Scenario: Search by partial code

- GIVEN multiple coupons exist
- WHEN the admin searches part of a code using any casing
- THEN only matching coupon codes are shown

#### Scenario: Delete coupon

- GIVEN a coupon exists
- WHEN the admin confirms the destructive delete modal
- THEN the coupon is removed from local state and a success toast is shown

### Requirement: Coupon selectors and responsive UI

The system MUST provide multi-select drawers for products and categories, preserve selection on back, and show selected items as chips. Coupon lists SHALL avoid mobile/tablet horizontal overflow by using responsive card/list patterns when tables do not fit.

#### Scenario: Product selection drawer

- GIVEN the admin targets products
- WHEN products are selected and the drawer back action is used
- THEN selected products remain attached to the form as chips
