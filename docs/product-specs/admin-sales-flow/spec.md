# Admin Sales Flow Specification

## Purpose

Defines the admin sales management module: listing, detail, create, edit, and all lifecycle actions (cancel, reopen, archive, logistics transitions, payment marking) implemented as a fully mock/in-memory local flow without backend integration.

## Requirements

### Requirement: Sales List View

The system MUST render `/admin/ventas` showing a paginated/indexed list of non-archived sales with a header counter, search input, quick-filter chips, a desktop/tablet table, and a mobile card layout. Row checkboxes MUST track selection state. When one or more rows are selected, a bulk `Archivar` action MUST appear (using `ArchiveRestore` icon + label). The `Exportar lista` action MUST display a `Download` icon alongside its label. On mobile/tablet (below `md` breakpoint), the table MUST be hidden and each sale MUST render as a card showing: sale number, date, customer, total, payment badge, and shipping badge.
(Previously: Row checkbox selection state was not tracked; no bulk archive action existed; Exportar lista had no icon; no responsive card layout was defined for mobile/tablet.)

| Column | Content |
|--------|---------|
| Checkbox | Per-row (tracked) and select-all |
| Venta | `#number` link → `/admin/ventas/:id` |
| Fecha | Short date + time (e.g. `11 jun 08:07`) |
| Cliente | Customer full name |
| Total | ARS formatted (e.g. `$ 4.999,00`) |
| Productos | Unit count |
| Pago | Badge (Pendiente / Recibido / Cancelado / Reembolsado) |
| Envío | Badge (Por empaquetar / Por enviar / Enviado / Entregado / Por retirar / Cancelado) |
| Acciones | Three-dot contextual menu |

The header MUST show `Ventas  N abiertas` and two actions: `Exportar lista` (secondary, `Download` icon, placeholder) and `Agregar orden de compra` (primary, → `/admin/ventas/nueva`).

#### Scenario: List renders with sales

- GIVEN the store has sales with `archived: false`
- WHEN `/admin/ventas` loads
- THEN a table (desktop) or cards (mobile) render each sale with all required columns/fields
- AND the header shows the correct count of non-cancelled, non-archived sales

#### Scenario: Search filters list

- GIVEN the list is visible with 2+ sales
- WHEN the user types a sale number, customer name, or email in the search input
- THEN only matching sales are shown

#### Scenario: Quick-filter chip filters by status

- GIVEN quick-filter chips (Por cobrar, Por empaquetar, Por enviar, Por retirar, Por archivar) are rendered with counts
- WHEN the user clicks a chip
- THEN the list filters to matching sales and the chip appears active

#### Scenario: Row selection enables bulk archive

- GIVEN the sales list is visible and one or more row checkboxes are checked
- WHEN any checkbox is toggled on
- THEN an `ArchiveRestore` "Archivar" button appears in the header area
- AND clicking it archives all selected eligible sales

#### Scenario: Exportar lista shows Download icon

- GIVEN the sales list header renders
- WHEN inspected
- THEN the `Exportar lista` button shows a `Download` icon alongside its label

#### Scenario: Mobile card layout renders

- GIVEN a mobile viewport (below `md` breakpoint) with sales in the store
- WHEN `/admin/ventas` loads
- THEN no table is visible; each sale renders as a card showing sale number, date, customer, total, payment badge, and shipping badge

#### Scenario: Empty state

- GIVEN no sales exist (or all are filtered out)
- WHEN the list renders
- THEN `Todavía no hay ventas` message and `Agregar orden de compra` CTA are shown

#### Scenario: Loading state

- GIVEN the store is initializing
- WHEN the list renders
- THEN skeleton rows (desktop) or skeleton cards (mobile) are displayed

#### Scenario: Error state

- GIVEN the store reports an error
- WHEN the list renders
- THEN `No pudimos cargar las ventas` and `Reintentar` button are displayed

---

### Requirement: Sale Detail View

The system MUST render `/admin/ventas/:id` in a two-column desktop layout (left: products + payment + notes; right: customer, shipping, billing, history, tracking) and a single-column stack on mobile.

The header MUST show sale number, payment and shipping badges, date, source/type, and contextual actions (`Más opciones`, `Editar`, `Imprimir resumen`). When sale is cancelled MUST hide those three actions and show `Re-Abrir` instead.

#### Scenario: Detail renders with all cards

- GIVEN a sale with ID `101` exists in the store
- WHEN `/admin/ventas/101` loads
- THEN all cards (products, payment, notes, customer, shipping, billing, history, tracking) are visible

#### Scenario: Cancelled sale shows Re-Abrir

- GIVEN a sale with `paymentStatus: "cancelled"`
- WHEN the detail header renders
- THEN `Imprimir resumen`, `Editar`, and `Más opciones` are hidden, and `Re-Abrir` is shown

#### Scenario: Edit button disabled for advanced logistics state

- GIVEN a sale with `shippingStatus` in `[to_ship, shipped, delivered, cancelled]`
- WHEN the user hovers the disabled `Editar` button
- THEN a tooltip reads `Por seguridad NO se puede editar una venta luego de empaquetar y/o enviar el pedido`

---

### Requirement: Create and Edit Sale Forms

The system MUST provide `/admin/ventas/nueva` (create) and `/admin/ventas/:id/editar` (edit) using a shared `OrderFormPage` component with `mode: "create" | "edit"`. Edit pre-populates all fields from the existing sale. The payment status selector MUST NOT pre-select any option on initial render — no default payment option value is applied. The discount code/type field MUST be optional — an empty or absent discount selection MUST NOT cause validation errors. The shipping address section MUST be wrapped in a collapsible accordion that the admin can expand or collapse; it MUST NOT be always-visible flat fields.
(Previously: A default payment option (`"received"`) was pre-selected on form load; empty `discountType` caused Zod enum validation errors; shipping fields were always-visible flat fields with no accordion wrapper.)

Saving MUST update the in-memory store, create a `sale_created` or `sale_updated` history event, update list/detail/total reactively, and show a success toast.

Form submission MUST be blocked until: at least one product is selected, required customer fields are valid, and a payment status is selected.

#### Scenario: Create form creates a sale

- GIVEN the admin fills all required fields and clicks `Agregar orden`
- WHEN the form submits
- THEN a new sale with incremental ID (`#101`, `#102` ...) is added to the store
- AND the user is redirected to the new sale's detail page
- AND a `sale_created` history event is recorded

#### Scenario: Edit form saves changes

- GIVEN the admin edits products, customer data, or totals on `/admin/ventas/101/editar`
- WHEN `Guardar cambios` is clicked with valid data
- THEN the store sale is updated, a `sale_updated` event is appended to history
- AND the list and detail reflect the new total/data

#### Scenario: Total recalculates dynamically

- GIVEN the create/edit form is open with at least one product
- WHEN the admin changes quantity, discount type/value, or shipping cost
- THEN `subtotal`, `discount`, and `total` update reactively before submission

#### Scenario: No payment option pre-selected

- GIVEN the create form loads for the first time
- WHEN the payment status selector renders
- THEN no option is selected by default; the selector shows a placeholder or empty state

#### Scenario: Empty discount does not block submission

- GIVEN the create form has no discount type selected and all other required fields are valid
- WHEN the admin clicks `Agregar orden`
- THEN validation passes; the sale is created without a discount applied

#### Scenario: Shipping address accordion is collapsed by default

- GIVEN the create/edit form loads
- WHEN the shipping address section renders
- THEN it is displayed as a collapsed accordion; shipping fields are not visible until the admin expands it

#### Scenario: Shipping accordion expands on user action

- GIVEN the shipping address accordion is collapsed
- WHEN the admin clicks/taps the accordion toggle
- THEN the shipping address fields become visible and editable

#### Scenario: Shipping address drawer saves

- GIVEN the detail view is open and the admin opens `Editar dirección de envío`
- WHEN valid address data is entered and `Guardar` is clicked
- THEN the shipping address is updated in the store, a `shipping_address_updated` event is recorded, and the drawer closes

---

### Requirement: Logistics Transitions

The system MUST expose in-card action buttons on the detail view based on the current `shippingStatus`. Each transition MUST append a history event to the sale.

| Current status | Actions shown |
|---------------|---------------|
| `to_pack` | `Imprimir`, `Marcar como empaquetado` |
| `to_ship` | `Imprimir`, `Notificar envío`, `Desempaquetar` |

#### Scenario: Mark as packed

- GIVEN a sale with `shippingStatus: "to_pack"`
- WHEN `Marcar como empaquetado` is clicked
- THEN `shippingStatus` transitions to `"to_ship"` in the store
- AND a `package_packed` history event is appended
- AND a success toast is shown

#### Scenario: Desempaquetar reverses packing

- GIVEN a sale with `shippingStatus: "to_ship"`
- WHEN `Desempaquetar` is clicked
- THEN `shippingStatus` transitions back to `"to_pack"` and `package_unpacked` event is recorded

#### Scenario: Notificar envío transitions to Enviado

- GIVEN a sale with `shippingStatus: "to_ship"`
- WHEN `Notificar envío` is clicked
- THEN `shippingStatus` transitions to `"shipped"`, a `package_shipped` event is recorded
- AND an `email_failed` event is also recorded (simulating a failed notification email)

---

### Requirement: Mark Payment as Received

The system MUST show `Marcar como recibido` in the payment card when `paymentStatus` is `"pending"`. Clicking it MUST transition to `"received"` and append a `payment_received` history event.

#### Scenario: Mark payment received

- GIVEN a sale with `paymentStatus: "pending"` is open in detail view
- WHEN `Marcar como recibido` is clicked
- THEN payment badge changes to `Recibido`, a `payment_received` event is appended, and the action button disappears

#### Scenario: Action hidden when already received

- GIVEN a sale with `paymentStatus: "received"`
- WHEN the payment card renders
- THEN `Marcar como recibido` is NOT visible

---

### Requirement: Cancel Sale

The system MUST open a right-side `CancelSaleDrawer` from `Más opciones → Cancelar`. The drawer MUST require a cancellation reason (select), and show checkboxes `Enviar e-mail al cliente` (default checked) and `Restaurar stock` (default checked). The confirm button (`Cancelar venta`, destructive red) MUST be disabled until a reason is selected.

On confirm: `paymentStatus` → `"cancelled"`, `previousPaymentStatus` and `previousShippingStatus` saved, cancellation reason saved, history events `sale_cancelled` (and `stock_restored` if checkbox active, `email_sent`/`email_failed` if email checkbox active) appended. Shipping status MUST NOT change.

#### Scenario: Cancel with reason required

- GIVEN the cancel drawer is open
- WHEN no reason is selected
- THEN `Cancelar venta` button is disabled

#### Scenario: Cancel saves previous states

- GIVEN a sale with `paymentStatus: "pending"` and `shippingStatus: "to_pack"`
- WHEN cancelled with reason selected
- THEN `previousPaymentStatus: "pending"` and `previousShippingStatus: "to_pack"` are stored in the sale
- AND `paymentStatus` becomes `"cancelled"`, `shippingStatus` remains `"to_pack"`

#### Scenario: Cancel with stock restore records event

- GIVEN the cancel drawer has `Restaurar stock` checked
- WHEN `Cancelar venta` is confirmed
- THEN a `stock_restored` history event is appended (simulation only)

---

### Requirement: Reopen Cancelled Sale

The system MUST restore a cancelled sale's previous payment and shipping statuses and append a `sale_reopened` history event when `Re-Abrir` is clicked.

#### Scenario: Reopen restores previous states

- GIVEN a sale with `paymentStatus: "cancelled"`, `previousPaymentStatus: "pending"`, `previousShippingStatus: "to_pack"`
- WHEN `Re-Abrir` is clicked
- THEN `paymentStatus` → `"pending"`, `shippingStatus` → `"to_pack"`, and `sale_reopened` event appended

---

### Requirement: Archive Sale

The system MUST set `archived: true` and append a `sale_archived` history event when `Archivar` is selected from `Más opciones`. Archived sales MUST NOT appear in the main `/admin/ventas` list. Archive MUST NOT affect `paymentStatus`, `shippingStatus`, or stock.

#### Scenario: Archive removes from main list

- GIVEN a sale is archived via `Más opciones → Archivar`
- WHEN `/admin/ventas` list renders
- THEN the archived sale is not present in the list and a success toast is shown

---

### Requirement: Sale History Timeline

Every sale MUST maintain an ordered array of `SaleHistoryEvent` records. The detail view MUST render these as a vertical timeline with icon, title, actor, date, time, and optional secondary action (`Reenviar e-mail` for `email_sent` events). History event type values MUST be displayed using human-readable Spanish labels — raw enum/key strings MUST NOT be shown to the user.
(Previously: History event types were printed using raw string values instead of translated Spanish labels.)

#### Scenario: History shows all events in order

- GIVEN a sale has undergone create → pack → ship actions
- WHEN the history card renders
- THEN events appear in reverse-chronological order: `package_shipped`, `package_packed`, `sale_created`

#### Scenario: Failed email renders as alert

- GIVEN the history contains an `email_failed` event
- WHEN the timeline renders
- THEN that event is styled visually as a warning/alert (yellow)

#### Scenario: Event labels are human-readable Spanish

- GIVEN the sale history contains events of types `sale_created`, `package_packed`, `payment_received`
- WHEN the history timeline renders
- THEN each event title shows a translated Spanish label (e.g. "Venta creada", "Paquete empaquetado", "Pago recibido") — not the raw key string

---

### Requirement: Customer-linked sales history

Admin sales records MUST support deterministic linkage to Customers by `customerId` so the Customers module can derive sales history from the existing sales-flow source. The Customers module MUST NOT create or maintain a parallel operational sales source. Sales IDs, dates, totals, products, payment status, fulfillment status, and delivery labels MUST remain compatible with the existing sales-flow UI.

#### Scenario: Customer detail derives sales from sales-flow

- GIVEN sales exist with `customerId` values
- WHEN the admin opens a customer detail page
- THEN the sales card shows only sales linked to that customer ID
- AND sale numbers link to `/admin/ventas/[ventaId]`

#### Scenario: Customer with no linked sales

- GIVEN a customer has no matching sales by `customerId`
- WHEN the admin opens the customer detail page
- THEN the sales card shows `0 Ventas`
- AND the empty sales message is displayed

---

### Requirement: Sales customer snapshot anonymization

Admin sales MUST expose a controlled way to anonymize linked customer snapshots when a customer's personal data is deleted. The anonymized snapshot MUST replace personally identifiable customer fields with `Cliente eliminado ({customerId})` while preserving sale history needed for reporting and operations.

#### Scenario: Linked sales are anonymized

- GIVEN an active customer has linked sales
- WHEN the customer personal-data deletion flow is confirmed
- THEN linked sales no longer show the original customer name or contact data
- AND they still show sale ID, date, total, products, statuses, and delivery information

#### Scenario: Unlinked sales remain unchanged

- GIVEN multiple sales belong to different customer IDs
- WHEN one customer is anonymized
- THEN only sales with that customer's `customerId` are updated
- AND unrelated sales retain their original customer snapshots

---

### Requirement: Purchase Order List

The system MUST provide `/admin/ventas/ordenes` listing all `AdminPurchaseOrder` records (non-converted) with their ID, customer name, date, total, product count, and compact icon-only action buttons. On mobile/tablet (below `md` breakpoint) the table MUST be replaced by per-order cards. The list header `Nueva orden` button MUST include a `Plus` icon. Row-level actions MUST use icon buttons only (no visible text labels): copy payment link (`Link` icon), view detail (`Eye` icon), delete order (`Trash2` icon). Text-based action labels in the table body MUST be removed.
(Previously: No responsive card layout existed; `Nueva orden` button had no icon; action buttons used text labels; product count column was missing from the table; no compact icon-only actions.)

#### Scenario: Order list renders on desktop

- GIVEN purchase orders exist in the store
- WHEN `/admin/ventas/ordenes` loads on a desktop viewport
- THEN each order row shows ID, customer name, date, product count, total, and icon-only action buttons (copy link, view, delete)

#### Scenario: Order list renders as cards on mobile

- GIVEN purchase orders exist in the store
- WHEN `/admin/ventas/ordenes` loads on a mobile/tablet viewport
- THEN each order renders as a card showing ID, customer, date, total, product count, and compact icon actions

#### Scenario: Nueva orden button has Plus icon

- GIVEN the purchase orders list header renders
- WHEN inspected
- THEN the `Nueva orden` primary button shows a `Plus` icon

#### Scenario: Icon actions work without text labels

- GIVEN a purchase order row is visible on desktop
- WHEN the admin clicks the copy link icon
- THEN the payment link is copied to clipboard and a toast confirms; no text label is required to be visible

#### Scenario: Empty orders list

- GIVEN no purchase orders exist
- WHEN `/admin/ventas/ordenes` loads
- THEN an appropriate empty state is shown

---

### Requirement: Archived Sales List

The system MUST render `/admin/ventas/archivados` as a read-only archived-sales list using the sales list pattern. It MUST NOT show `Agregar orden de compra`. Quick filters MUST include Entregado, Cancelado, and Reembolsado.

| Field | Content |
|---|---|
| Venta | `#number` link → `/admin/ventas/:id` |
| Fecha | Short date + time |
| Cliente | Customer full name |
| Total | ARS formatted |
| Productos | Unit count |
| Estado | archived/payment/shipping badges |

#### Scenario: Archived list renders

- GIVEN archived sales exist
- WHEN `/admin/ventas/archivados` loads
- THEN only archived sales are shown
- AND no `Agregar orden de compra` action is visible

#### Scenario: Archived quick filter applies

- GIVEN archived sales have delivered, cancelled, and refunded states
- WHEN the admin selects a quick filter
- THEN the list shows only matching archived sales

---

### Requirement: Archived Sale Detail Read-Only State

The system MUST render archived sale detail pages as read-only. Header and cards MUST hide `Más opciones`, `Editar`, editable address controls, and lifecycle action buttons; status MUST show `Archivado` without changing payment or shipping badges.

#### Scenario: Archived detail hides actions

- GIVEN an archived sale exists
- WHEN `/admin/ventas/:id` loads for that sale
- THEN edit, more-options, address edit, and lifecycle controls are not visible

#### Scenario: Archived badges remain factual

- GIVEN an archived sale was delivered or refunded before archival
- WHEN the detail page renders
- THEN `Archivado` is shown in addition to the factual payment/shipping badges

