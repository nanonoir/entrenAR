# Admin Sales Lifecycle Specification

## Purpose

Defines authoritative admin sales retrieval, immutable records, and lifecycle commands.

## Requirements

### Requirement: Filtered Sales Listing

The system MUST list sales with search, status, paymentStatus, shippingStatus, isArchived, inclusive date range, pagination, and deterministic sorting.

#### Scenario: Filtered page
- GIVEN matching and non-matching sales exist
- WHEN an ADMIN submits filters and pagination
- THEN only matching sales and pagination metadata are returned in the requested sort order

#### Scenario: Invalid range
- GIVEN a date range whose start is after its end
- WHEN an ADMIN requests the list
- THEN the request MUST be rejected without returning a page

### Requirement: Immutable Sale Detail Snapshots

The system MUST return a sale detail containing immutable customer, billing, shipping, item, payment, note, and ordered timeline snapshots.

#### Scenario: Historical detail
- GIVEN customer or catalog data changes after sale creation
- WHEN an ADMIN reads that sale
- THEN its captured snapshots remain unchanged

### Requirement: Authorized Sales State Machine

The system MUST support CONFIRM, PACK, UNPACK, SHIP, DELIVER, CANCEL, REOPEN, ARCHIVE, and UNARCHIVE only from valid lifecycle states, recording each accepted command in the timeline. CANCEL and REOPEN MUST use referenced ledger state: an uncompensated effect reopens without stock work; a compensated effect re-deducts exact latest targets atomically or returns out-of-stock and remains cancelled. UNKNOWN and TRANSFERRED MUST reject inventory-changing transitions.

#### Scenario: Fulfillment path
- GIVEN a confirmed, unpacked sale
- WHEN an ADMIN runs PACK, SHIP, then DELIVER
- THEN each transition succeeds and its history entry is appended

#### Scenario: Invalid transition
- GIVEN an unpacked sale
- WHEN an ADMIN runs SHIP
- THEN the command MUST be rejected and no state or history changes

#### Scenario: Reopen after restoration
- GIVEN a cancelled ledger-managed sale whose deduction was compensated
- WHEN stock remains available and an ADMIN reopens it
- THEN a new referenced deduction is written and the sale reopens atomically

### Requirement: Archive and Edit Guards

The system MUST allow archive only for CANCELLED sales or DELIVERED and PAID sales. It MUST allow sale edits only before packing or shipping.

#### Scenario: Eligible archive
- GIVEN a DELIVERED and PAID sale
- WHEN an ADMIN archives it
- THEN it becomes archived without changing fulfillment or payment state

#### Scenario: Protected edit
- GIVEN a packed or shipped sale
- WHEN an ADMIN attempts an edit
- THEN the edit MUST be rejected

### Requirement: Inventory-Aware Sale Creation and Transfer

Manual sales MUST calculate authoritative money, create payment/history, deduct tracked product and variant stock, and assign `LEDGER_MANAGED` ownership in one transaction. Infinite-only sales MUST be `NOT_APPLICABLE`. Order-to-sale conversion MUST transfer—not duplicate—the existing effect and MUST leave only the destination eligible for compensation.

#### Scenario: Manual tracked sale
- GIVEN stock 10 and a manual quantity of 2
- WHEN an ADMIN creates the sale
- THEN stock is 8 and one referenced outstanding deduction belongs to the sale

#### Scenario: Insufficient manual stock
- GIVEN tracked stock insufficient for a manual sale
- WHEN creation is requested
- THEN it MUST return an out-of-stock conflict with no order, payment, or movement persisted

### Requirement: Authoritative Manual Sale Money and Request Contract

The backend MUST derive line subtotal, subtotal, total, and payment amount using centralized Decimal-compatible arithmetic: `line=quantity×unitPrice`, `total=subtotal-discount+shipping`. It MUST reject derived write fields and invalid/non-finite/negative or over-two-decimal inputs; discount MUST NOT exceed subtotal; pickup shipping MUST normalize to zero. Frontend adapters MAY preview values but MUST NOT serialize derived values when strict backend validation is enabled.

#### Scenario: Coordinated payload
- GIVEN a manual-sale preview with forged `total` or `lineSubtotal`
- WHEN the adapter submits the request after the coordinated contract change
- THEN derived fields are absent; direct backend submission with them returns 400

#### Scenario: Derived payment amount
- GIVEN item subtotal 1000, discount 100, and shipping 150
- WHEN a manual sale is created
- THEN total and payment amount are both 1050

### Requirement: Atomic Payment Confirmation Matrix

`CONFIRM` MUST mean payment received. In one transaction it MUST conditionally set `PENDING→CONFIRMED` or retain `CONFIRMED`, set missing `confirmedAt`, change PENDING payment to PAID, and append `PAYMENT_RECEIVED`.

| Order / payment state | Result |
| --- | --- |
| PENDING / PENDING | Confirm order and pay payment. |
| CONFIRMED / PENDING | Retain order confirmation and pay payment. |
| PENDING or CONFIRMED / missing | 409 conflict. |
| Any / PAID or REFUNDED | 409 conflict; never overwrite. |
| CANCELLED or archived / any | Existing lifecycle conflict. |

Concurrent duplicates MUST return a controlled conflict and MUST NOT create partial state.

#### Scenario: Confirmed unpaid sale
- GIVEN a CONFIRMED order with PENDING payment and no confirmedAt
- WHEN an ADMIN confirms it
- THEN payment becomes PAID, confirmedAt is set, and one payment-received event exists

#### Scenario: Payment update failure
- GIVEN a PENDING order and PENDING payment
- WHEN payment persistence cannot complete
- THEN order remains PENDING and no payment-received event exists
