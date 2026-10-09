# API Contract Specification

## Purpose

Define Phase 1 transport validation, safe errors, health checks, and development API documentation.

## Requirements

### Requirement: Validated Safe API Responses

The system MUST validate request transport with reusable Zod contracts before service execution. Validation and expected failures SHALL use `{ ok: false, code, message, issues? }`; unexpected failures MUST use `INTERNAL_ERROR` and MUST NOT expose stack traces or internals.

#### Scenario: Invalid payload
- GIVEN an endpoint with a malformed request body
- WHEN the request is submitted
- THEN it MUST return `VALIDATION_ERROR` with testable field issues

#### Scenario: Unexpected failure
- GIVEN an unhandled backend failure
- WHEN a request is processed
- THEN it MUST return a safe `INTERNAL_ERROR` envelope

### Requirement: Health and OpenAPI Exposure

The system MUST expose liveness independently of database availability and readiness that verifies database connectivity. Swagger/OpenAPI SHALL accurately document implemented Phase 1 endpoints and MUST be exposed only in approved non-production environments.

#### Scenario: Dependency health
- GIVEN the process is running while PostgreSQL is unavailable
- WHEN liveness and readiness are requested
- THEN liveness SHALL succeed and readiness MUST fail safely

#### Scenario: Documentation environment
- GIVEN an approved development environment
- WHEN API documentation is requested
- THEN Swagger SHALL be available; in production it MUST NOT be publicly exposed
