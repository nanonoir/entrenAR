# Admin Customers RBAC Security Specification

## Purpose

Defines role-based access control and Zod transport validation for customers CRM administration endpoints.

## Requirements

### Requirement: Admin Customers Endpoint Authorization

Every route beneath `/api/v1/admin/customers/*` MUST require `JwtAuthGuard` and `RolesGuard` with `Role.ADMIN` before any customer read, export, or mutation.

#### Scenario: Authorized admin request
- GIVEN an authenticated user with `Role.ADMIN`
- WHEN the user calls a customers endpoint
- THEN authorization proceeds to the requested operation

#### Scenario: Missing or insufficient credentials
- GIVEN an unauthenticated request or authenticated non-admin user
- WHEN the request targets a customers endpoint
- THEN it is rejected with HTTP 401 or 403 respectively before business logic runs

### Requirement: Validated Controlled Customer API Errors

All customer path parameters, query parameters, and mutation bodies MUST be validated through Zod validation pipes. Validation, business, and authorization failures MUST use a controlled response containing `ok: false`, `code`, and `message`, and MUST NOT expose internals.

#### Scenario: Malformed transport input
- GIVEN an ADMIN submits an invalid customer identifier, query, or body
- WHEN the endpoint receives the request
- THEN it returns HTTP 400 with the standard controlled error shape

#### Scenario: Business mutation rejection
- GIVEN a mutation violates a customer invariant
- WHEN an ADMIN submits the request
- THEN it returns a controlled error and no invalid state is persisted
