# Catalog Import Hardening Specification

## Purpose

Safely persist a prepared catalog at full scale while preserving the importer as the authoritative boundary.

## Requirements

### Requirement: Product Logistics Import Contract

The canonical import contract MUST accept required positive `weightGrams` and optional positive `widthCm`, `heightCm`, and `lengthCm`. The importer MUST persist these values and derive incomplete logistics from missing dimensions rather than source input. It MUST reject invalid logistics and MUST NOT introduce a parallel final validator.

#### Scenario: Valid logistics persistence

- GIVEN a canonically validated product with weight and partial dimensions
- WHEN the importer persists it
- THEN the product retains the normalized measurements
- AND incomplete logistics is derived from absent dimensions

#### Scenario: Invalid required weight

- GIVEN a manifest product lacks a positive `weightGrams`
- WHEN canonical validation runs
- THEN validation rejects the manifest
- AND no product persistence begins

### Requirement: Clean-Target and Explicit Import Boundary

The system MUST provide categories-only preparation and retain `catalog:import` as the sole product persistence boundary. Import MUST require explicit approval of the exact run ID, frozen `products.json` SHA-256, and fingerprint of the currently configured database, without restricting the command to local or production. It MUST reject missing/mismatched approval, a non-`READY` run, or a manifest path not owned by the approved run before product writes. It MUST recheck mutable target, digest, categories, R2 readiness, and clean-target guards; the repository MUST check that Product is empty inside its exclusive transaction immediately before persistence. Preparation and category synchronization MUST NOT invoke import. (Previously: an explicit import and clean target were required but command arguments were not enforced against the run and configured destination.)

#### Scenario: Populated product target
- GIVEN the target contains one product and synchronized categories
- WHEN approved import starts or reaches the exclusive transaction
- THEN it rejects without product writes and identifies the non-empty target

#### Scenario: Changed approval evidence
- GIVEN an operator approved a run, manifest digest, and target fingerprint
- WHEN any approval or mutable safety check no longer matches
- THEN import aborts before writes and requires fresh confirmation

#### Scenario: Prepared handoff
- GIVEN preparation has produced a ready report
- WHEN preparation ends
- THEN no product import command has run and an operator must invoke `catalog:import` explicitly

#### Scenario: Unowned manifest or omitted approval
- GIVEN a manifest outside the approved run or any missing approval value
- WHEN import is invoked
- THEN it rejects before persistence even if the manifest content is otherwise valid

#### Scenario: Prepared run approval
- GIVEN run `run-20260928232548266-6ca4606a` owns `products.json` with SHA-256 `5093a00949525fec13f8814f680a51d50823e3748a3b1d3306c105f6aa218dd6`
- WHEN import is approved with that run ID, digest, and the selected database fingerprint
- THEN only that run's frozen manifest is eligible for the remaining safety checks

### Requirement: Coordinated Atomic Full-Catalog Ingestion

The importer MUST execute only one approved, observed process and retain exclusive atomic full-catalog ingestion. On success it MUST report the approved run ID, selected target fingerprint, and committed product, variant, image, and category-link counts matching the frozen manifest. On transaction failure it MUST roll back all rows from that attempt; earlier independently synchronized categories MUST remain intact. A committed import with failed run-record persistence MUST be reported as requiring reconciliation, never as safely retryable. (Previously: atomic ingestion required run-bound counts but did not distinguish a committed transaction from failed local evidence recording.)

#### Scenario: Full-scale successful import
- GIVEN an empty target and an approval-bound ready manifest
- WHEN the single authorized importer succeeds
- THEN committed counts match the manifest and the run records `IMPORTED` for the selected target

#### Scenario: Late persistence failure
- GIVEN persistence fails after writes begin
- WHEN the transaction ends
- THEN no product, variant, image, or category-link rows from this attempt remain

#### Scenario: Evidence failure after commit
- GIVEN persistence commits but the local result cannot be recorded
- WHEN an operator inspects the failure
- THEN the import reports reconciliation required and refuses a blind second import
