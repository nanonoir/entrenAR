# Backend Workspace Specification

## Purpose

Define the standalone Phase 1 runtime, operational checks, observability, Docker delivery, and test execution.

## Requirements

### Requirement: Validated Backend Runtime

The system MUST run independently under `backend/`, validate required configuration before accepting traffic, and retain all authority outside the frontend tree.

#### Scenario: Valid startup
- GIVEN valid environment values and dependencies
- WHEN the backend starts
- THEN it SHALL serve the versioned API and liveness endpoint

#### Scenario: Invalid configuration
- GIVEN a missing or malformed required environment value
- WHEN the backend starts
- THEN it MUST fail safely with a configuration error

### Requirement: Operations, Delivery, and Tests

The system MUST provide structured request logs with request ID, route, method, status, duration, actor ID when available, and error code; it MUST NOT log passwords, tokens, authorization headers, or payment credentials. Docker startup MUST run the backend and PostgreSQL with a restart policy. Backend scripts MUST expose unit, integration, and e2e test commands.

#### Scenario: Request observability
- GIVEN an authenticated request with a refresh credential
- WHEN it completes
- THEN its correlated log SHALL redact the credential

#### Scenario: Containerized verification
- GIVEN the backend workspace and Docker Compose configuration
- WHEN Compose starts and unit, integration, and e2e commands run
- THEN PostgreSQL and the backend SHALL start and each command MUST execute successfully
