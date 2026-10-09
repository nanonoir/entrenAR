# PRD — Entreno Real Catalog Ingestion and R2 Handoff

**Status:** Refined — Ready for SDD  
**Refined:** 2026-09-28  
**Product SSOT:** This document is authoritative for the proposal, specification, design, task, implementation, and verification phases of this change.  
**Depends on:** PRD2, archived at `openspec/changes/archive/2026-09-27-prd2-entreno-catalog-scraper-import-pipeline/`.

## Objective

Complete the one-shot production preparation and coordinated import of Entreno's real catalog by turning PRD2's verified foundations into one safe, immutable, auditable ingestion run:

```text
live Entreno extraction
→ immutable local snapshot
→ approved taxonomy reconciliation
→ local WebP download and validation
→ explicit products/ R2 reset
→ current-run asset upload and verification
→ real categories.json, products.json, and report.md
→ idempotent category synchronization
→ complete no-write preflight
→ explicit user/orchestrator approval
→ one atomic catalog:import execution
```

The preparation flow MUST NOT import products implicitly.

## Problem

PRD2 delivered and verified the canonical importer, clean-target guard, atomic persistence, category synchronization, scraper primitives, R2 adapter, report infrastructure, and operational evidence. The current commands remain preparation scaffolding rather than a complete live ingestion flow:

- `catalog:scrape` writes flat fixture-oriented outputs and may report readiness without category synchronization, asset upload, or full preflight;
- `catalog:handoff` generates a one-product fixture;
- the current transformer does not preserve the real Tiendanube variant matrix, stock, prices, category memberships, or variant-image associations;
- R2 storage has no bounded listing/reset operation;
- commands and reports are not bound to an immutable run ID;
- `catalog:import` accepts only a manifest path and has no explicit target/run confirmation;
- generated outputs are not governed by a durable Git policy.

PRD3 closes these gaps without weakening the PRD2 product and importer contracts.

## Goals

1. Capture one complete, immutable local snapshot of the Entreno catalog per run.
2. Preserve real accepted variants, stock, pricing, category memberships, galleries, and logistics under the PRD2 contract.
3. Use the approved 61-category taxonomy as a fixed business baseline and detect source taxonomy drift.
4. Download and validate accepted product assets locally before any destructive R2 action.
5. Reset only the configured `products/` R2 prefix after explicit confirmation, then upload and verify only current-run assets.
6. Generate a canonical `products.json` containing only accepted products.
7. Exclude every product that fails required product or asset validation with a stable, explicit reason.
8. Bind preparation evidence, user approval, preflight, and final import to the same run ID and manifest digest.
9. Protect the real database through explicit environment confirmation, zero-product target checks, complete preflight, and atomic import.
10. Leave a reviewable local audit trail without committing run-specific catalog data.

## Non-Goals

- Scheduled or recurring scraping.
- Incremental, delta, or update imports.
- Automatic product import.
- Browser automation or source protection bypass.
- Variant-level pricing support beyond the existing EntrenAR domain.
- More than two variant properties.
- Automatic SKU repair or deduplication.
- Image conversion or recompression unless separately approved.
- Cross-system distributed transactions.
- General R2 garbage collection outside the explicit `products/` reset.
- A new admin UI for ingestion runs.

## Codebase Alignment and Binding Invariants

1. `normalizeCatalogImportManifest` remains the sole final product-manifest validator.
2. `catalog:import` remains the sole authoritative product persistence boundary.
3. Product persistence remains one exclusive atomic transaction with PRD2 rollback guarantees.
4. The target MUST contain zero `Product` rows immediately before persistence; existing categories are allowed.
5. Canonical R2 keys remain exactly `products/{product-slug}/{position}.webp`. Run IDs MUST NOT be inserted into storage keys.
6. Run isolation is provided by immutable local snapshots, cryptographic digests, and an exact expected-object inventory.
7. The approved 61-category taxonomy is fixed input, not silently regenerated from the current source.
8. The tracked taxonomy input MUST live in a stable backend source-data location, separate from generated run output, and include the source-to-canonical mapping needed for membership reconciliation.
9. Source taxonomy changes MUST be reported as drift. Unknown or ambiguous mappings block readiness; disappeared source categories do not delete approved canonical categories.
10. Real Tiendanube variants, sparse combinations, zero-stock variants, stock mode, SKUs, option values, and variant-image associations MUST be preserved as required by PRD2.
11. Every selected gallery image is mandatory for its product. Any download, WebP validation, upload, integrity, or existence failure excludes that product from the final manifest.
12. All products participating in a duplicate-SKU conflict MUST be excluded.
13. No credential, signed URL, endpoint secret, bucket identifier, or raw database URL may appear in reports or command output.
14. User/orchestrator coordination means one approved and observed import process, never duplicate concurrent importer executions.

## Run Identity and Immutable Snapshot

Each preparation attempt MUST allocate a globally unique run ID before source requests begin. A recommended human-readable form is:

```text
entreno-{UTC timestamp}-{random suffix}
```

Each run lives under:

```text
scrape-output/{run-id}/
```

The run MUST contain a machine-readable `run.json` control record in addition to the required handoff files. It MUST record at least:

- run ID and status;
- start, snapshot-freeze, readiness, and completion timestamps where applicable;
- source sitemap URL and extraction window;
- selected application revision/build identifier;
- non-secret target-environment fingerprint;
- snapshot, taxonomy, products manifest, and report digests;
- expected R2 object keys and per-object content digest or equivalent integrity evidence;
- accepted/excluded product, variant, image, and category counts;
- completed stages and blockers;
- category synchronization result;
- final preflight result;
- import result when executed.

The source snapshot is an immutable capture of observations made during a bounded extraction window. The system MUST NOT claim that Entreno provides a globally transactional point-in-time view.

Once frozen, a run MUST NOT re-fetch or merge live product/category data into that run. Any source re-extraction requires a new run ID.

## Run Lifecycle and Recovery

The run lifecycle MUST distinguish at least:

```text
CREATED
EXTRACTING
SNAPSHOT_FROZEN
ASSETS_VALIDATED
R2_RESET
ASSETS_UPLOADED
CATEGORIES_SYNCED
READY
IMPORTING
IMPORTED
FAILED
```

Rules:

- A failure before `SNAPSHOT_FROZEN` requires a new run.
- A frozen run may resume local validation, reset, or upload stages using only its frozen source data and downloaded bytes.
- Resuming an incomplete upload requires a new explicit reset confirmation, a fresh `products/` prefix reset, and a complete re-upload from the frozen local asset set.
- A resumed run MUST retain the same run ID and digests.
- Any mutation to frozen source data, accepted manifest, taxonomy input, or validated bytes invalidates the run and requires a new run ID.
- A failed or interrupted run MUST remain `NOT_READY` until every readiness condition is re-established.

## Live Source Extraction

The pipeline MUST:

1. use the authoritative sitemap for product discovery;
2. deduplicate and stably order `/productos/*` URLs;
3. use bounded HTTP concurrency, 15-second timeouts, and PRD2 retry rules;
4. parse structured `data-variants` and `nube-sdk-script` data before presentation text;
5. preserve real variants, stock management, quantities, SKUs, prices, compare-at prices, option names/values, image associations, galleries, logistics, and memberships;
6. isolate permanent product-level extraction failures instead of aborting an otherwise healthy run;
7. freeze normalized source observations before storage mutation begins;
8. report the extraction window and all source failures.

Changes observed in Entreno during extraction MUST be represented by the values actually frozen in the run. The pipeline MUST NOT silently refresh individual products after snapshot freeze.

## Product Transformation and Exclusions

PRD2 transformation rules remain binding. In particular:

- retain real variants, including tracked zero-stock variants;
- map unmanaged inventory to the existing infinite-stock contract;
- retain sparse one- and two-property combinations;
- exclude products with more than two properties;
- exclude every product involved in duplicate SKU ownership;
- exclude products with unsupported variant price variance;
- exclude incompatible compare-at pricing;
- require positive normalized product weight;
- retain valid weight when optional dimensions are missing and report a warning;
- require at least one approved category membership;
- require at least one fully validated gallery image;
- exclude malformed or incomplete product-specific data without failing a healthy global run.

The historical PRD2 census of 676 discovered, 657 accepted, and 19 excluded products is comparison evidence, not a hardcoded expected result. The current run report MUST explain every count difference.

## Approved Taxonomy and Membership Reconciliation

The approved taxonomy consists of 61 active canonical categories derived from the PRD2 reconciliation evidence. It MUST be consumed as a versioned, tracked backend artifact.

For every product, the run MUST extract actual source memberships and map them through the approved source-to-canonical reconciliation. It MUST preserve:

- root and intermediate-only memberships;
- all approved multi-category memberships;
- deterministic category ordering;
- hierarchy-derived primary category behavior;
- `performance` and `control-de-peso` route compatibility.

Drift behavior:

- a known source category maps through the approved artifact;
- a new, renamed, or ambiguous source category is reported and blocks readiness until explicitly reconciled;
- a source category absent from the current run produces drift evidence but does not delete the canonical category;
- promotional, brand, or rejected collection nodes remain excluded;
- category synchronization MUST remain idempotent and MUST NOT delete unrelated categories.

## Local Asset Preparation

All accepted gallery images MUST be downloaded and validated locally before R2 reset.

Each image MUST satisfy:

- HTTP 200;
- bounded response size;
- WebP-compatible MIME;
- valid RIFF/WEBP bytes;
- stable source order and positive 1-based position;
- calculated content digest;
- canonical destination key.

If any selected gallery image fails, its product MUST be excluded and none of that product's assets may appear in the final expected-object inventory.

The accepted manifest and expected-object inventory MUST be frozen before the destructive storage gate.

## R2 Reset Safety Contract

The reset MUST operate exclusively on the `products/` prefix. Full-bucket deletion is forbidden even if the current bucket is believed to be empty or dedicated.

Before reset, the command MUST require explicit confirmation of:

- exact run ID;
- target environment;
- non-secret storage destination fingerprint;
- exact prefix `products/`;
- frozen products-manifest digest;
- expected object count.

The reset implementation MUST:

1. validate R2 configuration before destructive work;
2. reject any configured reset prefix other than the approved `products/` boundary;
3. list all pages under `products/`;
4. delete only listed keys under that prefix;
5. repeat listing until the prefix is verified empty;
6. treat authentication, pagination, deletion, or verification uncertainty as a blocker;
7. never inspect, delete, or report objects outside `products/`;
8. record sanitized counts and completion evidence in `run.json` and `report.md`.

## R2 Upload and Exact-Set Verification

After verified reset, upload only assets in the frozen current-run inventory using canonical deterministic keys.

A run cannot become `READY` until:

- every expected object was uploaded;
- every expected object passes authenticated existence and integrity verification;
- public `ASSETS_BASE_URL` HEAD succeeds for every manifest reference;
- listing `products/` yields exactly the expected key set, with no missing or extra old objects;
- verified object integrity matches the frozen local inventory;
- no asset from an excluded product is present.

A partial upload leaves the run `FAILED` or `NOT_READY` and MUST NOT permit import.

## Required Run Outputs

Every frozen run MUST produce:

```text
scrape-output/{run-id}/
├── run.json
├── categories.json
├── products.json
├── report.md
├── source/            # immutable local source snapshot or equivalent
└── assets/            # validated local accepted bytes or equivalent
```

`products.json` MUST contain only the strict canonical import manifest. It MUST NOT contain run metadata, source URLs, source IDs, warnings, exclusions, or derived internal fields.

`categories.json` MUST contain the approved canonical taxonomy used by the run.

`report.md` MUST identify every excluded product with source identity, URL, stable reason code, explanation, and relevant SKU/variant/asset evidence. It MUST also report baseline drift, stage results, timings, counts, warnings, blockers, and final readiness.

## Git and Retention Policy

- The canonical approved taxonomy and mapping artifact is versioned under a stable backend source-data path.
- `scrape-output/**` is generated local state and MUST be Git-ignored.
- Run-specific source snapshots, local image bytes, `run.json`, `categories.json`, `products.json`, and `report.md` MUST NOT be committed.
- The currently tracked `scrape-output/categories.json` fixture MUST be migrated to the canonical source-data location before the output directory is fully ignored.
- Credentials remain only in ignored environment files.
- Retention or deletion of old local run directories is a manual operator concern outside this change.

## Category Synchronization

For the selected run, `catalog:sync-categories` MUST consume that run's `categories.json`, confirm the same run ID and environment fingerprint, and report created, updated, unchanged, and conflict counts.

Any sync conflict or target mismatch leaves the run `NOT_READY`. Successful synchronization MUST be recorded in the run evidence.

## No-Write Preflight

`catalog:preflight` MUST become a real no-write command rather than an alias of scraping. It MUST accept the selected run and re-evaluate:

- run status and immutable digests;
- application revision/build compatibility;
- target environment confirmation;
- canonical manifest validation;
- synchronized existence of every referenced category;
- zero `Product` rows;
- absence of slug/SKU conflicts;
- exact R2 object set;
- authenticated and public object existence;
- object integrity evidence;
- accepted/excluded/count consistency;
- absence of blockers or changed frozen files.

Preflight MUST NOT synchronize categories, mutate R2, or import products.

## Coordinated Final Import

Before import, the orchestrator MUST present:

- exact run ID;
- run status;
- target environment fingerprint;
- application revision/build identifier;
- manifest SHA-256;
- accepted/excluded product counts and reason summary;
- variant, image, and category-link counts;
- category synchronization result;
- R2 reset/upload/exact-set verification result;
- zero-product target result;
- final no-write preflight result;
- literal import command.

The user MUST explicitly confirm the exact run ID, manifest digest, and target environment after reviewing that evidence.

The approved final command contract is:

```bash
npm --prefix backend run catalog:import -- \
  scrape-output/{run-id}/products.json \
  --run-id={run-id} \
  --manifest-sha256={sha256} \
  --confirm-environment={environment}
```

Before persistence, `catalog:import` MUST rerun all mutable safety checks, including manifest digest, target identity, zero-product target, category existence, and R2 preflight. If any evidence changed after approval, it MUST abort before product writes and require a new user confirmation.

Only one importer process is launched. The orchestrator executes or observes that process and reports its result to the user.

## Import Result and Post-Import Verification

On success, the importer MUST report the same approved run ID and committed counts. The run becomes `IMPORTED` only when:

- product, variant, image, and category-link counts match the ready manifest;
- no partial or duplicate import occurred;
- representative public category/product reads succeed;
- storefront projections expose the imported catalog through the approved hierarchy.

A failed import MUST preserve PRD2 atomic rollback behavior and leave zero product, variant, image, and category-link rows from that attempt.

## Acceptance Criteria

1. Each execution has a unique run ID and isolated local directory.
2. Frozen run inputs and assets are immutable and cryptographically identified.
3. The real source extraction preserves supported variants, stock, categories, logistics, galleries, and image associations.
4. Permanent product failures are isolated and reported without hiding systemic failures.
5. The fixed 61-category taxonomy is versioned and synchronized idempotently.
6. Unknown or ambiguous source taxonomy drift blocks readiness.
7. Every accepted product has all selected gallery assets validated locally.
8. R2 reset is impossible outside `products/` and requires explicit run/environment confirmation.
9. Reset is performed only after the local snapshot, manifest, and asset inventory are frozen.
10. The post-upload `products/` object set exactly equals the ready run inventory.
11. Every manifest reference passes authenticated integrity verification and public HEAD preflight.
12. Products with failed mandatory assets are excluded with stable reason codes.
13. `products.json` passes the exact canonical validator and contains no run/source/debug metadata.
14. `catalog:preflight` performs no writes and blocks on any failed readiness condition.
15. The user approves the exact run ID, manifest digest, and environment before import.
16. `catalog:import` rejects mismatched run ID, digest, environment, changed preflight state, or populated target before writes.
17. Exactly one coordinated importer process is executed.
18. Successful committed counts match the approved ready manifest.
19. A forced late failure leaves zero product, variant, image, and category-link rows.
20. No credentials or sensitive identifiers appear in outputs.
21. All run-specific files remain excluded from Git.

## Success Metrics

- 100% of discovered products are classified as accepted, excluded, or extraction-failed with evidence.
- 100% of accepted products retain supported real variants and category memberships.
- 100% of manifest assets match the frozen local inventory and verified R2 object set.
- Zero deletion occurs outside `products/`.
- Zero stale or extra objects remain under `products/` when a run is ready.
- Zero writes occur against an unconfirmed or changed target.
- Zero partial catalog rows remain after failure.
- Final imported counts match the approved run exactly.

## Resolved Product Decisions

1. Categories synchronize automatically through the approved fixed taxonomy.
2. Every execution creates an immutable run snapshot.
3. The first-load R2 cleanup is mandatory but strictly limited to `products/`.
4. Frozen runs may resume storage work from local bytes; source re-extraction requires a new run.
5. Every selected gallery asset is mandatory for product inclusion.
6. Real supported variants and stock are required; the fixture-like single zero-stock variant is not acceptable.
7. Final import is one explicit user-approved process coordinated and observed by the orchestrator.
8. Run outputs are local generated artifacts, not delivery files.

## Readiness

All material product and operational decisions are resolved. This PRD is locked as the Product SSOT and is ready for `sdd-propose`.
