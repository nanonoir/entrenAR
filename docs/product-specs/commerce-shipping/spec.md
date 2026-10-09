# Commerce Shipping Specification

## Purpose

Manage shipping providers, weight-band costs, and pickup points. This capability excludes checkout calculations, orders, sales, CRM, real emails, and mock removal before its dedicated gate.

## Requirements

### Requirement: Valid Shipping Cost Configuration

The system MUST persist provider costs by non-overlapping weight bands. A band MAY have no upper bound; active configuration MUST satisfy its required cost and schedule rules. Invalid ranges or costs MUST return controlled validation errors without partial persistence.

#### Scenario: Save open-ended band

- GIVEN an administrator and valid non-overlapping provider bands
- WHEN the administrator configures a final band without an upper bound
- THEN the system persists and returns the open-ended band

#### Scenario: Reject overlap

- GIVEN a provider with an existing weight band
- WHEN an administrator submits an overlapping band
- THEN the system rejects the change and preserves the prior bands

### Requirement: Single Main Pickup Point

The system MUST persist pickup points and ensure at most one main pickup point at a time, including concurrent administrative updates. An active pickup point MUST have valid schedule data.

#### Scenario: Replace main pickup point

- GIVEN one persisted main pickup point
- WHEN an administrator marks another pickup point as main
- THEN the new point is main and the former point is not main

#### Scenario: Reject invalid active pickup point

- GIVEN a pickup point without a valid schedule
- WHEN an administrator activates it
- THEN the system returns a validation error and leaves it inactive

### Requirement: Authorized Shipping Consumption

The system MUST restrict shipping mutations to administrators and MUST provide configuration through frontend repository/API adapters with the existing mocks as fallback until the mock-removal gate.

#### Scenario: Deny shipping mutation to non-admin

- GIVEN an authenticated non-administrator
- WHEN the client changes provider or pickup-point configuration
- THEN the system denies the request and persisted configuration is unchanged
