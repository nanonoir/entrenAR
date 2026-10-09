# Admin Shipping Pickups Specification

## Purpose

Defines Admin/CRM pickup point configuration under shipping methods.

## Requirements

### Requirement: Pickup methods surface

The system MUST expose pickup points under `/admin/envios/medios-de-envio`, showing a main pickup point, additional pickup points, and an action to create a new pickup point.

#### Scenario: View pickup points

- GIVEN the admin opens the pickups section
- WHEN pickup data is loaded
- THEN the main pickup point and other pickup points are shown with `NO CONFIGURADO`, `DESACTIVADO`, or `ACTIVADO` states.

#### Scenario: Navigate to create or edit

- GIVEN the admin selects pickup creation or edit
- WHEN navigation occurs
- THEN creation opens `/admin/envios/medios-de-envio/retiros/nuevo`
- AND edit opens `/admin/envios/medios-de-envio/retiros/[pickupPointId]`.

### Requirement: Pickup configuration form

Pickup create/edit MUST use React Hook Form, Zod, and `@hookform/resolvers`; it MUST validate address, optional contact data, active days, non-overlapping time ranges, preparation time, pickup cost, and coverage.

#### Scenario: Save inactive pickup

- GIVEN required pickup data is valid
- WHEN the admin chooses `Guardar configuración`
- THEN the pickup point is saved in memory
- AND its status becomes `configured_inactive`.

#### Scenario: Activate valid pickup

- GIVEN address, at least one active day, valid schedules, valid preparation time, valid cost, and valid coverage are present
- WHEN the admin chooses `Guardar y activar`
- THEN the pickup point status becomes `active`.

#### Scenario: Reject overlapping schedules

- GIVEN one day has overlapping time ranges
- WHEN the admin submits the form
- THEN submission is blocked
- AND an error equivalent to `Las franjas horarias no pueden superponerse.` is shown.

#### Scenario: Validate conditional fields

- GIVEN pickup cost is `Con costo` or coverage is `Provincias específicas`
- WHEN required conditional values are missing or invalid
- THEN submission is blocked with field-level errors.

### Requirement: Pickup state and boundaries

Pickup configuration MUST use in-memory Zustand state only and MUST NOT use `localStorage`, Zustand `persist`, backend persistence, checkout exposure, API branch lookup, or visible mock/demo disclaimers.

#### Scenario: Deactivate pickup point

- GIVEN a pickup point is active
- WHEN the admin confirms deactivation
- THEN the pickup point becomes `configured_inactive`
- AND no checkout or backend side effect occurs.
