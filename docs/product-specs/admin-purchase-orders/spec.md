# Admin Purchase Orders Specification

## Purpose

Defines the purchase order sub-module within the admin Ventas section: creation with three payment options, a dedicated order list and detail route, conversion of customer order drafts into authoritative confirmed sales, and supplier management with purchase order lifecycle replenishment.

## Requirements

### Requirement: Create Route with Three Payment Options

The route `/admin/ventas/nueva` MUST present a full order creation form (shared `OrderFormPage`, `mode: "create"`) that includes a payment status selector with exactly three options:

| Option | Key | Effect |
|--------|-----|--------|
| Pago no realizado | `unpaid` | Creates a purchase order record; no sale; no stock effect |
| Pago pendiente | `pending` | Creates a sale with `paymentStatus: "pending"`; stock reservation simulated in history |
| Pago recibido | `received` | Creates a sale with `paymentStatus: "received"`; stock deduction simulated in history |

#### Scenario: Pago no realizado creates purchase order

- GIVEN the admin fills required fields and selects `Pago no realizado`
- WHEN `Agregar orden` is clicked
- THEN a new `AdminPurchaseOrder` record is created in the store with ID format `OC-{year}-{6 random digits}`
- AND the user is redirected to `/admin/ventas/ordenes/:id`
- AND no `AdminSale` record is created

#### Scenario: Pago pendiente creates a sale

- GIVEN the admin selects `Pago pendiente` and submits
- WHEN `Agregar orden` is clicked
- THEN a new `AdminSale` is created with `paymentStatus: "pending"` and the user is redirected to `/admin/ventas/:id`
- AND a `stock_reserved` simulation event is in the sale history

#### Scenario: Pago recibido creates a sale

- GIVEN the admin selects `Pago recibido` and submits
- WHEN `Agregar orden` is clicked
- THEN a new `AdminSale` is created with `paymentStatus: "received"` and the user is redirected to `/admin/ventas/:id`
- AND a `stock_deducted` simulation event is in the sale history

---

### Requirement: Purchase Order ID Strategy

Purchase orders MUST use the ID format `OC-{currentYear}-{6 random digits}` (e.g. `OC-2026-483921`). Sales MUST use an incremental numeric ID prefixed with `#` (e.g. `#101`, `#102`). These two namespaces MUST NOT overlap.

#### Scenario: Order ID format

- GIVEN a new `Pago no realizado` order is created
- WHEN the order detail loads
- THEN the order ID matches the pattern `OC-\d{4}-\d{6}`

#### Scenario: Sale ID is incremental

- GIVEN sales `#101` and `#102` already exist
- WHEN a new sale is created
- THEN it receives ID `#103`

---

### Requirement: Purchase Order List

The system MUST provide `/admin/ventas/ordenes` listing all `AdminPurchaseOrder` records (non-converted) with their ID, customer name, date, total, and a `Marcar como recibido` action.

#### Scenario: Order list renders

- GIVEN purchase orders exist in the store
- WHEN `/admin/ventas/ordenes` loads
- THEN each order shows ID, customer name, date, total, and a conversion action

#### Scenario: Empty orders list

- GIVEN no purchase orders exist
- WHEN `/admin/ventas/ordenes` loads
- THEN an appropriate empty state is shown

---

### Requirement: Purchase Order Detail

The system MUST provide `/admin/ventas/ordenes/:id` with a card titled `Detalle de la Orden` showing: payment link (mock), customer data, delivery data, line items, payment card text, and a `Marcar como recibido` button.

#### Scenario: Order detail renders

- GIVEN a purchase order with ID `OC-2026-483921` exists
- WHEN `/admin/ventas/ordenes/OC-2026-483921` loads
- THEN the detail page shows all required sections including the mock payment link and `Marcar como recibido` button

#### Scenario: Payment link copy behavior

- GIVEN the order detail shows a payment link
- WHEN the admin clicks `Copiar link`
- THEN the mock URL is copied to the clipboard (using `navigator.clipboard.writeText`)
- AND a toast confirms the copy (no real checkout/payment page is required)

---

### Requirement: Convert Order to Sale

Clicking `Marcar como recibido` on a customer purchase-order draft MUST confirm it as a new authoritative sale, preserve `sourceOrderId`, mark the draft converted, append a sale-created history record, and return the confirmed sale. The conversion MUST NOT be repeated.
(Previously: Conversion created only an in-memory sale and redirected the UI.)

#### Scenario: Order converts to sale
- GIVEN an unconverted customer purchase-order draft
- WHEN an ADMIN confirms it
- THEN a confirmed sale is created with `sourceOrderId` set to the draft ID
- AND the draft is marked converted and no longer appears as open

#### Scenario: Converted order inaccessible
- GIVEN a purchase order has been converted to a sale
- WHEN its conversion command is requested again
- THEN the system MUST reject the duplicate conversion

#### Scenario: Sale created from order stores sourceOrderId
- GIVEN a sale converted from order `OC-2026-483921`
- WHEN its detail is read
- THEN its history identifies that purchase order as the origin

---

### Requirement: Supplier Management

The system MUST let ADMIN users create, read, update, and list suppliers with name, code, contact name, email, phone, notes, and ACTIVE or INACTIVE status. Supplier codes MUST be unique.

#### Scenario: Create active supplier
- GIVEN valid unused supplier data
- WHEN an ADMIN creates a supplier
- THEN the supplier is persisted with ACTIVE status

#### Scenario: Duplicate supplier code
- GIVEN a supplier code already exists
- WHEN an ADMIN creates or updates another supplier with that code
- THEN the request MUST be rejected

---

### Requirement: Supplier Purchase Order Lifecycle

The system MUST manage supplier purchase orders through DRAFT, ORDERED, RECEIVED, and CANCELLED. Only an ORDERED order MAY be received; receipt MUST atomically increase each referenced product or variant inventory and append its history.

#### Scenario: Receive order
- GIVEN an ORDERED purchase order with valid items
- WHEN an ADMIN marks it RECEIVED
- THEN every item inventory is increased and audit history is recorded atomically

#### Scenario: Receive draft
- GIVEN a DRAFT purchase order
- WHEN an ADMIN marks it RECEIVED
- THEN the command MUST be rejected with no inventory change

---

### Requirement: Authoritative Purchase-Order Money and Coordinated Writes

The backend MUST exclusively derive `item.totalCost`, subtotal, and total with shared Decimal-compatible arithmetic: `item=quantity×unitCost`; `total=subtotal+tax+shipping`. Create and update schemas MUST reject derived fields and precision-invalid base money. Frontend adapters MAY preview but MUST stop serializing derived fields before strict rejection is enabled.

#### Scenario: Forged derived input
- GIVEN a create or update payload contains totalCost, subtotal, or total
- WHEN it reaches strict validation
- THEN it MUST return 400 without persistence

#### Scenario: Calculated creation
- GIVEN costs 2×100 and 3×50, tax 35, shipping 20
- WHEN an ADMIN creates the purchase order
- THEN item totals are 200 and 150, subtotal 350, and total 405

### Requirement: Consistent Draft Recalculation

Updates to DRAFT purchase orders MUST merge incoming base fields with the current state, calculate one normalized replacement, and atomically persist items and totals. The read/merge/write sequence MUST serialize or return a controlled conflict; this protection is limited to purchase-order monetary consistency.

#### Scenario: Shipping-only update
- GIVEN subtotal 1000, tax 100, shipping 50
- WHEN shipping changes to 200
- THEN the persisted total is 1300 without client-supplied total

#### Scenario: Concurrent partial updates
- GIVEN tax-only and shipping-only updates race on one DRAFT order
- WHEN both execute
- THEN the committed order satisfies derived formulas or one receives a controlled conflict
