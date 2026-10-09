# Admin Form Validation Specification

## Purpose

Defines the production-ready form UX and validation behavior for admin sales-flow create/edit forms using React Hook Form (RHF) and Zod. Applies only to `OrderFormPage` and its field sections; does not govern existing admin forms.

## Requirements

### Requirement: RHF + Zod Schema Validation

The create and edit sale forms MUST use React Hook Form with a Zod resolver as the sole validation mechanism. No custom imperative validation logic outside the Zod schema is permitted in these forms.

#### Scenario: Schema validates on submit

- GIVEN the admin submits the form with a missing required field (e.g. `firstName`)
- WHEN RHF runs validation
- THEN the submission is blocked and field-level error messages appear next to the invalid field

#### Scenario: Valid form submits once

- GIVEN all required fields are valid
- WHEN the admin clicks the submit button
- THEN the form submits exactly once and the submit button enters a loading state during processing

---

### Requirement: Production-Ready Field UX

Every form field MUST have a visible `<label>`, optional helper text below the input, and trailing icon support (e.g. clear, unit suffix). Fields MUST show invalid/red visual state only after blur or first submit attempt — not on initial render.

#### Scenario: Label and helper text visible

- GIVEN the create form is open
- WHEN any text input renders
- THEN a label is visible above or alongside the input, and helper text (if defined) appears below

#### Scenario: Error state shown after blur

- GIVEN an email field with an invalid value
- WHEN the user blurs the field (without submitting)
- THEN the field border turns red and an accessible error message appears below the input

#### Scenario: Error state not shown on initial render

- GIVEN the create form has just opened with empty fields
- WHEN the form renders for the first time
- THEN no red/invalid states are visible on any field

---

### Requirement: Field-Level Validation Rules

The Zod schema MUST enforce the following per-field rules. The `discountType` field MUST be optional — an empty string or absent value MUST be preprocessed (coerced to `undefined`) before reaching enum validation, so it does not produce a validation error. All string fields representing names, addresses, and identifiers MUST be sanitized on input: name fields MUST strip numeric characters; DNI/CUIL fields MUST strip non-digit characters. Sanitization MUST occur reactively via RHF `onChange` handlers.
(Previously: Empty `discountType` (`""`) was passed directly to Zod enum validation and caused an error; no input sanitization/normalization was applied to name or DNI fields.)

| Field | Rule |
|-------|------|
| `firstName` | Required, min 2 chars; strip digits on input |
| `lastName` | Required, min 2 chars; strip digits on input |
| `email` | Optional; when provided MUST be a valid email format |
| `phone` | Optional; when provided MUST match Argentine phone pattern |
| `dniOrCuil` | Optional; when provided MUST be 7–11 digits; strip non-digits on input |
| `discountType` | Optional; empty string preprocessed to `undefined` before enum check |
| `discount (percentage)` | 0–100, numeric |
| `discount (fixed)` | 0 ≤ value ≤ subtotal |
| `shippingCost` | ≥ 0 |
| `total` | MUST NOT be negative |

#### Scenario: Percentage discount over 100 rejected

- GIVEN the discount mode is set to percentage
- WHEN the admin enters `105`
- THEN an error message states the percentage cannot exceed 100%

#### Scenario: Fixed discount exceeds subtotal rejected

- GIVEN the subtotal is `$4.999` and discount mode is fixed
- WHEN the admin enters `$5.000`
- THEN an error message states the discount cannot exceed the subtotal

#### Scenario: Invalid email format rejected

- GIVEN the email field contains `not-an-email`
- WHEN the field is blurred
- THEN an error message states an invalid email format

#### Scenario: Empty discountType does not fail validation

- GIVEN the create form has no discount type selected (empty string default)
- WHEN the admin submits with all other required fields valid
- THEN no validation error is shown for `discountType` and the form submits successfully

#### Scenario: Name field strips numeric input

- GIVEN a `firstName` input is focused
- WHEN the admin types "Juan123"
- THEN the field value becomes "Juan" (digits stripped reactively)

#### Scenario: DNI field strips non-digit input

- GIVEN the `dniOrCuil` field is focused
- WHEN the admin types "AB12345678"
- THEN the field value becomes "12345678" (non-digits stripped reactively)

---

### Requirement: Decimal Money Input

Money fields (`discountFixed`, `shippingCost`, line item `unitPrice`) MUST accept both `.` and `,` as decimal separators. The stored value MUST be a JavaScript `number`. The displayed value SHOULD be formatted as ARS (e.g. `$ 4.999,00`).

#### Scenario: Comma decimal accepted

- GIVEN a money input is focused
- WHEN the admin types `4999,50`
- THEN the field accepts the input and the stored value resolves to `4999.50`

#### Scenario: Displayed value formatted as ARS

- GIVEN a money field has value `4999.5`
- WHEN the field is not focused (formatted display)
- THEN the displayed text shows `$ 4.999,50`

---

### Requirement: Submit Button Enabled with Validation Gate

The primary submit button (`Agregar orden` or `Guardar cambios`) MUST be enabled at all times. If the form is invalid on submit, errors are shown reactively — the button MUST NOT be permanently disabled. A global warning banner SHOULD appear at the top of the form on failed submit listing any blocking issues.

#### Scenario: Submit with invalid fields shows global warning

- GIVEN the admin clicks `Agregar orden` with required fields empty
- WHEN validation runs
- THEN a global warning banner appears at the top of the form (e.g. `Revisá los campos marcados en rojo`)
- AND field-level errors appear inline

#### Scenario: Correcting errors dismisses global warning

- GIVEN the global warning banner is visible due to validation errors
- WHEN the admin corrects all invalid fields
- THEN the global warning banner disappears reactively

---

### Requirement: Dirty Form Exit Guard

The forms MUST detect unsaved changes (dirty state in RHF). When the user attempts a controlled exit (clicking `Cancelar`, browser back button interceptable via `beforeunload`, or navigation link) with a dirty form, a confirmation dialog MUST appear. Browser-native unload events SHOULD be handled best-effort (no autosave or draft persistence).

#### Scenario: Dirty form prompts on controlled cancel

- GIVEN the admin has modified at least one field in the create form
- WHEN `Cancelar` is clicked
- THEN a confirmation dialog appears: `¿Descartás los cambios?` with `Continuar editando` and `Descartar` options

#### Scenario: Confirming discard exits form

- GIVEN the dirty-exit dialog is shown
- WHEN the admin clicks `Descartar`
- THEN the form closes/navigates away without saving changes

#### Scenario: Clean form exits without dialog

- GIVEN the admin has NOT modified any field
- WHEN `Cancelar` is clicked
- THEN no confirmation dialog appears and the form exits immediately

#### Scenario: Browser unload fires best-effort warning

- GIVEN the admin has a dirty form open
- WHEN the browser tab is closed or refreshed
- THEN the browser's native unload confirmation MAY appear (best-effort; not guaranteed by all browsers)

### Requirement: Admin Numeric Validation Safety

Admin forms touched by this change MUST validate numeric business fields through explicit shared Zod helpers and MUST NOT use unsafe generic coercion that turns empty strings into business zero or leaks `NaN` into UI state.

#### Scenario: Required numeric field is emptied

- GIVEN a required admin numeric field has an existing value
- WHEN the admin clears the field and submits
- THEN the form is blocked with a neutral Spanish field error
- AND no rendered value, preview, summary, or payload contains `NaN` or an implicit `0`

#### Scenario: Optional numeric field is cleared

- GIVEN an optional admin numeric field is visible
- WHEN the admin clears the field and submits otherwise valid data
- THEN the field is intentionally normalized to the schema's empty value
- AND the empty value is not treated as a business zero

#### Scenario: Invalid numeric text is entered

- GIVEN an admin numeric field accepts typed input
- WHEN the admin enters non-numeric text
- THEN validation rejects the value with a specific neutral Spanish message
- AND the UI never displays raw Zod, English, or technical messages

### Requirement: Admin Invalid Submit Feedback

Complex admin forms touched by this change MUST present failed submission feedback through a global error, field-level errors, and accessible invalid state. Public shop and auth forms MUST remain unchanged by this admin-only standardization.

#### Scenario: Invalid submit shows global and field errors

- GIVEN a complex admin form has invalid required fields
- WHEN the admin submits the form
- THEN a global error message appears
- AND each invalid field shows its own neutral Spanish error message

#### Scenario: Public forms are unaffected

- GIVEN public shop or auth forms exist outside admin scope
- WHEN this change is applied
- THEN their validation behavior, copy, and form architecture remain unchanged

### Requirement: Accessible Admin Error Binding

Inputs, selects, textareas, and supported grouped controls touched by this change MUST expose accessible invalid state and message relationships without showing errors on initial render.

#### Scenario: Invalid control exposes accessibility metadata

- GIVEN an admin control touched by this change has a visible validation error
- WHEN the control renders in its invalid state
- THEN it exposes `aria-invalid="true"`
- AND its helper or error message is linked through `aria-describedby`

#### Scenario: Touched text controls prevent iOS zoom

- GIVEN an input, select, or textarea is touched by this change
- WHEN it renders on mobile-sized viewports
- THEN it uses `text-base md:text-sm` or an equivalent minimum 16px mobile text-size pattern

### Requirement: Hybrid Scroll To Error

Complex admin forms touched by this change MUST scroll failed submissions to the first useful invalid target using explicit section priority when configured and a dynamic `[aria-invalid="true"]` fallback otherwise.

#### Scenario: First useful invalid field is targeted

- GIVEN an admin form has multiple invalid fields after submit
- WHEN no explicit section target is higher priority
- THEN the viewport scrolls to the first useful invalid control discoverable by `[aria-invalid="true"]`
- AND focus or visual context makes the blocking field obvious

#### Scenario: Explicit invalid section is targeted

- GIVEN a form defines a section priority override for hidden, grouped, or drawer-based errors
- WHEN validation fails inside that section
- THEN the viewport scrolls to the explicit section target before using the dynamic fallback

---

### Requirement: iOS Input Zoom Prevention

On mobile Safari (iOS), form inputs with font size below 16px cause automatic viewport zoom on focus. The system MUST ensure all text inputs within `OrderFormPage` render at a minimum font size of 16px on mobile viewports to prevent iOS zoom. On tablet and desktop viewports, inputs MAY use a smaller font size (e.g. `text-sm`).

#### Scenario: Input renders at 16px on mobile

- GIVEN a mobile viewport on iOS Safari
- WHEN any text input within the order form is focused
- THEN the viewport does NOT zoom in
- AND the input's computed font size is ≥ 16px on that viewport

#### Scenario: Input MAY use smaller size on desktop

- GIVEN a desktop or tablet viewport
- WHEN any text input within the order form renders
- THEN the font size MAY be smaller than 16px (e.g. `text-sm` / 14px) without restriction

---

### Requirement: Shipping Section Validation Scope

When the shipping address accordion is collapsed (hidden), its fields MUST be excluded from form validation. Required shipping fields MUST NOT block form submission when the section is collapsed. When the accordion is expanded, shipping fields MAY be validated as optional or conditionally required based on the sale configuration.

#### Scenario: Collapsed shipping does not block submit

- GIVEN the shipping address accordion is collapsed
- AND all other required fields are valid
- WHEN the admin clicks `Agregar orden`
- THEN the form submits successfully without shipping field errors

#### Scenario: Expanded shipping fields are validated

- GIVEN the shipping address accordion is expanded
- AND a required shipping field (e.g. street address) is empty
- WHEN the admin attempts to submit
- THEN a validation error appears for that field
