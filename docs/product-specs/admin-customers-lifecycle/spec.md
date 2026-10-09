# Admin Customers Lifecycle Specification

## Purpose

Defines authoritative admin customer profile retrieval, persistence, query filters, invariants, and sales-derived metrics.

## Requirements

### Requirement: Customer Profile Lifecycle

The system MUST allow an ADMIN to create, retrieve, update, and list persistent active customer profiles, including optional phone, DNI/CUIL, internal notes, tags, and one address. Tags and notes SHALL be returned on subsequent reads.

#### Scenario: Create and retrieve customer
- GIVEN valid profile data with notes and tags
- WHEN an ADMIN creates then retrieves the customer
- THEN the persisted profile, notes, tags, and optional address are returned

#### Scenario: Update an existing profile
- GIVEN an active customer exists
- WHEN an ADMIN submits valid changed profile, notes, or tag values
- THEN only the submitted customer data is updated

### Requirement: Customer Discovery Query

The system MUST list customers using case-insensitive trimmed search over full name, email, and DNI/CUIL; location filters; pagination; and deterministic sorting. The response SHALL include pagination metadata and only matching records.

#### Scenario: Filtered customer page
- GIVEN matching and non-matching customers exist
- WHEN an ADMIN submits search, location filters, page, and sort parameters
- THEN the requested page contains only matching customers in the requested order

#### Scenario: Invalid query values
- GIVEN an ADMIN provides invalid pagination, sorting, or filter values
- WHEN the list endpoint receives the request
- THEN it rejects the request without returning a customer page

### Requirement: Active Customer Email and Address Invariants

The system MUST enforce case-insensitive email uniqueness among customers where `isAnonymized` is false, excluding the subject customer during update. An address MAY be absent; if any address field is supplied, street, number, postal code, city, province/state, and country MUST all be supplied.

#### Scenario: Reused active email
- GIVEN an active customer owns an email differing only by case
- WHEN an ADMIN creates or updates another active customer with that email
- THEN the mutation is rejected and no duplicate active profile is persisted

#### Scenario: Partial address
- GIVEN an ADMIN supplies one or more address fields but omits a required field
- WHEN the profile mutation is submitted
- THEN validation rejects it without changing the customer

### Requirement: Sales-derived Customer Metrics

The system MUST calculate `totalSpent`, `ordersCount`, and `lastOrder` dynamically from the customer's orders whose payment is paid and whose sale is not cancelled. Unpaid or cancelled orders MUST NOT contribute to any metric.

#### Scenario: Qualifying sales metrics
- GIVEN a customer has paid non-cancelled, unpaid, and cancelled orders
- WHEN the customer or a customer list is retrieved
- THEN metrics reflect only the paid non-cancelled orders

#### Scenario: No qualifying sales
- GIVEN a customer has no paid non-cancelled orders
- WHEN the customer is retrieved
- THEN `totalSpent` and `ordersCount` are zero and `lastOrder` is absent
