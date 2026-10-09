# Admin Customers Specification

## Purpose

Defines the in-memory MVP for the Admin CRM Customers module: list, create, edit, detail, notes, contact, CSV export, and personal-data anonymization. The module MUST NOT add real backend, auth, external delivery, or persistence.

## Requirements

### Requirement: Customer listing and discovery

The system MUST show `/admin/clientes` with all non-paginated in-memory customers, search by name, email, and DNI/CUIL, filter by country/province/city, sort total spent ascending/descending, and show result counts. The list SHOULD render as a desktop/tablet table and mobile cards without horizontal scrolling.

#### Scenario: Search and count filtered results

- GIVEN customers exist and the admin is on `/admin/clientes`
- WHEN the admin types a case-insensitive query with surrounding spaces
- THEN the list matches name, email, or DNI/CUIL after trimming
- AND the footer shows the filtered total without functional pagination

#### Scenario: Filter reset and dependent values

- GIVEN location filters are open
- WHEN the admin changes country or province
- THEN dependent province/city selections reset as applicable
- AND applying filters closes the drawer while clearing filters restores all defaults

#### Scenario: Empty states

- GIVEN no customers exist or filters match no records
- WHEN the list renders
- THEN it shows the correct empty state with the expected recovery CTA

### Requirement: Customer create and edit forms

Create and edit screens MUST use React Hook Form + Zod, visible labels, helper/error text, enabled submit buttons, and no placeholder-only guidance. Name and email are required; email MUST be unique among active customers, except the edited customer's current email. DNI/CUIL MAY repeat. Address is optional, but if any address field is filled, street, number, postal code, city, province/state, and country become required. Anonymized customers MUST NOT be editable.

#### Scenario: Create without address

- GIVEN `/admin/clientes/nuevo` is open
- WHEN the admin submits valid personal data and no address fields
- THEN a customer is created in memory and the admin is redirected to detail
- AND the success toast is shown

#### Scenario: Conditional address validation

- GIVEN the admin fills one address field
- WHEN required address fields are missing on submit
- THEN the form is not submitted
- AND a global error plus field errors identify the missing values

#### Scenario: Unique email and repeatable DNI/CUIL

- GIVEN one active customer already uses an email and DNI/CUIL
- WHEN another create/edit submit reuses the email but also reuses DNI/CUIL
- THEN the email is rejected
- AND the DNI/CUIL is accepted if its format is valid

### Requirement: Customer detail, notes, and contact

The detail page MUST show the customer heading, first interaction date, data card, sales card, notes card, and contact card for active customers. Notes MUST be editable in memory. WhatsApp MUST open a normalized phone URL in a new tab when available. Email MUST use a simulated modal with readonly recipient/sender, required subject/message, optional BCC, success toast, and a deterministic bounced case with controlled error. The old price-table card and export-send alert MUST NOT appear.

#### Scenario: Active customer detail interactions

- GIVEN an active customer detail is open
- WHEN the admin edits notes, opens WhatsApp, or submits a valid email
- THEN notes persist for the session, WhatsApp uses the normalized URL, and email shows success unless it is the deterministic bounced case

#### Scenario: Email validation and deterministic bounce

- GIVEN the email modal is open
- WHEN subject/message are invalid or the controlled bounced recipient/case is submitted
- THEN no external API is called
- AND the UI shows the relevant validation or bounced error state

### Requirement: Customer exports

The system MUST export customer list and active customer detail as CSV generated locally with UTF-8 BOM, semicolon separators, stable column names, and Excel-safe characters. List export MUST include anonymized customers without personal data using `Cliente eliminado ({customerId})`; detail export MUST be disabled for anonymized customers.

#### Scenario: Export list and detail CSV

- GIVEN customers exist
- WHEN the admin exports the list or an active customer detail
- THEN a local CSV download uses UTF-8 BOM and `;`
- AND success toast appears without sending email or calling an API

### Requirement: Personal data anonymization

The system MUST provide an irreversible confirmation flow that anonymizes customer name, email, phone, DNI/CUIL, address, and notes in memory while preserving administrative history. After anonymization, the customer remains listed and detail-accessible as `Cliente eliminado ({customerId})`, contact/edit/detail export are disabled, and notes/contact cards are hidden.

#### Scenario: Confirm anonymization

- GIVEN an active customer detail is open
- WHEN the admin confirms the destructive delete-personal-data modal
- THEN personal data and notes are removed from the customer UI
- AND the success toast appears

#### Scenario: Post-anonymization behavior

- GIVEN a customer is anonymized
- WHEN the admin views list or detail
- THEN last purchase, total spent, and sales history remain visible
- AND no original personal data, contact action, edit action, or detail export is available
