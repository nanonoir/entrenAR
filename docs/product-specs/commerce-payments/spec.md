# Commerce Payments Specification

## Purpose

Manage available payment-method configuration. [Mercado Pago card payments](../mercadopago-card-payments/spec.md) separately owns gateway integration, notifications, refunds and reconciliation; configuration itself does not process payments.

## Requirements

### Requirement: Persistent Payment Method Configuration

The system MUST persist configured payment methods and their availability. A bank-transfer method MAY contain bank instructions; all other methods MUST NOT expose or accept bank instructions. Configuration MUST NOT initiate or process a real payment.

Mercado Pago activation MUST express commerce availability only; checkout eligibility additionally requires configured backend integration and the storefront public key. Credentials MUST NOT be accepted or stored through payment-method configuration. Disabling commerce availability MUST NOT stop existing payment recovery/reconciliation. Bank-transfer configuration and checkout behavior remain unchanged.

#### Scenario: Deactivate with an unsettled card payment
- GIVEN an existing provider-managed payment and active Mercado Pago configuration
- WHEN an administrator deactivates the method
- THEN new card submissions MUST become unavailable while the existing payment continues to be verified and recoverable

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
