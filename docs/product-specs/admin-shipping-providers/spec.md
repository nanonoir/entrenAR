# Admin Shipping Providers Specification

## Purpose

Defines Admin/CRM configuration for shipping providers under `/admin/envios/medios-de-envio`.

## Requirements

### Requirement: Shipping methods provider surface

The system MUST expose `/admin/envios/medios-de-envio` with provider and pickup sections, and MUST list Andreani and Correo Argentino provider cards with status, services, configuration summary, and state-appropriate actions.

#### Scenario: View providers

- GIVEN the admin opens shipping methods
- WHEN provider data is loaded
- THEN Andreani and Correo Argentino are shown with `NO CONFIGURADO`, `DESACTIVADO`, or `ACTIVADO` states
- AND provider filters can show all, active, or inactive/not-configured providers.

#### Scenario: Navigate to provider configuration

- GIVEN a provider card is visible
- WHEN the admin chooses its configure/edit action
- THEN the admin navigates to `/admin/envios/medios-de-envio/andreani` or `/admin/envios/medios-de-envio/correo-argentino`.

### Requirement: Provider configuration form

Provider configuration MUST use React Hook Form, Zod, and `@hookform/resolvers`; it MUST validate modalities, origin/remitter data, manual weight ranges, optional free shipping threshold, and future API fields as disabled/informational only.

#### Scenario: Save inactive configuration

- GIVEN required origin fields and valid pricing are entered
- WHEN the admin chooses `Guardar configuración`
- THEN the provider configuration is saved in memory
- AND provider status becomes `configured_inactive`.

#### Scenario: Activate valid provider

- GIVEN at least one customer modality is selected and each active modality has valid non-overlapping weight ranges
- WHEN the admin chooses `Guardar y activar`
- THEN the provider status becomes `active`.

#### Scenario: Block invalid activation

- GIVEN required fields are missing, no modality is selected, or pricing ranges overlap
- WHEN the admin submits the form
- THEN submission is blocked
- AND a global error plus field-level validation feedback are shown after submit/touch.

### Requirement: Provider state and boundaries

Provider configuration MUST use in-memory Zustand state only and MUST NOT use `localStorage`, Zustand `persist`, backend persistence, checkout cost calculation, real carrier APIs, real labels, or real tracking.

#### Scenario: Deactivate provider

- GIVEN a provider is active
- WHEN the admin confirms deactivation
- THEN the provider becomes `configured_inactive`
- AND no backend, checkout, or carrier side effect occurs.

#### Scenario: Refresh loses mock changes

- GIVEN provider changes were made in memory
- WHEN the page is refreshed
- THEN the system MAY reset to initial mock state
- AND the UI MUST NOT present this as a backend-saved integration.
