# Catalog Target Identity Specification

## Purpose

Identify the selected database safely before any catalog database write.

## Requirements

### Requirement: Sanitized Target Report

The system MUST offer a read-only target-info report for the configured database with a sanitized destination identity and a stable fingerprint. The fingerprint MUST change for a different destination; the report, errors, and logs MUST NOT expose connection strings, credentials, or sensitive query parameters.

#### Scenario: Inspect selected local destination
- GIVEN a configured local database
- WHEN the operator requests target-info
- THEN the report identifies that destination and its fingerprint without database mutation or secrets

#### Scenario: Destination or credentials change
- GIVEN two configurations addressing different databases, or different credentials for the same database
- WHEN target-info reports each destination
- THEN different databases have different fingerprints and credential-only changes do not change the destination fingerprint

### Requirement: Explicit Destination Selection

The system MUST accept a user-confirmed fingerprint of the configured database for each database-writing stage, whether local or production. It MUST NOT infer approval from an environment label or allow a confirmation for one destination to authorize another.

#### Scenario: Confirm local destination
- GIVEN target-info identifies the configured local database
- WHEN the operator confirms its fingerprint for category synchronization
- THEN that target MAY be used for the confirmed stage

#### Scenario: Target switched after confirmation
- GIVEN confirmation of one database fingerprint
- WHEN the configured destination changes before a write
- THEN the write is rejected without modifying either database
