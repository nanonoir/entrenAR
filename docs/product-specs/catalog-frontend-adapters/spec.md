# Catalog Frontend Adapters Specification

## Purpose

Move catalog reads progressively from static mocks to domain-facing API repositories without changing storefront behavior.

## Requirements

### Requirement: Feature-Flagged Repository Selection

The frontend MUST access catalog data through domain-facing adapters. Public reads MAY retain configured mock/API selection, but protected administrative reads MUST use the isolated admin context after successful client bootstrap. Authentication, gate, refresh, `401`, or `403` failures MUST NOT activate mocks; `CATALOG_API_ADMIN_ACCESS_TOKEN` MUST NOT authenticate a production human admin.

(Previously: Adapter fallback could select mocks after API unavailability without an admin-auth boundary.)

#### Scenario: Post-bootstrap catalog read
- GIVEN an active gate and unresolved admin bootstrap
- WHEN an admin catalog route renders
- THEN protected catalog data MUST remain unloaded

#### Scenario: Admin authorization failure
- GIVEN an admin catalog request returns `401` or `403`
- WHEN the adapter handles it
- THEN it MUST preserve the failure and never substitute mock data

#### Scenario: Read-first public migration
- GIVEN the public API source is enabled and available
- WHEN a public catalog read is requested
- THEN the adapter MUST return mapped API data without a write migration

#### Scenario: Public rollback
- GIVEN public API use is disabled by configuration
- WHEN a public catalog read is requested
- THEN the configured mock implementation MUST remain available without URL changes

### Requirement: Compatibility and UI States

Adapters MUST preserve public URL lookup, legacy field parity, numeric money/stock values, and distinct public/admin projections. Consumers MUST receive explicit loading, error, and empty outcomes; an empty result MUST NOT be represented as a transport failure.

#### Scenario: Legacy public detail
- GIVEN an API product with `publicSlug` and deferred visual fields
- WHEN the repository maps a product detail
- THEN it MUST expose the existing public `slug` and required compatible legacy fields

#### Scenario: Loading, error, and empty results
- GIVEN pending, failed, and zero-match repository reads
- WHEN each state is consumed
- THEN each MUST be distinguishable and the failure MUST preserve the safe API error meaning

### Requirement: Mock Removal Gate

Catalog mocks MUST NOT be removed until API model, migration, seed, endpoints, validation, mappers, repository, UX states, contract verification, and restart persistence have achieved parity. The system MAY retain mocks while that gate is incomplete.

#### Scenario: Incomplete parity
- GIVEN catalog writes or a required compatibility field remain unmigrated
- WHEN Phase 2 is delivered
- THEN catalog mocks MUST remain available behind the feature flag

### Requirement: Protected Admin Cache Isolation

Protected catalog requests MUST use non-shared cache semantics and MUST NOT statically reuse authenticated data across admin sessions.

#### Scenario: Session replacement
- GIVEN a prior admin session was terminated
- WHEN a new bootstrap begins
- THEN stale catalog records MUST NOT render before new authorization succeeds
