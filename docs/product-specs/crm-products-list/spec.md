# CRM Products List Specification

## Purpose

Admin users manage catalog visibility from `/admin/productos` using mock/in-memory contracts that are prepared for future backend replacement. This phase MUST NOT guarantee durable persistence or storefront synchronization. The admin product catalog MAY be modeled from the same product domain as the public shop, but the public storefront MUST remain stable and MUST NOT be required to subscribe to admin in-memory state during this phase.

## Requirements

### Requirement: Product List Foundation

The system MUST provide the CRM Products entry page with breadcrumb/dropdown navigation to list, inventory, categories, organize, export/import, and add-product flows. The list MUST show product image or placeholder, name link, stock, editable price fields, promotional price, selection checkbox, and actions. AI generation actions MUST NOT appear.

#### Scenario: View product list
- GIVEN admin product mock data exists
- WHEN the admin opens `/admin/productos`
- THEN the page shows the Products title, controls, count, table, and footer range
- AND each product row exposes stock, price, promotional price, and row actions

#### Scenario: Empty catalog
- GIVEN no admin products exist
- WHEN the admin opens the list
- THEN the page shows an empty state with a path to add a product

### Requirement: Inline Price Editing

The system MUST allow inline editing of sale price and promotional price from the table. Values MUST be validated as numeric, sale price MUST be greater than 0, and promotional price MUST be empty or lower than sale price. Save MUST trigger on Enter or blur through a mock service contract. Inline price inputs MUST show a trailing visual status indicator: a loading spinner while saving, a green check with green border after success, a red X with red border and accessible error text after validation or mock-service failure, and no status icon while idle. Success feedback SHOULD return to idle after a short delay. Inline table editing SHOULD use controlled input adapters with Zod validation for simple price cells; it MAY be upgraded to per-row/per-cell React Hook Form instances only if the cell interaction becomes more complex. It MUST NOT require one global table form that causes broad table rerenders or caret instability.

All inline inputs MUST use the project form input sizing pattern (`text-base md:text-sm` or equivalent) to prevent iOS Safari input zoom, and invalid inputs MUST expose accessible error state via label, `aria-invalid`, and `aria-describedby`.

#### Scenario: Valid price save
- GIVEN a product row is visible
- WHEN the admin enters valid price values and blurs the field
- THEN the mock contract saves the values
- AND the input shows a trailing loading indicator while saving
- AND the input shows a trailing success indicator with green styling after saving
- AND the success indicator returns to idle after a short delay

#### Scenario: Invalid promotional price
- GIVEN sale price is 100
- WHEN the admin enters promotional price 120
- THEN the value is rejected with an error state
- AND the input shows a trailing error indicator with red styling and accessible error text
- AND the previous valid value remains available

### Requirement: Search, Filter, and Sort

The system MUST support search by name, SKU, or tags; sorting by price, name, age, sales, and manual order; and filter drawer controls for category, stock, price type, visibility, shipping, and missing logistics data.

#### Scenario: Apply filters
- GIVEN products with mixed categories and visibility exist
- WHEN the admin selects filters and applies them
- THEN the drawer closes and only matching products are shown

#### Scenario: Reset filters
- GIVEN filters are active
- WHEN the admin chooses clear filters
- THEN all filter values reset to defaults
- AND the list reflects the unfiltered catalog

### Requirement: PR Delivery and Validation

The list capability MUST be delivered through PR 1 foundation/list and PR 2 inline price editing plus filters/sorting. Each PR MUST pass `npm run lint`, `npx tsc --noEmit`, `npm run build`, and a documented manual smoke test for delivered routes.

#### Scenario: PR validation evidence
- GIVEN a PR implements list behavior
- WHEN validation is completed
- THEN automated command results and manual route smoke notes are documented
