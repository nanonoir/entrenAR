# Catalog Ingestion Run Specification

## Purpose

Define immutable, auditable one-shot Entreno catalog preparation runs.

## Requirements

### Requirement: Run Identity and Frozen Snapshot

The system MUST allocate a globally unique run ID before source requests begin and store all run material under `scrape-output/{run-id}/`. It MUST record lifecycle status, timestamps, sanitized target and build fingerprints, digests, expected objects, counts, stages, blockers, and results in `run.json`. Once frozen, source observations MUST NOT be re-fetched or merged into the run.

#### Scenario: Snapshot freeze

- GIVEN a run is extracting source observations
- WHEN normalized observations are frozen
- THEN their digests and extraction window are recorded
- AND later source changes cannot alter that run

#### Scenario: Frozen input mutation

- GIVEN a frozen run has changed source, taxonomy, manifest, or asset bytes
- WHEN readiness is evaluated
- THEN the run is invalidated and MUST NOT become ready

### Requirement: Recovery and Storage Resumption

The system MUST distinguish `CREATED`, `EXTRACTING`, `SNAPSHOT_FROZEN`, `ASSETS_VALIDATED`, `R2_RESET`, `ASSETS_UPLOADED`, `CATEGORIES_SYNCED`, `READY`, `IMPORTING`, `IMPORTED`, and `FAILED`. A pre-freeze failure MUST require a new run. A frozen run MAY resume only from frozen categories, manifest, inventory, and validated local bytes. For the already uploaded run, it MUST reconcile reset/upload stage evidence by read-only verification of the exact R2 set, authenticated integrity, and public availability, without resetting, deleting, or uploading objects. Partial or uncertain R2 evidence MUST block this handoff without mutation; any later repair requires a separately authorized storage operation. `READY` MUST require persisted successful freeze, taxonomy, local assets, storage evidence, category synchronization, manifest validation, and no-write preflight. (Previously: interrupted storage work required a new confirmed reset and complete re-upload; this corrective handoff must not mutate the already uploaded inventory.)

#### Scenario: Interrupted upload recovery
- GIVEN a frozen run has a partial upload
- WHEN an operator requests read-only reconciliation
- THEN its run ID and digests remain unchanged, it stays non-ready, and no reset or re-upload occurs

#### Scenario: Missing readiness evidence
- GIVEN a run lacks successful preflight or exact-set evidence
- WHEN readiness is evaluated
- THEN it MUST NOT transition to `READY`

#### Scenario: Failed preparation stage
- GIVEN any mandatory preparation stage fails
- WHEN the run record is updated
- THEN it records sanitized blockers and remains non-ready

#### Scenario: Verified existing storage
- GIVEN the current run's 3,790-object frozen inventory exactly matches authenticated and publicly available R2 objects
- WHEN the run's previous storage operations are reconciled
- THEN successful reset/upload verification evidence is persisted without any R2 mutation

### Requirement: Audit Outputs and Git Isolation

The system MUST produce `run.json`, `categories.json`, canonical-only `products.json`, `report.md`, immutable source material, and validated asset bytes for each frozen run. Reports MUST classify exclusions with stable reason evidence and MUST NOT reveal credentials or sensitive identifiers. Run outputs MUST be Git-ignored and MUST NOT be committed.

#### Scenario: Exclusion evidence

- GIVEN a product is excluded during preparation
- WHEN the report is generated
- THEN it identifies the source, reason code, and relevant evidence
- AND `products.json` omits all run and source metadata

### Requirement: Complete Scrape-Only Run Evidence

`catalog:scrape` MUST allocate a unique Git-ignored `scrape-output/{run-id}/` without overwriting previous runs. A successful preparation MUST freeze mutually consistent `source.json`, `taxonomy.json`, `categories.json`, canonical `products.json`, `inventory.json`, `report.md`, local assets, and `run.json`. The record MUST bind file digests, accepted/excluded counts, expected objects, and the bounded observation window. Inventory MUST contain exactly the accepted manifest images with matching local size and SHA-256. Identical observations MUST yield identical ordered payloads, excluding run identity and timestamps.

#### Scenario: Consistent frozen run
- GIVEN discovery and accepted assets complete in different request orders
- WHEN the run is frozen
- THEN payload ordering and counts are stable and every referenced asset matches inventory and local bytes

#### Scenario: Partial persistence
- GIVEN writing a mandatory frozen artifact fails
- WHEN scrape exits
- THEN the run is non-ready, partial files are not consumable, and an attempt needs a new run

### Requirement: Accountable Non-Ready Preparation

The report MUST account for every discovered URL as accepted, excluded, or extraction-failed with stable reasons and counts, and MUST describe its observation window without claiming an atomic source snapshot. Global sitemap, parser-systemic, taxonomy, or persistence failures MUST fail closed; isolated product failures MAY leave healthy products eligible. Scrape MUST report `PREPARED`/`NOT_READY`, never `READY`, and MUST NOT invoke R2 reset/upload, category sync, preflight, or `catalog:import`; only later command evidence can establish readiness.

#### Scenario: Isolated product failure
- GIVEN one product fails extraction and another passes
- WHEN scrape completes
- THEN both URLs are accounted for and the successful run remains not ready for import

#### Scenario: Systemic failure or missing downstream evidence
- GIVEN source parsing fails systemically or downstream stages have not succeeded
- WHEN scrape evaluates completion
- THEN it cannot report `READY` or initiate storage or database writes

### Requirement: Run-Bound Import Outcome

The run MUST record the approved target fingerprint, run ID, manifest digest, lifecycle status, and committed product, variant, image, and category-link counts on successful import. It MUST distinguish a transaction failure from a committed import whose local run-record update failed; the latter MUST NOT be retried as a fresh import and MUST require read-only target reconciliation before correcting local evidence.

#### Scenario: Committed import record cannot be saved
- GIVEN the catalog transaction commits but saving `IMPORTED` fails
- WHEN the command reports its outcome
- THEN it reports indeterminate local evidence, forbids blind retry, and requires read-only count reconciliation

#### Scenario: Transaction rolls back
- GIVEN persistence fails before commit
- WHEN the outcome is recorded
- THEN no rows from that attempt are committed and the run does not report `IMPORTED`

