# Admin Statistics Frontend Adapters Specification

## Purpose

Provide a typed, resilient frontend boundary for admin statistics data.

## Requirements

### Requirement: Statistics Repository Contract

The frontend MUST define a `StatisticsRepository` with `getOverview`, `getSales`, `getProducts`, `getCustomers`, and `getCoupons`, each accepting the shared statistics query and returning its validated report contract.

#### Scenario: Consumer requests a report

- GIVEN a UI consumer has a valid period query
- WHEN it calls a repository report method
- THEN it receives the method's typed report result

### Requirement: API Repository Recovery

`ApiStatisticsRepository` MUST request `/api/v1/admin/statistics/*` only after administrator bootstrap succeeds, using the isolated in-memory admin auth context and no customer token helpers. A user-initiated `401` MAY use one coordinated admin refresh and retry; `403` MUST NOT refresh. Network, server, validation, `401`, `403`, invalid refresh, expired session, and invalid-gate failures MUST return controlled failures and MUST NOT invoke mock recovery or proxy statistics business APIs through the admin session gateway.

(Previously: Network or server failures invoked `recover(MockStatisticsRepository)`.)

#### Scenario: API report succeeds
- GIVEN administrator bootstrap and an available statistics API
- WHEN the API repository requests sales
- THEN it MUST return the validated sales response from the API

#### Scenario: API or session failure
- GIVEN the statistics API fails or the administrator context is invalid
- WHEN the API repository requests a report
- THEN it MUST return a controlled failure without mock statistics

### Requirement: Period-Sensitive Mock Repository

`MockStatisticsRepository` MUST source reports from `src/lib/data/admin/statistics/` and MUST return deterministic data responsive to the supplied period and custom range.

#### Scenario: Mock period changes

- GIVEN mock mode is active
- WHEN the consumer changes the selected period
- THEN the repository returns the fixture-derived report for the new query

### Requirement: Runtime Selection and Contract Parity

The statistics mock source MAY be selected only through deliberate, explicit development, test, or demo configuration and MUST be ineffective in production. It MUST NOT be selected as a network or authentication fallback. API and explicit-mock results MUST remain runtime-validated by shared contract schemas, and parity tests MUST verify identical report shapes for every repository method.

(Previously: `NEXT_PUBLIC_USE_MOCK_ADMIN_STATISTICS` selected mocks without an explicit non-production and no-fallback boundary.)

#### Scenario: Explicit demo mode
- GIVEN explicit non-production statistics mock configuration
- WHEN a demo consumer requests a report
- THEN it MAY receive the validated fixture-derived result

#### Scenario: Production failure
- GIVEN production API mode and a network or authorization failure
- WHEN a report is requested
- THEN it MUST surface the controlled failure and MUST NOT select mocks

#### Scenario: Contract drift is detected
- GIVEN either repository returns a payload outside its shared schema
- WHEN contract validation or parity testing runs
- THEN the invalid payload or shape mismatch MUST fail validation

### Requirement: Statistics Session-Scoped State

Protected statistics reports, selected periods, errors, caches, and pending requests MUST be scoped to the active administrator session. Termination or reset MUST invalidate in-flight report responses so stale metrics cannot render during a later bootstrap, while customer credentials and stores remain untouched.

#### Scenario: Late report response
- GIVEN a statistics request starts before administrator termination
- WHEN its response arrives after reset or a new bootstrap starts
- THEN it MUST NOT commit metrics, report state, or cache entries

#### Scenario: Fresh bootstrap
- GIVEN a prior administrator session ended
- WHEN a new administrator bootstrap is unresolved
- THEN prior protected statistics MUST NOT render
