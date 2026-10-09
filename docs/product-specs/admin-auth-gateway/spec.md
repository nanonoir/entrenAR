# Admin Auth Gateway Specification

## Purpose

Isolate browser administrator authentication from customer authentication while retaining NestJS as the authorization authority.

## Requirements

### Requirement: Contextual Admin Sessions

The system MUST persist exactly one `CUSTOMER` or `ADMIN` session type per refresh session. Admin lifecycle endpoints MUST accept only ADMIN sessions; customer credentials, tokens, stores, and lifecycle MUST remain unaffected.

#### Scenario: Context isolation
- GIVEN simultaneous customer and administrator browser sessions
- WHEN either context refreshes or logs out
- THEN only that context's session lineage and client state change

#### Scenario: Cross-context credential
- GIVEN a refresh credential presented to the wrong context endpoint
- WHEN refresh is requested
- THEN it MUST fail without revoking the other context

### Requirement: Gateway-Owned Credentials and Gate

The auth-only gateway MUST provide login, refresh, and logout; it MUST NOT proxy business APIs. It MUST keep the raw ADMIN refresh credential server-side—never in JavaScript, JSON, URLs, or logs—behind host-only HttpOnly, SameSite=Lax `entrenar_admin_refresh` scoped to `/api/admin-session` and Secure in preview/production. It MUST issue only an in-memory 15-minute admin access token to browser code. A versioned, integrity-verified, minimal `entrenar_admin_gate` scoped to `/admin`, signed with an independent server-only secret, MUST support active and trusted-expired states without authorizing APIs.

#### Scenario: Rotation
- GIVEN a valid admin refresh cookie
- WHEN controlled refresh succeeds
- THEN the gateway replaces it, renews the gate, and returns a new admin access token

#### Scenario: Expiration termination
- GIVEN idle expiry or unrecoverable refresh failure
- WHEN termination runs
- THEN credentials clear and only a logically expired gate MAY remain during grace

### Requirement: Human Idle and Cross-Tab Lifecycle

The system MUST expire ADMIN context after 30 minutes without qualifying human interaction. Background traffic MUST NOT extend idle time. Tabs MUST coordinate activity, refresh, expiration, and logout, while backend rotation MUST tolerate an immediate duplicate refresh without revoking its successor; suspicious replay MUST fail closed within ADMIN lineage.

#### Scenario: Active human session
- GIVEN recent deliberate interaction but no business request
- WHEN controlled renewal is due
- THEN the active admin session remains authenticated

#### Scenario: Concurrent bootstrap
- GIVEN two tabs refresh the same current credential nearly simultaneously
- WHEN the duplicate arrives within configured tolerance
- THEN both tabs recover without an unbounded rotation or customer impact

### Requirement: Termination Invalidation

On admin logout or expiration, the system MUST invalidate pending privileged operations and reset all eleven admin stores, admin caches, timers, locks, mutable mocks, selections, and transient errors. It MUST NOT reset customer state. Local cleanup MUST complete despite gateway-network failure.

#### Scenario: Late response
- GIVEN an admin request starts before logout
- WHEN its response arrives after reset
- THEN it MUST NOT commit privileged data

#### Scenario: Shared logout
- GIVEN an admin logs out in one tab
- WHEN another same-origin admin tab receives the lifecycle event
- THEN it MUST clear admin state and reach admin login

### Requirement: Auth Verification Coverage

Focused backend coverage MUST verify both context boundaries, transactional rotation, cross-context rejection, scoped replay, immediate duplicate tolerance, and retained JWT/ADMIN authorization. Focused browser coverage MUST verify coexistence, restoration, idle behavior, multi-tab events, and failed-logout cleanup.

#### Scenario: Regression evidence
- GIVEN the authentication change is ready for verification
- WHEN the focused backend and browser suites run
- THEN each required context and concurrency outcome MUST be asserted
