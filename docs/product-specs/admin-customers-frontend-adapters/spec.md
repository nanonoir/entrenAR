# Admin Customers Frontend Adapters Specification

## Purpose

Defines the frontend customer data abstraction layer, including repository contracts, API adapter implementation, and mock fallback with parity.

## Requirements

### Requirement: Customers Repository Contract

The frontend MUST expose a `CustomersRepository` that keeps customer UI state independent of transport. It SHALL define `list()`, `getById()`, `create()`, `update()`, `updateNotes()`, `anonymize()`, `exportCsv()`, and `isEmailAvailable()`.

#### Scenario: Store delegates customer operation
- GIVEN `useAdminCustomersStore` loads or mutates a customer
- WHEN it performs an operation
- THEN it uses the configured `CustomersRepository` contract

#### Scenario: Email availability check
- GIVEN a create or edit form checks an email
- WHEN it invokes the repository with the optional subject customer context
- THEN it receives availability consistent with active-customer uniqueness

### Requirement: Authenticated API Repository

`ApiCustomersRepository` MUST implement the contract through the admin customers REST API only after administrator bootstrap succeeds. It MUST use the isolated in-memory admin auth context and MUST NOT import, read, write, refresh, or clear `accountAccessToken`. A user-initiated `401` MAY perform one coordinated admin refresh and retry; `403` MUST NOT refresh. Invalid responses, `401`, `403`, failed refresh, expired session, or invalid gate MUST fail closed as controlled admin errors and MUST NOT select mocks.

(Previously: The API repository sent current auth tokens without an explicit admin-only context or fail-closed session policy.)

#### Scenario: Conforming API operation
- GIVEN administrator bootstrap and a conforming authorized response
- WHEN the repository invokes a customer operation
- THEN it MUST return the validated mapped domain result

#### Scenario: Authentication failure
- GIVEN a customer operation receives `401`, `403`, or failed refresh
- WHEN the repository handles the failure
- THEN it MUST preserve a controlled failure without mock data or customer-token mutation

### Requirement: Mock Parity and Offline Fallback

`MockCustomersRepository` MUST implement the same contract using local mock state, but it MAY be selected only by deliberate, explicit development, test, or demo configuration outside production. API unavailability, authentication, session, gate, refresh, `401`, and `403` failures MUST NOT activate it. Any permitted mock mode MUST be observable and MUST respect the administrator session boundary.

(Previously: Configured mode or recoverable API failure could automatically activate customer mocks.)

#### Scenario: Configured mock mode
- GIVEN explicit non-production customer mock configuration
- WHEN an authorized demo workflow loads or mutates customers
- THEN it MAY use the observable mock repository

#### Scenario: Offline or session failure
- GIVEN API mode is enabled and the backend is unreachable or the admin session fails
- WHEN the store performs a customer operation
- THEN it MUST expose a controlled failure and MUST NOT fall back to mocks

### Requirement: Customer Administration Session Isolation

Customer administration state, selections, errors, mutable mocks, and pending operations MUST be scoped to the active administrator session. Logout, expiration, or reset MUST invalidate pending customer operations so late responses cannot commit data, and MUST NOT reset customer-shop credentials or stores.

#### Scenario: Late customer response
- GIVEN a customer request starts before administrator termination
- WHEN the request completes after reset
- THEN it MUST NOT repopulate customer administration state

#### Scenario: Customer-shop preservation
- GIVEN administrator termination occurs while a customer shop session exists
- WHEN customer administration state resets
- THEN customer credentials and stores MUST remain unchanged
