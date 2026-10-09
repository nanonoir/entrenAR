# CRM Inventory Tracking Specification

## Purpose

Admin users manage product and variant stock from `/admin/productos/inventario` using in-memory mock contracts and stock history prepared for backend migration. This phase MUST NOT provide durable audit guarantees and MUST NOT require the public storefront to subscribe to admin in-memory stock state.

## Requirements

### Requirement: Inventory List

The system MUST list products A-Z with product identity, stock control, variants, SKU, and history action. Products without variants MUST show one stock row; products with variants MUST expose stock rows for generated variant combinations and MAY collapse large sets behind a “more variants” action.

#### Scenario: View inventory rows
- GIVEN products with and without variants exist
- WHEN the admin opens inventory
- THEN simple products show one row
- AND variant products show rows per combination

#### Scenario: Many variants
- GIVEN a product has many generated combinations
- WHEN the inventory table renders
- THEN the system may collapse overflow behind a more-variants control

### Requirement: Inline Stock Editing

The system MUST allow inline stock updates via Enter or blur. Valid values are infinite, positive integers, and 0 for out of stock. Save MUST route changes through a mock inventory contract. Inline stock inputs MUST use the same trailing status indicator pattern as inline price inputs: a loading spinner while saving, a green check with green border after success, a red X with red border and accessible error text after validation or mock-service failure, and no status icon while idle. Success feedback SHOULD return to idle after a short delay. Inline table editing SHOULD use controlled input adapters with Zod validation for simple stock cells; it MAY be upgraded to per-row/per-cell React Hook Form instances only if the cell interaction becomes more complex. It MUST NOT require one global table form that causes broad table rerenders or caret instability.

All inline inputs MUST use the project form input sizing pattern (`text-base md:text-sm` or equivalent) to prevent iOS Safari input zoom, and invalid inputs MUST expose accessible error state via label, `aria-invalid`, and `aria-describedby`.

#### Scenario: Save limited stock
- GIVEN a product has limited stock
- WHEN the admin enters a valid integer and blurs
- THEN the stock value is saved in memory
- AND the input shows a trailing loading indicator while saving
- AND the input shows a trailing success indicator with green styling after saving
- AND the success indicator returns to idle after a short delay

#### Scenario: Reject invalid stock
- GIVEN an inventory row is editable
- WHEN the admin enters letters or a negative number
- THEN the value is rejected with an error state
- AND the input shows a trailing error indicator with red styling and accessible error text

### Requirement: Stock Type Editing

The system MUST let the admin choose infinite or limited stock. Limited stock MUST require a quantity; infinite stock MUST represent unlimited availability without a numeric quantity.

#### Scenario: Switch to infinite
- GIVEN a product has limited stock
- WHEN the admin selects infinite
- THEN the row shows infinite stock
- AND a stock history entry is created in memory

### Requirement: Stock History

The system MUST provide `/admin/productos/inventario/[productId]/historial` for product or variant stock history. History entries MUST include product context, change, resulting stock, origin/store, actor, date/time, optional reason, and type labels such as stock edit or new product.

#### Scenario: View stock history
- GIVEN stock history exists for a product
- WHEN the admin opens its history route
- THEN entries show change, resulting stock, actor, timestamp, and reason when present

#### Scenario: No history
- GIVEN no stock movements exist
- WHEN the admin opens history
- THEN an empty state is shown without crashing

### Requirement: Inventory desktop hierarchy

The inventory desktop view MUST group products with variants as one parent summary row followed by indented child variant rows. It MUST NOT repeat the product name as if each variant were an unrelated product.

#### Scenario: Product variants render under parent
- GIVEN a product has multiple variants
- WHEN the desktop inventory table is rendered
- THEN the product appears as a parent row
- AND each variant appears as an indented child row below it

### Requirement: Inline stock popover viewport visibility

Inline stock editing popovers MUST remain visible outside table overflow containers and SHOULD stay aligned to the triggering control.

#### Scenario: Popover opens without clipping
- GIVEN an inventory row is inside a horizontally scrollable table
- WHEN the stock edit trigger is activated
- THEN the popover is visible above table overflow clipping
- AND the table scroll behavior remains available

### Requirement: PR Delivery and Validation

The inventory capability MUST be delivered in PR 7. The PR MUST pass lint, typecheck, build, and documented manual smoke tests for inventory list, stock update, variant stock, and history route.

#### Scenario: Inventory PR evidence
- GIVEN PR 7 is ready
- WHEN validation completes
- THEN command outputs and manual inventory smoke notes are recorded
