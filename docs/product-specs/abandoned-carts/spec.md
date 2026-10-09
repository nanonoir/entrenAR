# Abandoned Carts Specification

## Purpose

Defines the mock-only admin section for abandoned-cart tracking and recovery-email configuration.

## Requirements

### Requirement: Abandoned Carts List

The system MUST render `/admin/ventas/carritos` with summary cards, a table/card list of abandoned carts, and date filters: Hoy, Última semana, Último mes, Últimos 90 días.

#### Scenario: List renders with filters

- GIVEN abandoned-cart mock records exist
- WHEN `/admin/ventas/carritos` loads
- THEN summary cards, date filters, and cart rows/cards are visible

#### Scenario: Date filter narrows records

- GIVEN carts exist across multiple dates
- WHEN the admin selects Última semana
- THEN only carts abandoned within that range are displayed

---

### Requirement: Recovery Configuration Modal

The system MUST provide a configuration modal for automatic timing options 6hs, 24hs, 3 días, 7 días, 14 días, or manual trigger. The modal MUST include a link labeled `Editar mensaje de e-mail` to `/admin/ventas/carritos/email`.

#### Scenario: Timing option saved locally

- GIVEN the configuration modal is open
- WHEN the admin selects 24hs and saves
- THEN the mock/local configuration reflects that timing

#### Scenario: Email editor link navigates

- GIVEN the modal is open
- WHEN `Editar mensaje de e-mail` is clicked
- THEN `/admin/ventas/carritos/email` loads

---

### Requirement: Recovery Email Editor

The system MUST render `/admin/ventas/carritos/email` with editable HTML and plain-text modes plus a preview view. It MUST NOT send real emails.

#### Scenario: Preview reflects draft

- GIVEN the admin edits the HTML or plain-text draft
- WHEN Preview is selected
- THEN the preview reflects the local draft content

#### Scenario: No real email delivery

- GIVEN the editor or cart list is used
- WHEN any recovery action is triggered
- THEN no backend request or real email delivery occurs
