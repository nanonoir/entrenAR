# Admin Customers Anonymization Specification

## Purpose

Defines irreversible transactional anonymization for GDPR/privacy compliance, historical order PII sanitization, audit trail recording, and post-anonymization edit guards.

## Requirements

### Requirement: Transactional Irreversible Customer Anonymization

`POST /api/v1/admin/customers/:id/anonymize` MUST irreversibly anonymize an active customer in one transaction. It SHALL set `isAnonymized`, replace `fullName` with `Cliente eliminado ({id})`, clear email, phone, DNI/CUIL, and notes, and delete all customer addresses.

#### Scenario: Anonymize active customer
- GIVEN an active customer has PII, notes, and addresses
- WHEN an ADMIN confirms anonymization
- THEN the customer is anonymized and no original customer PII remains

#### Scenario: Transaction failure
- GIVEN anonymization cannot complete one required write
- WHEN the transaction fails
- THEN no partial customer, address, order, or audit changes are committed

### Requirement: Historical Order PII Sanitization and Audit

The anonymization transaction MUST sanitize every associated `Order` customer name, email, phone, DNI/CUIL, customer snapshot, and shipping-address snapshot while preserving order identity and commercial amounts. It MUST append an `OrderHistory` audit entry using `CUSTOMER_ANONYMIZED` or `SALE_UPDATED`.

#### Scenario: Linked sales are sanitized
- GIVEN the customer has associated orders containing PII snapshots
- WHEN anonymization succeeds
- THEN all associated snapshots are sanitized and sales history remains available

#### Scenario: Audit trail
- GIVEN anonymization succeeds for an order-linked customer
- WHEN an ADMIN reads an affected order history
- THEN it includes one qualifying anonymization audit record

### Requirement: Idempotency and Anonymized Edit Guard

An anonymization request for an already anonymized customer MUST succeed without changing sanitized data or duplicating audit records. The system MUST reject profile, address, notes, and tags mutations for anonymized customers.

#### Scenario: Repeat anonymization
- GIVEN a customer is already anonymized
- WHEN an ADMIN repeats the anonymization request
- THEN the response is successful and state remains unchanged

#### Scenario: Blocked post-anonymization update
- GIVEN a customer is anonymized
- WHEN an ADMIN attempts any editable customer mutation
- THEN the mutation is rejected and sanitized values remain unchanged
