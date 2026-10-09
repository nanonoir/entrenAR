# PRD — Local Real Catalog Cutover and Mock Data Replacement

**Status:** Refined — Ready for SDD  
**Refined:** 2026-09-29  
**Product context:** EntrenAR local catalog import after PRD3 real catalog preparation and R2 asset upload.

## Problem

The current local PostgreSQL database contains showcase and test/mock business data. The prepared Entreno real catalog cannot be imported because the target `Product` table is not empty. The user wants to preserve the entire current database in a private local backup, replace only confirmed mock business data with the prepared real catalog, test the result locally, and later promote the catalog to production. New CRM inventory movements and sales must be created in a later session using the imported real products.

## Current Evidence

- Local database identity: PostgreSQL at `127.0.0.1:5432`, database `entrenar`, schema `public`.
- Prepared real catalog run: `run-20260928232548266-6ca4606a`.
- Frozen product manifest SHA-256: `5093a00949525fec13f8814f680a51d50823e3748a3b1d3306c105f6aa218dd6`.
- R2 already contains and verified the run's 3,790 image assets. No reset or re-upload is required.
- The 61 approved categories were synchronized to the current local database: 52 created, 8 updated, 1 unchanged, 0 conflicts.
- Preflight currently blocks only because `Product` is non-empty.
- Read-only local counts at audit time: 2,097 products, 2,419 variants, 0 product images, 16 product-category links, 2,741 inventory-history rows, 27 cart items, 126 orders, 245 order-item snapshots, 67 carts, 0 coupon-product links, and 0 wishlist items.
- Sampled product rows include explicitly fixture-named records such as `Customer fixture product`; the database schema has no general `isMock` flag.
- The full pre-cleanup database backup is `backend/backup/entrenar-pre-real-catalog-20260929.dump` (custom PostgreSQL archive; 541,937 bytes; SHA-256 `ed824dacdc1115b6c93068aac817891ee363fcb560f6274e07274c58b2d19564`). `pg_restore --list` validation passed. Backup contents are Git-ignored.
- `catalog:showcase-reset` is not a cleanup command; it restores/upserts fixture catalog and commerce data.

## Objective

Prepare a recoverable, fixture-free local catalog database; import the exact approved real catalog run without touching already verified R2 assets; validate the local storefront/admin catalog; and leave future CRM movement/sales generation explicitly deferred.

## Goals

1. Preserve the complete pre-cleanup local database in `backend/backup/` and verify that the archive can be restored to a separate scratch database before cleanup.
2. Classify candidate mock records using known fixture manifests, stable test-fixture identifiers, and relationship evidence.
3. Abort before deletion if any product/business record cannot be confidently classified as mock or if the backup restore check fails.
4. Remove only confirmed mock catalog and mock operational data that would conflict with the real catalog or create misleading local CRM/order history.
5. Preserve the approved canonical category taxonomy, administrator access, and necessary local application configuration.
6. Preserve the current run, manifest digest, exact R2 object set, and all source/asset evidence. Do not reset or upload R2 again.
7. Run the corrected local preflight against the confirmed local database and require `PREFLIGHT_READY` before importing products.
8. Import the exact frozen manifest into the clean local target with run/digest/database-fingerprint approval and atomic rollback.
9. Verify committed product, variant, image, category-link, and R2 counts against the manifest.
10. Document a separately gated future production promotion path using the same environment-agnostic importer.
11. Defer generation of CRM inventory movements, sales, orders, and related operational records based on the real products to a future session/change.

## Business Rules and Invariants

1. The backup is a complete snapshot of the local database before any cleanup and is never committed to Git.
2. No destructive cleanup starts until both archive metadata validation and an isolated restore test pass.
3. Cleanup is limited to records positively identified as showcase/test/mock fixtures or their exclusively dependent mock rows. Never use `showcase:reset` to clear data.
4. Unclassified products, non-fixture user-created business rows, existing administrator identities, and unrelated configuration are preserved; ambiguous dependencies block cleanup.
5. The canonical 61-category taxonomy is retained; mock product-category links may be removed only for the selected mock products.
6. Mock inventory history, cart/checkout fixtures, mock orders/order items, and mock CRM/customer/sales records may be removed only when their fixture provenance is confirmed. Real or ambiguous order history is not deleted automatically.
7. The existing run's R2 destination and manifest are immutable. No `catalog:reset-assets` or `catalog:upload-assets` is permitted during this cutover.
8. The local target must be explicitly fingerprinted and confirmed before cleanup, category synchronization, or import.
9. Immediately before import, `Product` must be empty; the importer repeats this check inside the exclusive atomic transaction.
10. A failed import must leave no partial real catalog rows. If database commit succeeds but local receipt persistence fails, use read-only reconciliation; never blindly retry.
11. No real catalog import is attempted in production during this change.
12. No synthetic inventory movements or sales are generated in this change; that is deferred until after local catalog verification.

## Scope

### In scope

- Backup file validation and isolated restore rehearsal.
- Read-only inventory/audit report mapping local rows to approved fixture identities and dependency tables.
- Fail-closed mock cleanup for confirmed local fixture records only.
- Preserve 61 canonical categories and required admin/configuration state.
- Corrected target confirmation, handoff, preflight, and importer workflow already specified in `prd3-local-catalog-import-safety`.
- Import the existing prepared run `run-20260928232548266-6ca4606a` into local only after cleanup and `PREFLIGHT_READY`.
- Local post-import count, referential integrity, admin/public catalog, and image checks.
- Delivery notes for a later production promotion.

### Out of scope

- Re-scraping Entreno or editing the frozen product manifest.
- R2 reset, delete, or upload; current assets are already uploaded and verified.
- Importing products into production.
- Generating new inventory movements, sales, orders, or CRM activity data; this is a future session.
- Deleting administrator accounts or unrelated local application configuration.
- Broad deletion of database rows without verified mock provenance.

## Acceptance Criteria

1. The full database backup exists under `backend/backup/`, is excluded from Git, has a recorded byte size/SHA-256, and restores successfully into an isolated scratch database.
2. A read-only audit report identifies counts and fixture provenance for all candidate catalog/CRM/order/inventory rows without printing credentials or sensitive customer data.
3. Cleanup refuses to proceed if any target product or dependent operational row is not classified as mock or if unrelated records would be affected.
4. Cleanup leaves the 61 approved category records, administrator access, and required local config intact.
5. Cleanup removes the confirmed mock `Product` records and the necessary exclusively mock dependent rows; no mock order/cart/inventory snapshots remain if they are in the approved fixture cleanup scope.
6. After cleanup, the local `Product` table is empty and the correct target fingerprint still identifies `127.0.0.1:5432/entrenar`.
7. The existing run remains `run-20260928232548266-6ca4606a`; its manifest digest remains unchanged.
8. R2 still contains exactly the 3,790 expected assets; no reset or upload command ran.
9. Category synchronization is idempotent and the corrected preflight returns `PREFLIGHT_READY` with zero product rows, all required category slugs, matching manifest/digests, and exact R2 assets.
10. Import requires explicit confirmation of run ID, manifest SHA-256, and local database fingerprint.
11. Successful import counts match the exact manifest and all variants/images/category links persist atomically.
12. A forced late import failure leaves no partial real catalog rows.
13. Public/admin local catalog reads succeed for representative imported products and all referenced image URLs are available.
14. No test/mock inventory movement or sale generation is performed in this change.
15. Lint, typecheck, backend tests, isolated integration tests, and production builds pass.

## Success Metrics

- Zero unbacked destructive changes.
- Zero non-mock or ambiguous business records deleted.
- Zero R2 reset/upload operations during the local database replacement.
- Local product/variant/image/category-link counts exactly match the approved manifest.
- Zero duplicate, missing, or dangling catalog references after import.
- Preflight is green before any product import.
- Local public/admin catalog works with the existing R2 assets.

## Decisions Already Made

1. Use the existing local database target rather than switch to a different database destination.
2. Back up all current local database data before cleanup.
3. Replace mock catalog data with the prepared real catalog.
4. Later create new CRM inventory and sales records based on the real product/variant IDs; this is not part of the current change.
5. Never repeat the R2 reset/upload for the current run.

## Readiness

## Codebase Alignment and Invariants

The current repository and local-database inspection confirm:

1. The `Product` model has no generic `isMock` marker. The showcase fixture manifest names 16 showcase catalog products, while the local database contains 2,097 `Product` rows; a read-only audit must classify every row before cleanup, not assume all are covered by that 16-item manifest.
2. The inspected local database contains 2,419 variants, 0 product images, 16 product-category links, 2,741 inventory-history rows, 27 cart items, 126 orders, 245 order-item snapshots, 67 carts, 0 coupon-product links, and 0 wishlist items. Sampled product rows are explicitly named checkout/test fixtures; inventory origins include fixture and test labels. This sample is evidence, not proof that every row is disposable.
3. Product deletion is constrained by `ProductCategory`, `InventoryHistory`, and `CartItem` relations (`Restrict`); variants and images cascade from Product; order-item product IDs are snapshots without a Product foreign key. Cleanup must account for these dependencies and preserve historical snapshots unless they are positively classified as mock fixture data and included in the approved cleanup scope.
4. `showcase:reset` restores/upserts showcase fixtures and related fixture families; it is not a mock-data deletion command and MUST NOT be used for cleanup.
5. The current complete pre-cleanup database backup is `backend/backup/entrenar-pre-real-catalog-20260929.dump`, 541,937 bytes, SHA-256 `ed824dacdc1115b6c93068aac817891ee363fcb560f6274e07274c58b2d19564`. PostgreSQL `pg_restore --list` validation passed. A full isolated restore rehearsal is still required before cleanup.
6. Backup files are ignored by `backend/backup/.gitignore`; no database dump may be committed or printed.
7. The current approved categories were synced to the existing local `entrenar` database (52 created, 8 updated, 1 unchanged, 0 conflicts). Preserve the canonical taxonomy unless a fixture-provenance audit identifies a mock-only category not part of the approved set.
8. The current real run remains `run-20260928232548266-6ca4606a`, with manifest digest `5093a00949525fec13f8814f680a51d50823e3748a3b1d3306c105f6aa218dd6`; its 3,790 assets remain in R2 and have been read-only reconciled. Do not reset or upload them again.
9. The preflight against the existing local database returned only `TARGET_NOT_CLEAN`; no product import was performed. The run is target-bound to the local `entrenar` fingerprint, so this PRD must preserve that immutable run and avoid silently redirecting it to a different database.
10. The product and CRM fixture cleanup must run only against the explicitly confirmed local target. Production is not modified in this change.

The user's decisions are settled: preserve a full backup first; replace local mock catalog/operational fixture data with the real catalog; keep the existing approved R2 assets; validate locally; defer generation of new inventory movements and sales based on the new products to a separate future session. The PRD is locked as the Product SSOT for `sdd-propose` and `sdd-spec`.
