# Commerce Payments Specification

## Purpose

Manage available payment-method configuration. This capability excludes provider integrations, webhooks, refunds, reconciliation, checkout, orders, sales, CRM, and email.

## Requirements

### Requirement: Persistent Payment Method Configuration

The system MUST persist configured payment methods and their availability. A bank-transfer method MAY contain bank instructions; all other methods MUST NOT expose or accept bank instructions. Configuration MUST NOT initiate or process a real payment.

#### Scenario: Configure bank transfer

- GIVEN an administrator and a configured bank-transfer method
- WHEN the administrator saves valid availability and bank instructions
- THEN a subsequent read returns the persisted configuration

#### Scenario: Reject invalid bank configuration

- GIVEN a payment-method update with malformed data or bank instructions for another method
- WHEN it is submitted
- THEN the system returns a controlled validation error and persists no change

### Requirement: Authorized Configuration Consumption

The system MUST expose payment configuration to authorized administrative clients and MUST deny non-administrators. Frontend consumers MUST use a repository/API adapter and MUST retain current mock data as fallback until the mock-removal gate.

#### Scenario: Admin reads configuration

- GIVEN an authenticated administrator
- WHEN the client requests payment configuration
- THEN it receives the configured method states through the API contract

#### Scenario: Non-admin update is denied

- GIVEN an authenticated non-administrator
- WHEN the client updates a payment method
- THEN the system denies the request without changing persisted data
