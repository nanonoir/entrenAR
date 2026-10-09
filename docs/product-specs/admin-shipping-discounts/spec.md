# Admin Shipping Discounts Specification

## Purpose

Define CRM-only automatic free-shipping rules. These rules SHALL be separate from code-based coupons and SHALL NOT integrate with public checkout in this stage.

## Requirements

### Requirement: Automatic free-shipping CRUD and visible state

The system MUST let admins create, list, edit, activate/deactivate, and delete automatic free-shipping rules using in-memory Zustand state only. Initial visible shipping-discount state MUST be empty; no `localStorage` or persisted seed data SHALL be visible.

#### Scenario: Empty state before creation

- GIVEN no free-shipping rules exist in local state
- WHEN the admin opens `Envío gratis`
- THEN the system shows the free-shipping onboarding empty state and `Crear envío gratis`

#### Scenario: Create automatic rule

- GIVEN a valid free-shipping rule form
- WHEN the admin submits `Crear`
- THEN the system stores the rule locally, redirects to its detail, and shows a success toast

### Requirement: Rule scope and validation

The system MUST validate selected shipping methods, target scope, zones, minimum cart amount, and combination setting before saving. Shipping methods SHALL come from current shipping provider/service mocks. Zones SHALL use Argentine provinces as centralized mock options.

#### Scenario: Missing shipping method

- GIVEN no shipping method is selected
- WHEN the admin submits the form
- THEN validation fails with a shipping-method error and the rule is not saved

#### Scenario: Specific zones require selection

- GIVEN zone target is `Específicas`
- WHEN the admin submits without selected zones
- THEN validation fails with a zone-selection error

### Requirement: Automatic behavior boundary

The system MUST model shipping discounts as automatic, code-less rules and MUST NOT create coupon codes for them. Public checkout application SHALL remain out of scope for this stage.

#### Scenario: Rule has no code

- GIVEN the admin creates a free-shipping rule
- WHEN the rule is saved
- THEN it has selected conditions but no coupon code field

#### Scenario: Checkout remains unchanged

- GIVEN active free-shipping rules exist in the CRM
- WHEN a shopper uses public checkout in this stage
- THEN the checkout does not apply these rules automatically

### Requirement: Shipping discount list and selectors

The system MUST show a simple list/table with selected shipping methods, minimum price, categories, zones, status, and row actions. It SHALL NOT include search, filters, sorting, or `Conocer más descuentos`.

#### Scenario: Simple listing

- GIVEN at least one free-shipping rule exists
- WHEN the admin opens `Envío gratis`
- THEN the list shows rule details and a `Crear envío gratis` action only

#### Scenario: Selection drawer saves on back

- GIVEN the admin selects categories, methods, or zones in a drawer
- WHEN the admin uses the drawer back action
- THEN selected options are preserved and displayed as chips
