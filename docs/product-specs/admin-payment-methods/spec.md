# Admin Payment Methods Specification

## Purpose

Defines CRM behavior for visually managing local payment provider availability and configuration before backend persistence exists.

## Requirements

### Requirement: Payment Methods Page

The system MUST render `/admin/medios-de-pago` as the CRM payment methods page, using the admin layout and showing only filter tabs, warnings when applicable, and provider cards.

#### Scenario: Initial page state

- GIVEN an administrator opens `/admin/medios-de-pago`
- WHEN the page loads for the first time
- THEN all four providers appear inactive in this order: Bank Transfer, Mercado Pago, Stripe, Payway
- AND no top summary card is shown

#### Scenario: No active provider warning

- GIVEN no provider is active
- WHEN any filter tab is selected
- THEN the page MUST show a visible warning that checkout will have no available payment methods after backend synchronization
- AND the warning MUST be informational/warning toned, not error toned

### Requirement: Provider Filtering

The system MUST provide tabs for All, Active, and Inactive providers, and MUST show a simple empty state when the selected filter has no results.

#### Scenario: Filter by status

- GIVEN providers have mixed active and inactive states
- WHEN the administrator selects Active or Inactive
- THEN only providers matching that state are displayed

#### Scenario: Empty filtered result

- GIVEN no providers match the selected filter
- WHEN the tab content is rendered
- THEN the page MUST display `No hay medios de pago para mostrar.`

### Requirement: Provider Cards

Each provider card MUST show the real provider logo, name, status badge, accepted methods, clearance time, fees, and visible actions. Actions MUST NOT be hidden in overflow or three-dot menus.

#### Scenario: Inactive provider actions

- GIVEN a provider is inactive
- WHEN its card is rendered
- THEN only Activate is shown

#### Scenario: Active provider actions

- GIVEN a provider is active
- WHEN its card is rendered
- THEN Deactivate and Edit configuration are shown

#### Scenario: Option table semantics

- GIVEN Mercado Pago, Stripe, or Payway is rendered
- WHEN the card displays available options
- THEN it MUST show all fixed options with columns for Sales in, Receive in, and Fee
- AND each receive-time row MUST align with its corresponding fee

### Requirement: Provider Configuration Flows

The system MUST support activation, edit, and deactivation through centered modals. Canceling or closing a modal MUST discard unsaved changes.

#### Scenario: Activate or edit selectable provider

- GIVEN Mercado Pago, Stripe, or Payway is being activated or edited
- WHEN the modal opens
- THEN exactly one option MAY be selected
- AND the modal MUST show only Receive in and Fee details for each option, without a Sales in column
- AND confirming without a selected option MUST keep the provider unchanged and show the selection error toast

#### Scenario: Deactivate provider

- GIVEN an active provider is being deactivated
- WHEN the administrator confirms the deactivation modal
- THEN the provider becomes inactive
- AND its existing configuration is preserved for future reactivation
- AND a success toast is shown

### Requirement: Bank Transfer Form Validation

The Bank Transfer modal MUST use React Hook Form with Zod validation and the project form UX rules for CBU/CVU, Alias, Holder full name, CUIT/CUIL, and Bank/Wallet.

#### Scenario: Valid bank transfer submission

- GIVEN all required fields are valid
- WHEN the administrator confirms Bank Transfer configuration
- THEN the provider becomes active, configuration is saved in memory, the modal closes, and a success toast is shown

#### Scenario: CBU/CVU and CUIT/CUIL validation

- GIVEN CBU/CVU contains spaces or hyphens
- WHEN validation or save runs
- THEN spaces and hyphens MUST be removed before validating and storing exactly 22 digits
- AND CUIT/CUIL MUST match `XX-YYYYYYYYY-Z` with 2 leading digits, 7 to 9 middle digits, and 1 trailing digit

#### Scenario: Invalid form submission

- GIVEN any required field is blank or invalid
- WHEN the administrator confirms
- THEN the provider remains unchanged
- AND field errors plus the global form error toast are shown only after submit or interaction

### Requirement: Local State and Backend Readiness

Payment provider state MUST be in-memory Zustand only, with no `localStorage` or persist middleware. The feature MUST expose backend-ready provider/configuration data without implementing APIs, checkout sync, payments, webhooks, or persistence.

#### Scenario: Refresh loses local changes

- GIVEN an administrator changes provider configuration
- WHEN the browser refreshes before backend persistence exists
- THEN the state MAY reset to the initial inactive provider list
