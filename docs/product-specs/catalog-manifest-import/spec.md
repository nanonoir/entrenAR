# Catalog Manifest Import Specification

## Purpose

Define one-shot manifest import behavior.

## Requirements

### Requirement: Complete Manifest Preflight

The system MUST provide `catalog:preflight` as an executable no-business-write command for a selected run and confirmed database fingerprint. It MUST read the selected database's actual Product count and canonical category slugs, re-evaluate frozen file and manifest digests, run identity, build and target compatibility, required persisted stages, canonical validation, category existence, zero products, slug/SKU conflicts, exact R2 inventory, authenticated object size/digest and public availability, counts, and blockers. It MUST persist sanitized pass/fail evidence locally and set `READY` only when every check succeeds; failure MUST leave the run non-ready. It MUST NOT synchronize categories, mutate R2, scrape, or persist products. (Previously: preflight was no-write but actual database facts and persistent `READY` outcome were not guaranteed.)

#### Scenario: Valid ready run
- GIVEN a selected run has matching frozen digests, required stages, confirmed target, synchronized categories, zero products, and exact verified assets
- WHEN the no-business-write preflight command completes
- THEN it persists successful evidence and transitions that run to `READY` without database or R2 mutation

#### Scenario: Preflight mismatch
- GIVEN a run has a changed digest, missing object, public-head failure, or target mismatch
- WHEN preflight runs
- THEN it persists a sanitized failure, remains non-ready, and performs no business write

#### Scenario: Actual target facts conflict
- GIVEN the selected database contains a Product or lacks a required canonical category slug
- WHEN preflight inspects the database
- THEN it reports the observed blocker instead of treating placeholder values as valid

#### Scenario: Extra or invalid stored asset
- GIVEN R2 contains an extra key or an expected key has incorrect size or digest
- WHEN preflight checks the complete expected set
- THEN it fails and cannot grant `READY` or alter R2

### Requirement: Clean-Target One-Shot Import

The importer MUST create a complete catalog only on a clean target. It MUST reject existing Product slug, public slug, or variant SKU conflicts and MUST NOT reconcile, update, infer deletions, or reimport a populated catalog.

#### Scenario: First import
- GIVEN a clean target and a preflight-approved manifest
- WHEN import succeeds
- THEN every manifest Product is created

#### Scenario: Second import
- GIVEN an already populated target
- WHEN another manifest is submitted
- THEN it MUST fail as a conflict without modifying the catalog

### Requirement: Atomic Result and Safe Error Report

Persistence MUST be atomic: a failure MUST commit no Product, variant, image, or category association. Errors MUST identify the affected product and field/key without raw payloads, credentials, or stacks. Successful imports MUST be immediately visible.

#### Scenario: Persistence failure
- GIVEN a failure during catalog persistence
- WHEN import completes
- THEN the catalog remains unchanged and a structured error is returned

#### Scenario: Immediate visibility
- GIVEN a successful import
- WHEN a catalog consumer reads an imported identity
- THEN it receives the canonical product immediately

### Requirement: Prefix-Scoped Reset and Exact Asset Set

The system MUST reset only `products/` after a six-field confirmation of selected run ID, target environment, destination fingerprint, manifest digest, literal prefix, and expected object count. It MUST validate configuration, paginate listings, delete only listed `products/` keys, verify the prefix is empty, then upload only frozen inventory assets using validated local bytes. `READY` requires authenticated integrity and public HEAD verification for every reference and a paginated listing exactly equal to the expected set; uncertainty, missing, extra, size/digest mismatch, or excluded-product objects MUST block import. Outputs MUST contain only sanitized codes, fingerprints, and counts. (Previously: reset and verification requirements did not require an executable paginated adapter or strict six-field command confirmation.)

#### Scenario: Prefix escape attempt
- GIVEN a reset prefix differs from `products/`
- WHEN reset validation runs
- THEN destructive work is rejected before R2 I/O

#### Scenario: Incomplete confirmation
- GIVEN any required confirmation field is absent or mismatched
- WHEN reset or upload is requested
- THEN it fails closed without mutation

#### Scenario: Extra object after upload
- GIVEN all expected assets upload successfully
- WHEN paginated prefix listing contains an additional key
- THEN the run MUST NOT become ready

### Requirement: Operational Handoff Test Coverage

The system MUST have focused automated coverage at mocked R2 and filesystem boundaries for compiled command wiring, six-field confirmation, prefix escape, pagination, partial upload, exact-set/integrity failures, public-head failure, and readiness sequencing. Tests MUST prove that rejected reset, upload, handoff, and preflight paths make no forbidden write or import.

#### Scenario: Safe command path
- GIVEN a mocked selected run and paginated R2 responses
- WHEN reset, upload, and no-write preflight are exercised
- THEN each command reaches its intended operation and records the expected result

#### Scenario: Rejected command path
- GIVEN invalid confirmation or failed integrity evidence
- WHEN the relevant command is exercised
- THEN it performs no forbidden mutation or import
