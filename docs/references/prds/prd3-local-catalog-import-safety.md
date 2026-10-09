# PRD — Run-Bound Catalog Import Safety

**Status:** Refined — Ready for SDD  
**Refined:** 2026-09-28  
**Related Product SSOT:** `openspec/changes/archive/2026-09-28-prd3-entreno-real-catalog-ingestion/prd.md`  
**Active prepared run:** `run-20260928232548266-6ca4606a`

## Problem

The live catalog is prepared and its 3,790 image objects were uploaded and verified in R2. The products have not been imported into the database. The current operational path is not safe to continue because it does not persist run status after R2 operations, category handoff does not bind its database write to a confirmed target, preflight uses placeholder target values, and the importer parses but ignores run/digest/environment approval.

## Objective

Enable a safe, explicit catalog import into a selected database environment (local or production) without hardcoding the importer to one environment, repeating any R2 reset/upload, or weakening the clean-target and atomic-import contracts.

## Goals

1. Let the operator identify the configured database destination without exposing credentials.
2. Bind category synchronization, preflight, and import to the exact run, manifest digest, and selected database target.
3. Persist and validate the run lifecycle through R2 verification, category synchronization, preflight, and import.
4. Make preflight accurately inspect the selected database's existing products and categories and the exact R2 asset set without changing business data.
5. Require explicit approval of the selected run, manifest digest, and database fingerprint before importing.
6. Preserve the existing requirement that the `Product` table is empty immediately before persistence.
7. Preserve one exclusive atomic import transaction with rollback on failure.
8. Keep the importer environment-agnostic: the same commands work for local or production targets when explicitly configured and confirmed.
9. Do not reset or re-upload R2 assets for the already verified run.

## Binding Decisions

- Current target for the next verification/import attempt is **local**.
- The same importer implementation must support local and production; target identity comes from the selected database connection and explicit operator confirmation, not a hardcoded environment branch.
- Product and category data changes are allowed only after target identity has been displayed in sanitized form and confirmed.
- Preflight must not modify database business data or R2. It may persist its result in the local run record.
- Category synchronization is an intentional database write and must be a separately visible stage bound to the selected target.
- No reset, asset deletion, or asset upload is part of this corrective change; the current R2 inventory has already been verified.
- Import approval must identify the exact run ID, `products.json` SHA-256, and database-target fingerprint.

## Scope

### In scope

- safe database-target identity/fingerprint reporting without credentials;
- target-bound `catalog:handoff` category synchronization;
- run-state persistence after existing R2 reset/upload evidence is reverified read-only;
- preflight dependency wiring to actual Prisma product count and category slugs plus R2 exact-set checks;
- persistence of preflight outcome and `READY` state only after all checks pass;
- importer enforcement of required approval, manifest/run binding, target fingerprint, ready state, and clean-target checks;
- successful/failed import run-state reporting;
- focused unit/integration tests using isolated databases, fixtures, and R2 mocks;
- operator documentation for local target confirmation and import.

### Out of scope

- repeating the R2 reset or asset upload;
- changes to product parsing, taxonomy, price/SKU/image acceptance rules, or manifest schema;
- changing the existing clean-target requirement;
- importing into a non-empty product catalog;
- automatic production import;
- cross-target import concurrency or using one run simultaneously against multiple databases;
- Git delivery operations.

## Business Rules and Invariants

1. Database connection strings and credentials MUST never appear in CLI output, reports, or logs.
2. The target identity fingerprint MUST be stable for a given database destination and change when the destination changes.
3. Category synchronization MUST fail before mutation if the selected target fingerprint does not match the operator confirmation.
4. Category synchronization MUST use only the selected run's frozen `categories.json`, remain idempotent, and not delete unrelated categories.
5. Preflight MUST query the actual selected database for product count and canonical category slugs.
6. Preflight MUST verify the frozen manifest digest, run ID, selected database fingerprint, required run stages, exact R2 key set, authenticated object integrity, and public object availability.
7. If any preflight check fails, the run MUST remain not ready and product persistence MUST NOT begin.
8. The importer MUST require all run-bound approval values; omission or mismatch MUST abort before writes.
9. The importer MUST verify that the manifest path is the `products.json` belonging to the approved run.
10. Immediately before persistence, the repository MUST verify the `Product` table is empty inside the exclusive transaction.
11. A successful import MUST record committed counts and the selected target fingerprint; failure MUST leave no partial catalog rows.
12. The current R2 inventory is reused exactly as uploaded; this change MUST NOT delete, reset, or upload objects.

## Acceptance Criteria

1. A read-only target-info command shows sanitized database identity and fingerprint with no URL credentials.
2. The local target can be explicitly confirmed and does not depend on a production-only value.
3. Run state records R2 reset/upload verification for the existing run without repeating mutations.
4. `catalog:handoff` confirms target identity before synchronizing the run's frozen categories and records `CATEGORIES_SYNCED` only on success.
5. Preflight reads actual category slugs and product count from the selected Prisma database.
6. Preflight no longer uses placeholder empty categories or a hardcoded zero product count.
7. Preflight blocks if the selected target has products, lacks a required category, has a changed manifest/run, or has a missing/extra/invalid R2 object.
8. Preflight passes for the current run only when every required condition is true and then records `READY` in the local run record.
9. Import command rejects missing approval arguments, wrong run ID, wrong manifest digest, wrong database fingerprint, non-ready run, or manifest path outside the run directory before import.
10. The same importer works against a confirmed local database or a confirmed production database without a hardcoded environment restriction.
11. The import remains atomic and refuses a non-empty product table both in preflight and inside the persistence transaction.
12. Successful import records run ID, selected database fingerprint, products, variants, and images; failure leaves no partial product/variant/image/category rows.
13. No R2 reset, delete, or upload occurs during target check, handoff, preflight, or import.
14. Focused tests plus lint, typecheck, backend suites, and production builds pass.

## Success Metrics

- Zero unconfirmed database-target writes.
- Zero imports with missing/mismatched run or manifest confirmation.
- Zero R2 mutations during this local-import safety change.
- Preflight's observed product/category/R2 facts match the actual selected target.
- Final committed product, variant, image, and category-link counts match the frozen manifest.
- Failure at any stage before/inside persistence leaves the target without partial catalog data.

## Readiness

This corrective PRD inherits product behavior from archived PRD3. The user selected the local database for the next attempt and confirmed automatic category synchronization. It introduces no change to catalog content or acceptance policy.

## Codebase Alignment and Invariants

The current implementation confirms:

1. The R2 upload command verifies the exact object set and each authenticated/public object HEAD before returning success, but it does not persist `R2_RESET` or `ASSETS_UPLOADED` transitions to `run.json`.
2. `runBoundCategorySync()` reads the selected run's `categories.json`, but compares its compact JSON digest to `run.taxonomySha256`, which was calculated from `taxonomy.json`; these are distinct artifacts and the comparison must use the recorded `categories.json` digest.
3. `runOperationalHandoff()` synchronizes categories but does not verify a database target fingerprint or persist `CATEGORIES_SYNCED` state/stage.
4. `preflight.main.ts` currently supplies an empty category set and a hardcoded zero product count instead of querying the selected Prisma database.
5. `runPreflightCommand()` blocks unless the persisted run is already `CATEGORIES_SYNCED` or `READY`, and checks R2 exact keys/public availability and manifest digest. It currently returns results without persisting a successful `READY` state.
6. `catalog-import.command.ts` parses optional approval fields but does not pass them to `assertManifestApproval()` or otherwise bind the manifest to a run. The flags may be omitted entirely.
7. `CatalogImportService` validates manifest shape, category existence, object existence and product identity, while `PrismaCatalogImportRepository` checks `Product` is empty inside its exclusive atomic transaction. These existing protections MUST remain.
8. The correct approved import input is the immutable `products.json` in the current run; its reported SHA-256 is `5093a00949525fec13f8814f680a51d50823e3748a3b1d3306c105f6aa218dd6`.
9. The current run is local-only for the next attempt. The target-agnostic importer must accept a user-confirmed local or production database fingerprint without hardcoding either destination.
10. R2 reset/upload has already completed for the current run and MUST NOT be repeated by this change.

No database connection string or credential was read for refinement. The PRD is locked as the Product SSOT for `sdd-propose` and `sdd-spec`.
