# Production Hardening Specification

## Purpose

Define the deployable, observable, and resilient runtime contract for the NestJS API.

## Requirements

### Requirement: Environment and Multi-Origin CORS

Backend configuration MUST provide a documented `backend/.env.example`, support `FRONTEND_URL`, and parse one or more configured CORS origins. CORS SHALL permit credentials only for an allowed origin.

#### Scenario: Allowed frontend origin

- GIVEN an origin appears in the configured origin list
- WHEN it sends a credentialed API request
- THEN the API permits that origin

#### Scenario: Unconfigured origin

- GIVEN an origin is absent from the configured origin list
- WHEN it sends a credentialed API request
- THEN the API MUST NOT grant credentialed CORS access

### Requirement: Graceful Runtime Lifecycle

The API MUST enable NestJS shutdown hooks and configure HTTP keep-alive and headers timeouts compatible with reverse proxies. On SIGINT or SIGTERM, it SHALL stop accepting work and release application resources cleanly.

#### Scenario: Termination signal

- GIVEN the API is serving traffic
- WHEN it receives SIGTERM
- THEN shutdown hooks run before process exit
- AND managed connections are closed cleanly

### Requirement: Central Health API

The API MUST expose `GET /api/v1/health` as an aggregate health check and retain live and readiness checks. The aggregate result SHALL report service and database readiness using the standard response contract.

#### Scenario: Healthy dependency

- GIVEN the API and database are available
- WHEN a load balancer requests `/api/v1/health`
- THEN it receives HTTP 200 with healthy service and database status

### Requirement: Server Error Observability

The centralized exception filter MUST preserve sanitized client error responses. For unhandled HTTP 500 failures, it MUST log the error message, request context, and stack trace through the backend logger.

#### Scenario: Unexpected failure

- GIVEN a request triggers an unhandled server error
- WHEN the exception filter processes it
- THEN the client receives no stack trace
- AND server logs contain the failure stack trace

### Requirement: Sensitive Auth Throttling

Login, registration, and password-recovery endpoints MUST apply tighter route-level `@Throttle` limits than the general API limit. Exceeded limits SHALL return the existing rate-limit response contract.

#### Scenario: Repeated login attempts

- GIVEN a client exceeds the login endpoint limit
- WHEN it submits another login request inside the throttle window
- THEN the API responds with HTTP 429 and `RATE_LIMITED`

### Requirement: Container and Workspace Operations

The repository MUST provide a production-oriented multi-stage `backend/Dockerfile`, a root `docker-compose.yml` that orchestrates API and PostgreSQL, and root scripts for backend tests, migrations, seed, and harness execution.

#### Scenario: Local container startup

- GIVEN Docker and the documented environment values are available
- WHEN the operator starts the compose topology
- THEN PostgreSQL and the API start with their configured dependency connection

### Requirement: Hourly Showcase Reset Invocation

The VPS MUST run the reset through a fixed hourly non-catch-up systemd timer that invokes the same one-shot command used manually, via `docker compose exec` inside the existing backend container. It MUST NOT add a NestJS scheduler, a persistent reset process, or a public reset API; scheduled status and logs MUST remain observable through systemd.

#### Scenario: Scheduled hourly execution
- GIVEN the timer reaches its scheduled hour
- WHEN the backend container is available
- THEN it invokes the one-shot reset command and exposes its result to systemd logs

#### Scenario: Missed interval and manual execution
- GIVEN the VPS was down at an interval, then an operator runs the command
- WHEN service resumes or the command is invoked
- THEN no catch-up run occurs and manual execution follows the same command contract

