# Admin Sales RBAC Security Specification

## Purpose

Defines authorization and transport validation for sales CRM administration endpoints.

## Requirements

### Requirement: Admin Endpoint Authorization

The system MUST require the ADMIN role for every endpoint beneath `/api/v1/admin/sales`, `/api/v1/admin/purchase-orders`, and `/api/v1/admin/suppliers`.

#### Scenario: Admin request
- GIVEN an authenticated ADMIN
- WHEN the ADMIN calls a covered endpoint
- THEN authorization proceeds to the endpoint operation

#### Scenario: Non-admin request
- GIVEN an authenticated user without ADMIN
- WHEN the user calls a covered endpoint
- THEN the system MUST deny access before any business mutation

### Requirement: Zod Transport Validation

The system MUST validate inbound query, path, and body data using Zod schemas. Invalid transport data MUST return HTTP 400 Bad Request and MUST NOT invoke a business mutation.

#### Scenario: Invalid command payload
- GIVEN an ADMIN submits a malformed lifecycle command payload
- WHEN the endpoint receives it
- THEN it returns 400 Bad Request with controlled validation details

#### Scenario: Invalid list query
- GIVEN an ADMIN submits invalid pagination or filter values
- WHEN the list endpoint receives it
- THEN it returns 400 Bad Request without executing the listing operation
