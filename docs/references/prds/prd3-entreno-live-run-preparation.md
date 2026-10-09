# PRD — Entreno Live Run Preparation

**Status:** Refined — Ready for SDD  
**Refined:** 2026-09-28  
**Related Product SSOT:** `openspec/changes/archive/2026-09-28-prd3-entreno-real-catalog-ingestion/prd.md`  
**Related operational contract:** `openspec/changes/archive/2026-09-28-prd3-real-r2-operational-handoff/prd.md`

## Problem

The current scraper command captures product-page observations and transforms a limited product representation, but does not create the complete immutable run required by the approved PRD3 storage workflow. In particular, it currently freezes an empty taxonomy, does not download local image bytes or generate an inventory, and stops before recording the validated asset and handoff evidence needed for R2 operations.

The storage and handoff CLIs now exist, but cannot safely operate until a real run provides frozen, mutually consistent source data, taxonomy, manifest, validated local assets, and inventory.

## Objective

Make `catalog:scrape` produce a complete, immutable, not-yet-uploaded live catalog preparation run that can be reviewed and then passed through the separately confirmed R2 reset/upload, category synchronization, preflight, and manual import workflow.

## Goals

1. Extract Entreno product data into the existing PRD2-compatible internal source model.
2. Preserve all supported real variants, stock, price rules, category memberships, image associations, and logistics.
3. Reconcile product memberships against the versioned 61-category approved taxonomy and block unknown/ambiguous taxonomy drift.
4. Exclude products with stable explicit reasons when required data or any selected mandatory image fails.
5. Download and validate required WebP gallery bytes locally before any R2 mutation.
6. Freeze a consistent run directory containing source snapshot, taxonomy/categories, canonical manifest, local assets, inventory, report, and digest-linked run state.
7. Leave the run `NOT_READY` for import until the existing separately confirmed storage, category-sync, and no-write-preflight stages succeed.
8. Keep live R2 reset/upload and `catalog:import` out of the scrape command.

## Binding Product Decisions

- The archived PRD3 remains authoritative for product, taxonomy, storage-key, asset-failure, R2-reset, import, and safety behavior.
- Use the fixed approved taxonomy; never regenerate it silently from live source categories.
- Every selected gallery asset is mandatory; any selected image download/validation failure excludes the whole product.
- Preserve supported real variants and stock; do not synthesize a single fixture variant.
- Canonical R2 keys remain `products/{product-slug}/{position}.webp`; run ID belongs only in local run metadata and paths.
- Run artifacts are local generated data under `scrape-output/{run-id}/` and remain excluded from Git.
- A failed or incomplete scrape must never report `READY` or initiate R2/database writes.

## Scope

### In scope

- structured Tiendanube product/variant/gallery/category extraction from public HTML and embedded product state;
- transformation using PRD2 rules and the canonical manifest validator;
- approved category artifact loading, source membership mapping, and drift reporting;
- local bounded WebP download, validation, deterministic storage keys, and inventory generation;
- immutable per-run persistence and digest/count evidence;
- report and lifecycle stage updates;
- focused fixtures/tests and documentation for creating a run.

### Out of scope

- R2 reset, upload, or object mutation during `catalog:scrape`;
- automatic category database synchronization from `catalog:scrape`;
- `catalog:import` execution;
- scheduled/recurring synchronization, incremental import, or source change detection;
- browser automation or access-control bypass;
- changes to PRD2 domain rules or importer contracts;
- admin UI or Git delivery operations.

## Run Contract

For each run, the command MUST allocate a unique run ID and write under `scrape-output/{run-id}/`:

```text
run.json
source.json
taxonomy.json
categories.json
products.json
inventory.json
report.md
assets/products/{slug}/{position}.webp
```

All frozen files MUST be mutually consistent. Their hashes and accepted/excluded counts MUST be recorded in `run.json`. The taxonomy used by the run MUST be the checked-in approved source-data artifact. `products.json` MUST pass `normalizeCatalogImportManifest` and contain only the canonical import contract.

The scrape result status is `PREPARED` or `NOT_READY`, never import-ready `READY`: readiness requires the separately confirmed R2, category synchronization, and preflight commands.

## Failure Behavior

- Global failures (sitemap unavailable, invalid approved taxonomy artifact, systemic parser failure, output persistence failure) fail the run.
- Product-level extraction/transformation failures are isolated and reported.
- Unknown or ambiguous source category mapping blocks the run pending approved reconciliation.
- A selected gallery image failing HTTP, size, MIME, WebP-byte, or local-write validation excludes the product with `INVALID_IMAGE_ASSET`; it must not leave its assets in the final inventory.
- After exclusions, rebuild the manifest and inventory from the final accepted products only.
- Partial output must remain non-ready and must not be consumable by reset/upload commands.

## Acceptance Criteria

1. A live scrape creates a unique run-specific directory and does not overwrite prior runs.
2. Source extraction captures structured real variants, stock, option values, gallery order/associations, logistics, and source category memberships.
3. Existing PRD2 acceptance/exclusion rules are applied without weakening the canonical importer contract.
4. Product category memberships resolve against the approved taxonomy; unknown or ambiguous mappings block readiness and are reported.
5. Every accepted product has at least one locally stored, valid WebP image and corresponding canonical storage key.
6. Any failed selected image excludes the full product and removes all its assets from the final inventory.
7. The generated inventory keys, sizes, and SHA-256 digests exactly match local accepted asset files and manifest references.
8. `source.json`, taxonomy, categories, products, inventory, and `run.json` are frozen and digest-linked for the same run ID.
9. The manifest passes the canonical validator and includes only accepted products.
10. The report accounts for every discovered product as accepted, excluded, or extraction-failed with explicit reason and counts.
11. Scrape never resets/uploads R2, synchronizes DB categories, or invokes `catalog:import`.
12. The run cannot become ready for import until later storage, category-sync, and no-write preflight evidence exists.
13. Unit/integration tests cover real structured fixtures, variants/memberships, exclusions, image failures, inventory consistency, and immutable run behavior using mocked network/filesystem boundaries.
14. Lint, typecheck, build, and relevant backend tests pass.

## Success Metrics

- 100% of discovered product URLs are accounted for in the run report.
- 100% of products in `products.json` have approved category memberships and complete required local asset inventory.
- Zero product manifest/image references point to absent or unvalidated local assets.
- Zero R2 or database writes occur during scrape/run generation.
- Re-running creates a new run ID and leaves prior frozen runs unchanged.

## Readiness

## Codebase Alignment and Invariants

The current repository confirms:

1. `RunStore.freeze()` persists source, taxonomy, and manifest files and computes their digests, but its current scrape caller passes an empty taxonomy and does not persist a run-scoped categories artifact or inventory.
2. `validateCategoryArtifact()` and `reconcileCategoryMembership()` exist; the tracked approved taxonomy is `backend/source-data/entreno-taxonomy.v1.json`. The live scrape flow must consume that fixed artifact and map source names/aliases through an explicit approved mapping.
3. `downloadLocalAsset()` validates WebP bytes and emits canonical key, digest, size, source URL, and position, but it currently has no caller in the scrape pipeline.
4. `transformProducts()` is the existing transformation boundary and must continue to produce the exact `normalizeCatalogImportManifest()` contract. This change must not introduce a competing final manifest validator.
5. `scrape.command.ts` uses `extractProducts()` then `transformProducts()` and currently calls `freeze(runId, source, JSON.stringify([]), manifest)`. It reports `NOT_READY` / `HANDOFF_REQUIRED`; this safe import boundary must remain.
6. `RunStore.evaluateReady()` requires the stages for R2 reset/upload, categories, manifest, and preflight. Therefore scrape-only output must remain non-ready; later operational commands own those stages.
7. R2 reset/upload are implemented as separate commands and MUST NOT be invoked by `catalog:scrape`.
8. `scrape-output/**` is generated local data and MUST remain Git-ignored; prior run directories MUST not be overwritten.
9. The source capture is a bounded observation window, not a globally atomic view of Entreno. The report must state its start/end and must not imply stronger consistency.

The existing `scraper.ts` extracts only shallow page fields and may use the entire `nube-sdk-script` text as a fallback variant. Refinement therefore treats structured variant/gallery/category extraction as a known implementation gap, not an existing capability. The exact extraction strategy and types are design concerns; product semantics remain those already approved in archived PRD2/PRD3.

No new material product decision remains. The PRD is locked as the Product SSOT for `sdd-propose` and `sdd-spec`.
