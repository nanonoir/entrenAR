# Admin Sales Frontend Adapters Specification

## Purpose

Defines the frontend boundary for authoritative sales operations with a mock fallback.

## Requirements

### Requirement: Sales Repository Contract

The system MUST expose a `SalesRepository` under `src/lib/api/admin/sales/` or `src/lib/api/sales/` that represents sales reads and lifecycle commands independently from UI state.

#### Scenario: Store uses contract
- GIVEN the admin sales store loads or mutates a sale
- WHEN it performs the operation
- THEN it invokes the configured `SalesRepository` rather than embedding transport logic

### Requirement: API Repository Validation and Mapping

`ApiSalesRepository` MUST call the admin sales API, parse successful responses with Zod, and map transport, validation, and business failures to controlled application errors.

#### Scenario: Valid API response
- GIVEN the API returns a conforming sale response
- WHEN the repository reads it
- THEN it returns the parsed domain result

#### Scenario: Malformed response
- GIVEN the API returns an invalid response body
- WHEN the repository parses it
- THEN it MUST return a controlled error without mutating store state

### Requirement: Graceful Mock Fallback

`MockSalesRepository` MAY satisfy the sales contract only in deliberate development, test, or demo configuration. Production and every authentication, session, gate, refresh, `401`, or `403` failure MUST NOT activate administrative mocks; any permitted non-production fallback MUST be observable and respect the admin session boundary.

(Previously: API unavailability could activate configured sales mocks.)

#### Scenario: Production auth failure
- GIVEN a production sales request returns `401`
- WHEN the repository handles the error
- THEN it MUST terminate the admin path without mock data

#### Scenario: Deliberate demo mode
- GIVEN explicit non-production mock configuration
- WHEN sales loads without an auth failure
- THEN observable mock results MAY be returned

### Requirement: Isolated Administrative Transports

Sales, Customers, Statistics, Abandoned Carts, Commerce, and Catalog transports MUST use only the in-memory admin token and coordinated one-refresh retry for user-initiated `401` requests. They MUST NOT import customer-token helpers, retry more than once, refresh on `403`, or commit responses after admin termination.

#### Scenario: Coordinated retry
- GIVEN concurrent same-tab admin requests receive `401`
- WHEN refresh succeeds
- THEN they MUST share one refresh and retry each original request once

#### Scenario: Customer preservation
- GIVEN an admin transport exhausts refresh
- WHEN its admin context terminates
- THEN customer credentials and stores MUST remain unchanged
