# Checkout UI Flow Specification

## Purpose

Defines the static, distraction-free cart and checkout experience for EntrenAR. This capability validates checkout UX only; backend checkout, order, payment, coupon, and upload behavior remain out of scope.

## Requirements

### Requirement: Dedicated Checkout Shell

The system MUST render `/carrito` and `/checkout` inside a checkout shell that excludes shop chrome, uses the accepted `bg-background` shell surface, and keeps a black storefront-style footer.

#### Scenario: Checkout route without shop distractions

- GIVEN a shopper opens `/carrito` or `/checkout`
- WHEN the page renders
- THEN shop promo bars, category nav, drawers, and shop footer are absent
- AND the checkout header and footer are visible

#### Scenario: Responsive shell layout

- GIVEN the checkout shell is viewed on medium or small screens
- WHEN content stacks vertically
- THEN the header, footer, and primary actions remain readable and reachable

### Requirement: Cart Review Screen

The system MUST provide `/carrito` with “Mi Carrito”, free-shipping progress, cart items, continue-shopping action, suggestions carousel, summary card, coupon UI, and `Iniciar Pago` navigation.

#### Scenario: Populated cart review

- GIVEN the preview cart has items
- WHEN the shopper reviews `/carrito`
- THEN cart rows, free-shipping progress, suggestions, coupon entry, totals, and secure purchase copy are shown
- AND `Iniciar Pago` navigates to `/checkout`

#### Scenario: Empty cart review

- GIVEN the preview cart has no items
- WHEN the shopper opens `/carrito`
- THEN the page shows an empty-cart state and a continue-shopping path
- AND payment progression is not presented as ready

#### Scenario: Empty cart checkout access is blocked

- GIVEN the preview cart has no items
- WHEN the shopper opens `/checkout` directly
- THEN the checkout form is not shown
- AND the page shows an empty-cart state with a continue-shopping path

### Requirement: Checkout Step Flow

The system MUST provide `/checkout` as a static step flow with collapsible/current sections for Identificación, Entrega, and Pago.

#### Scenario: Step sections are navigable

- GIVEN the shopper is on `/checkout`
- WHEN a checkout step is selected
- THEN that step expands as current and the other steps collapse or summarize

#### Scenario: Delivery details are collected visually

- GIVEN the Entrega step is current
- WHEN the shopper reviews delivery options
- THEN postal code, delivery method selection, mock shipping options, and delivery address fields are visible

### Requirement: Mock Payment Selection

The system MUST offer Mercado Pago, Stripe, and bank transfer as static/mock payment choices without creating real payment sessions.

#### Scenario: Card/wallet payment preview

- GIVEN Mercado Pago or Stripe is selected
- WHEN the shopper reviews payment details
- THEN preview copy explains that no real payment session is created in this phase

#### Scenario: Bank transfer preview

- GIVEN bank transfer is selected
- WHEN payment details render
- THEN bank instructions, transfer proof-upload UI, and 48-business-hour manual validation copy are shown
- AND proof selection is not persisted

### Requirement: Checkout Summary and Field Presentation

The system MUST show a checkout summary with scrollable cart items, coupon area, totals, final action, and secure purchase copy; checkout inputs MUST include labels, helper text, and trailing icons where specified.

#### Scenario: Summary remains usable

- GIVEN the cart contains multiple items
- WHEN the checkout summary renders
- THEN items are scrollable within the summary and totals remain visible

#### Scenario: Accessible input presentation

- GIVEN a checkout form field is shown
- WHEN the shopper reads or focuses the field
- THEN its label, helper text, and trailing icon are available without replacing validation behavior

### Requirement: Static Scope Boundaries

The system MUST NOT create real orders, real payment sessions, real coupon validation, real upload persistence, or backend checkout validation in this phase.

#### Scenario: Final action stays mock-only

- GIVEN the shopper presses the final checkout action
- WHEN the current implementation handles the action
- THEN no order, stock reservation, payment session, coupon validation, upload persistence, or backend validation is created
- AND UI copy keeps the mock/static limitation clear
