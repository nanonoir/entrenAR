# Database Foundation Specification

## Purpose

Establish the Phase 1 PostgreSQL and Prisma persistence baseline.

## Requirements

### Requirement: Canonical Versioned Persistence

The system MUST use `backend/prisma/schema.prisma` and versioned Prisma migrations; it MUST NOT use the legacy root `layoutschema.prisma` or `prisma db push` as deployment migration workflow. The initial schema SHALL persist only authentication/foundation data required by this phase.

#### Scenario: Fresh database
- GIVEN an empty PostgreSQL database
- WHEN migrations and Prisma generation run
- THEN the canonical schema SHALL be created successfully

#### Scenario: Database unavailable
- GIVEN PostgreSQL is unreachable
- WHEN readiness is requested
- THEN readiness MUST report failure without exposing connection details

### Requirement: Repeatable Foundation Seed

The system MUST seed a configured ADMIN account without plaintext credentials and MUST make repeated migration and seed runs idempotent.

#### Scenario: Initial seed
- GIVEN a migrated empty database
- WHEN the seed command runs
- THEN exactly one usable seeded administrator SHALL exist

#### Scenario: Repeated seed
- GIVEN the administrator was previously seeded
- WHEN the seed command runs again
- THEN it MUST preserve one administrator and valid credentials
