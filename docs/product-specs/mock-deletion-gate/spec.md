# Mock Deletion Gate Specification

## Purpose

Define an API-first frontend boundary while retaining explicitly justified fixtures and static UI content.

## Requirements

### Requirement: Canonical Domain Types

The system MUST define reusable commerce and admin domain types outside `src/lib/data/`. Legacy data modules MAY re-export those types during migration.

#### Scenario: UI imports a domain type

- GIVEN a component requires an admin product or customer type
- WHEN it is updated or created
- THEN it imports the type from a canonical non-data module
- AND it does not depend on a mock fixture for its type definition

#### Scenario: Existing imports remain compatible

- GIVEN a legacy consumer imports a migrated type from a data module
- WHEN the type is extracted
- THEN a compatible type re-export preserves that consumer

### Requirement: Repository-Only Entity Reads

Active shop and admin UI, stores, and derived operational helpers MUST obtain catalog, account, sales, and tracking entities through their domain repositories. They MUST NOT read entity mock arrays or mock-only helpers directly.

#### Scenario: API-mode operational read

- GIVEN `NEXT_PUBLIC_DATA_SOURCE=api`
- WHEN a product selector, account, tracking, discount, or shipment view loads
- THEN it requests the applicable repository
- AND it does not display a direct static entity fixture

#### Scenario: Repository mock fallback

- GIVEN an offline demo or contract harness selects mock mode
- WHEN a repository read occurs
- THEN the repository MAY serve its retained fixture
- AND no active UI bypasses that repository boundary

### Requirement: API-First Environment Default

Root frontend environment documentation MUST set `NEXT_PUBLIC_DATA_SOURCE=api` and document the API base URL. An unset runtime data-source setting SHOULD resolve to API mode; explicit mock mode MUST remain available.

#### Scenario: Production template

- GIVEN a developer copies the root environment template
- WHEN the application starts with its documented values
- THEN frontend reads target the API base URL in API mode

### Requirement: Justified Residual Data

The system MUST retain only documented residual fixtures needed for repository harnesses, offline resilience, unavailable telemetry, or static UI configuration. `visits.ts` MAY remain until a tracking source exists; navigation, footer, home, and promotion content SHALL remain static UI assets.

#### Scenario: Telemetry source is unavailable

- GIVEN no analytics backend supplies visit metrics
- WHEN an admin visit report is rendered
- THEN the justified visit fixture MAY provide the report
- AND it is not represented as an authoritative commerce entity source

### Requirement: Empty Cart Initialization

The cart store MUST initialize a new guest cart with an empty item collection. It MUST NOT preload preview cart fixtures; persisted cart state MAY hydrate after initialization.

#### Scenario: First guest visit

- GIVEN no persisted cart state exists
- WHEN a guest opens the storefront
- THEN the cart contains zero items
