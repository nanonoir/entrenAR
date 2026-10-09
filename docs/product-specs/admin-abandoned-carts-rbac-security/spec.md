# Admin Abandoned Carts RBAC Security Specification

## Purpose

Defines authorization, transport validation, secure-token handling, and error behavior for abandoned-cart administration.

## Requirements

### Requirement: Protected Administration Surface

Every route beneath `/api/v1/admin/abandoned-carts` MUST enforce JWT authentication and `@Roles(UserRole.ADMIN)` before reads or mutations.

#### Scenario: Non-admin access
- Given an unauthenticated requester or CUSTOMER token
- When it calls an abandoned-cart route
- Then the system returns 401 Unauthorized or 403 Forbidden before business processing

### Requirement: Validated and Controlled Transport

The system MUST validate list pagination, sorting, status, search, date range; action bodies; and settings/template updates with Zod. Invalid input MUST return HTTP 400 using `{ ok: false, code: string, message: string, issues?: unknown }` and MUST NOT mutate state.

#### Scenario: Invalid list filter
- Given an ADMIN sends malformed pagination or an invalid date range
- When the list endpoint receives it
- Then it returns the controlled error envelope without a listing operation

### Requirement: Opaque Recovery Tokens

The system MUST generate recovery tokens with cryptographically secure randomness, persist only their SHA-256 hashes, and reject missing, mismatched, or expired tokens.

#### Scenario: Expired recovery link
- Given a recovery token expired more than seven days after issuance
- When it is presented
- Then the system rejects it without restoring the session
