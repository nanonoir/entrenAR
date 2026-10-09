# Catalog Taxonomy Sync Specification

## Purpose

Synchronize the approved Entreno-to-EntrenAR taxonomy and expose deterministic category behavior.

## Requirements

### Requirement: Approved Taxonomy Artifact

The system MUST consume a versioned, tracked 61-category reconciliation artifact from a stable backend source-data location. It MUST contain canonical hierarchy data and source-to-canonical mappings, reject promotional or brand nodes, duplicate slugs, unknown parents, and cycles, and generate deterministic run `categories.json`. It MUST NOT regenerate the approved taxonomy from current source observations. (Previously: the artifact generated deterministic categories without a fixed versioned source mapping.)

#### Scenario: Valid hierarchy artifact

- GIVEN approved mappings and memberships
- WHEN run categories are generated
- THEN ordering and parent references are stable
- AND rejected collection nodes are absent

#### Scenario: Cyclic hierarchy

- GIVEN an artifact with a parent cycle
- WHEN validation runs
- THEN preparation fails and synchronization is not successful

### Requirement: Run-Bound Idempotent Category Synchronization

The system MUST synchronize only the selected run's frozen `categories.json` after verifying its recorded `categories.json` digest, run ID, and operator-confirmed fingerprint against the configured database. It MUST NOT compare `categories.json` to the distinct `taxonomy.json` digest. It MAY create or update approved nodes but MUST NOT duplicate nodes or delete unrelated categories. It MUST report created, updated, unchanged, and conflict counts in run evidence and record `CATEGORIES_SYNCED` only after successful synchronization for that target; a digest, target, or synchronization failure MUST leave the run not ready. (Previously: synchronization required run and target confirmation but did not explicitly bind the frozen categories digest or persist successful handoff evidence.)

#### Scenario: Safe rerun
- GIVEN categories were synchronized for the selected run and confirmed target
- WHEN synchronization runs again with the same frozen artifact
- THEN the taxonomy is unchanged, no duplicate is created, and the run records the unchanged count

#### Scenario: Unrelated destructive conflict
- GIVEN synchronization would require deleting an unrelated category
- WHEN the command evaluates the change
- THEN it fails before deletion, reports the conflict, and does not record success

#### Scenario: Frozen categories verified
- GIVEN `categories.json` matches its own recorded digest and the target matches confirmation
- WHEN handoff synchronizes categories
- THEN it records `CATEGORIES_SYNCED` for that run and target with synchronization counts

#### Scenario: Wrong target or altered categories
- GIVEN the configured target differs from confirmation or `categories.json` differs from its recorded digest
- WHEN handoff is requested
- THEN it rejects before category mutation and the run remains not ready

### Requirement: Hierarchy-Derived Membership and Projection

The system MUST map each extracted source membership through the approved artifact and preserve every approved product category membership, including root/intermediate-only and multi-leaf memberships. It MUST require at least one synchronized category per included product and derive public/admin category projection and primary category deterministically from hierarchy and route priority, never CUID or stale JSON arrays. Storefront routes MUST support `performance` and `control-de-peso`. A new, renamed, unknown, or ambiguous source category MUST produce drift evidence and block readiness; an absent source category MUST NOT delete a canonical category. (Previously: membership behavior did not require run-specific source drift blocking.)

#### Scenario: Parent-only membership

- GIVEN a product belongs directly to an intermediate category
- WHEN its manifest and listing projection are produced
- THEN that membership is retained without fabricating a leaf
- AND a deterministic primary category is available

#### Scenario: Multi-category route projection

- GIVEN a product belongs to multiple approved leaf categories including `performance`
- WHEN storefront projection is resolved
- THEN all memberships are retained
- AND the `performance` route includes the product deterministically

#### Scenario: Ambiguous source category

- GIVEN a source membership maps ambiguously
- WHEN reconciliation runs
- THEN the run records drift and MUST NOT become ready

### Requirement: Scrape-Time Approved Reconciliation

`catalog:scrape` MUST consume the tracked approved 61-category artifact, freeze that version as `taxonomy.json`, and derive run `categories.json` deterministically without regenerating the taxonomy from live observations. It MUST resolve actual source memberships through approved mappings, retain root/intermediate-only and multiple approved memberships, and report absent source categories without deleting canonical nodes. Invalid artifacts and unknown or ambiguous mappings MUST block the run; scrape MUST NOT synchronize database categories.

#### Scenario: Multiple approved memberships
- GIVEN a product belongs to approved parent and leaf source categories
- WHEN its memberships are reconciled
- THEN all approved memberships appear in deterministic order without fabricated leaves

#### Scenario: Unknown membership drift
- GIVEN a discovered source category has no unambiguous approved mapping
- WHEN reconciliation runs
- THEN the report identifies drift and the run remains non-ready without database writes

