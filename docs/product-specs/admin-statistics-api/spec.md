# Admin Statistics API Specification

## Purpose

Provide ADMIN-only, validated REST reports for authoritative commerce statistics.

## Requirements

### Requirement: Protected Statistics Endpoints

The system MUST expose `GET /api/v1/admin/statistics/overview`, `sales`, `products`, `customers`, and `coupons`. Each endpoint MUST require a valid JWT with the `ADMIN` role and MUST return `{ ok: true, data: ... }` on success.

#### Scenario: Administrator requests a report

- GIVEN an authenticated JWT whose role is `ADMIN`
- WHEN the client requests any statistics endpoint
- THEN the system returns HTTP 200 and the endpoint's report in the success envelope

#### Scenario: Access is not authorized

- GIVEN a request has no valid JWT or its JWT role is not `ADMIN`
- WHEN the client requests any statistics endpoint
- THEN the system returns HTTP 401 for authentication failure or HTTP 403 for insufficient role

### Requirement: Statistics Query Validation

The system MUST validate query parameters with Zod before calculating a report. `period` MUST be one of `today`, `7d`, `30d`, `90d`, `12m`, `all-time`, or `custom`; `from` and `to` MUST be ISO dates when `period=custom`; and `interval` and `limit` MUST satisfy the documented supported values and bounds.

#### Scenario: Valid custom report range

- GIVEN `period=custom` with valid ISO `from` and `to` values and valid optional interval and limit
- WHEN the client requests a report
- THEN the system calculates the report for that range

#### Scenario: Invalid report query

- GIVEN a query has an unsupported period, invalid date, missing custom bound, or invalid interval or limit
- WHEN the client requests a report
- THEN the system returns HTTP 400 with `{ ok: false, code, message, issues }`

### Requirement: Stable Error Contract

The system MUST return controlled failures as `{ ok: false, code: string, message: string, issues?: unknown }` and MUST NOT expose implementation internals.

#### Scenario: Report processing fails unexpectedly

- GIVEN a report cannot be completed due to an unexpected server condition
- WHEN the endpoint handles the request
- THEN it returns the standard error envelope without a stack trace
