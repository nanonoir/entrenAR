# Auth Foundation Specification

## Purpose

Provide Phase 1 identity, session, and role enforcement without catalog, checkout, or CRM operations.

## Requirements

### Requirement: Credentials and Access Tokens

The system MUST hash passwords and never return password hashes. Customer login MUST require CUSTOMER and issue only CUSTOMER credentials; ADMIN credentials MUST receive generic `401 INVALID_CREDENTIALS`. Dedicated admin login MUST require ADMIN and issue only an explicit ADMIN-context, 15-minute access token. Tokens SHALL remain memory-only and authenticated projections MUST omit secrets.

(Previously: A shared login issued role-bearing tokens without customer-role admission control.)

#### Scenario: Customer boundary
- GIVEN valid ADMIN credentials
- WHEN customer login is requested
- THEN it MUST return generic `INVALID_CREDENTIALS`

#### Scenario: Admin boundary
- GIVEN valid CUSTOMER credentials
- WHEN admin login is requested
- THEN it MUST return the same generic error

#### Scenario: Authenticated projection
- GIVEN a valid CUSTOMER access token
- WHEN the authenticated identity projection is requested
- THEN it SHALL return permitted identity data without secrets

### Requirement: Rotating Sessions and RBAC

The system MUST persist required `sessionType` on refresh sessions and safely classify pre-existing rows as CUSTOMER before enforcing it. Refresh, rotation, logout, replay detection, cleanup, and revocation MUST be context-scoped; explicit password-security events MAY revoke both contexts. `/api/v1/admin/*` MUST continue requiring JWT authentication and ADMIN authorization.

(Previously: Refresh sessions had no context discriminator and reuse handling was shared.)

#### Scenario: Safe migration
- GIVEN existing refresh-session rows
- WHEN the session-type migration runs
- THEN every existing row MUST be CUSTOMER before non-null enforcement

#### Scenario: Suspicious replay
- GIVEN an ADMIN token is replayed outside tolerance
- WHEN replay handling runs
- THEN it MUST fail closed without revoking CUSTOMER sessions

#### Scenario: Refresh rotation
- GIVEN a valid CUSTOMER or ADMIN refresh credential for its own endpoint
- WHEN refresh is requested
- THEN it SHALL issue a context-matched access token and rotate that session

#### Scenario: Logout and role denial
- GIVEN a revoked credential or CUSTOMER access token on an admin API
- WHEN the request is made
- THEN it MUST return safe denial without protected data

### Requirement: Password Lifecycle Operations

The system MUST provide authenticated password change and public forgot/reset operations. Change MUST verify the current password, validate and hash the replacement, and revoke prior refresh sessions. Forgot responses MUST not reveal email existence. Reset tokens MUST be stored only hashed, expire, be one-time, and never appear in normal responses or logs.

#### Scenario: Change password
- GIVEN an authenticated CUSTOMER or ADMIN with the correct current password
- WHEN a valid replacement is submitted
- THEN the system SHALL change it and revoke prior refresh sessions

#### Scenario: Invalid change
- GIVEN an incorrect current password or invalid replacement
- WHEN change is requested
- THEN the system MUST return a safe error without changing the password

#### Scenario: Safe recovery and reset
- GIVEN an existing or unknown email, then a valid unexpired reset token
- WHEN forgot-password, then reset, is requested
- THEN forgot responses MUST be indistinguishable and reset SHALL consume the token

#### Scenario: Expired or reused reset token
- GIVEN an expired or consumed reset token
- WHEN reset is requested
- THEN the system MUST reject it without changing the password
