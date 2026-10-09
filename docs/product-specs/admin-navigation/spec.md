# Admin Navigation Specification

## Purpose

Define CRM sidebar navigation and active-state routing matching rules.

## Requirements

### Requirement: Shipping navigation hierarchy

The Admin sidebar MUST expose `Envíos` as an accordion navigation group with `Seguimiento de Envíos` at `/admin/envios` and `Medios de Envío` at `/admin/envios/medios-de-envio`.

#### Scenario: View shipping accordion

- GIVEN the admin sidebar is rendered
- WHEN navigation items are displayed
- THEN `Envíos` appears as an expandable group
- AND its children include `Seguimiento de Envíos` and `Medios de Envío`.

#### Scenario: Parent label navigates

- GIVEN the `Envíos` group is visible
- WHEN the admin clicks the parent label or icon
- THEN navigation goes to `/admin/envios`
- AND the chevron remains the control for expansion.

### Requirement: Shipping navigation active matching

Shipping navigation MUST use exact matching for the `/admin/envios` index child and prefix matching for shipping subroutes so only the intended child is highlighted.

#### Scenario: Tracking index active state

- GIVEN the current path is `/admin/envios`
- WHEN the sidebar renders
- THEN `Seguimiento de Envíos` is active
- AND `Medios de Envío` is inactive.

#### Scenario: Shipping methods active state

- GIVEN the current path starts with `/admin/envios/medios-de-envio`
- WHEN the sidebar renders
- THEN `Medios de Envío` is active
- AND the index child is inactive.

#### Scenario: Shipment detail active state

- GIVEN the current path starts with `/admin/envios/detalle/`
- WHEN the sidebar renders
- THEN the `Envíos` group is open or active
- AND the tracking area remains the relevant navigation context.

### Requirement: Discounts accordion routes

The system MUST render `Descuentos` in the admin sidebar as an accordion with separate child screens `Cupones` and `Envío gratis`. The system MUST NOT use internal tabs to switch between these surfaces.

#### Scenario: Sidebar exposes separate screens

- GIVEN the admin sidebar is visible
- WHEN the admin expands `Descuentos`
- THEN child items `Cupones` and `Envío gratis` are available as separate navigation targets

#### Scenario: Default discounts destination

- GIVEN the admin navigates to `/admin/descuentos`
- WHEN routing resolves the section default
- THEN the admin lands on `/admin/descuentos/cupones` or the equivalent coupon screen

### Requirement: Active-state matching

The system MUST highlight the `Descuentos` parent for all discount subroutes and MUST highlight only the exact active child route. The index child `Cupones` MUST NOT stay highlighted on sibling `Envío gratis` routes.

#### Scenario: Coupon child active

- GIVEN the current path is `/admin/descuentos/cupones/nuevo`
- WHEN the sidebar computes active state
- THEN `Descuentos` and `Cupones` are active, and `Envío gratis` is inactive

#### Scenario: Free-shipping child active

- GIVEN the current path is `/admin/descuentos/envio-gratis`
- WHEN the sidebar computes active state
- THEN `Descuentos` and `Envío gratis` are active, and `Cupones` is inactive

### Requirement: Navigation scope boundaries

The system SHALL keep the existing coupon report navigation/static report unchanged in this stage and SHALL NOT expose `Conocer más descuentos` in the Discounts CRM screens.

#### Scenario: Report remains static

- GIVEN the admin opens the existing coupon report area
- WHEN DiscountCRM is present
- THEN the report remains unchanged and is not fed by operational coupon state
