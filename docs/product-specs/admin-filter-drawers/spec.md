# Admin Filter Drawers Specification

## Purpose

Defines the requirements and scenarios for the normalized admin filter drawers (Products, Customers, Shipments), ensuring shell normalization, option grouping behavior, dynamic cascading filtering, and responsive design.

## Requirements

### Requirement: Targeted Admin Filter Drawer Normalization

The admin product, customer, and shipment filter drawers MUST use the shared admin filter drawer shell for their title area, scrollable body, and footer actions. Selection, action, navigation, and content drawers SHALL NOT be changed by this normalization.

#### Scenario: In-scope filter drawers use the shared shell

- GIVEN an admin opens the product, customer, or shipment filter drawer
- WHEN the drawer renders
- THEN the drawer MUST present a shared filter shell with a scrollable filter body and fixed footer actions
- AND apply, clear, and close callbacks MUST remain wired to the existing consumer behavior

#### Scenario: Out-of-scope drawers remain unchanged

- GIVEN a drawer is used for selection, action, navigation, or content editing
- WHEN this change is implemented
- THEN that drawer SHALL NOT be migrated to the admin filter drawer pattern

---

### Requirement: Product Filter Option Groups

The product filter drawer MUST render Stock, Price, and Visibility as single-select option groups while preserving the current filter values, labels, and draft update semantics. The existing unused `categories` prop MUST remain out of scope unless existing behavior requires it.

#### Scenario: Product single-select filters preserve behavior

- GIVEN a user selects Stock, Price, or Visibility in the product filter drawer
- WHEN the option changes
- THEN the matching draft filter field MUST update to the same value used before normalization
- AND applying or clearing filters MUST produce the same product filtering behavior as before

#### Scenario: Category filtering is not introduced

- GIVEN `ProductFilterDrawer` receives `categories`
- WHEN this normalization is implemented
- THEN the drawer MUST NOT add a new category filter unless required to preserve pre-existing behavior

---

### Requirement: Existing Dynamic and Multi-Select Controls

The customer filter drawer SHALL keep its dynamic country, province/state, and city select behavior. The shipment filter drawer SHALL keep its multi-select shipment status checkbox behavior. Both drawers SHOULD align controls with semantic admin filter styling without changing filter logic.

#### Scenario: Customer location filters remain cascading

- GIVEN a customer country or province/state draft filter changes
- WHEN the customer drawer recomputes available options
- THEN province/state and city options MUST remain derived from the filtered customer addresses
- AND dependent draft fields MUST reset as they do before normalization

#### Scenario: Shipment status filters remain multi-select

- GIVEN a shipment status is toggled in the shipment filter drawer
- WHEN the status is currently selected or unselected
- THEN the status MUST be removed from or added to the draft status list respectively
- AND multiple statuses MUST remain selectable at the same time

---

### Requirement: Responsive and Accessible Filter Drawer Experience

Normalized admin filter drawers MUST preserve safe drawer layout, semantic tokens, focus visibility, and mobile-safe input sizing. The UI MUST avoid page-level horizontal overflow and Safari input zoom at mobile and tablet widths.

#### Scenario: Normalized drawers are viewport safe

- GIVEN the normalized filter drawers are viewed at mobile, tablet, and desktop widths
- WHEN users scroll, focus inputs, and use apply or clear actions
- THEN body content MUST remain scrollable, footer actions MUST remain reachable, and controls MUST NOT cause horizontal overflow or mobile input zoom
