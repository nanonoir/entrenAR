# Catalog operations

Operational commands consume one frozen run and never scrape or import products automatically. Use local fixtures and fake adapters for tests.

1. Build the backend and obtain the non-secret fingerprint of the configured R2 destination with `npm --prefix backend run build` followed by `npm --prefix backend run catalog:r2-fingerprint`. This command reads configuration locally and does not contact R2.
2. `catalog:reset-assets` — select a run with `--run-id`, `--environment`, `--destination-fingerprint`, `--manifest-sha256`, `--expected-count`, `--run-root`, and literal `--prefix products/`. The expected count is the new run's frozen asset count; reset deletes and verifies only the `products/` prefix and does not compare that count against the previous contents.
3. `catalog:upload-assets` — pass the same run-bound confirmation values; upload only the selected run inventory and validated local WebP bytes, then verify the exact authenticated/public set. Both reset and upload reject a destination fingerprint that differs from the configured R2 account/bucket/endpoint/public base URL.
4. `catalog:handoff` — synchronize categories from the selected frozen run; it does not invoke `catalog:import`.
5. `catalog:preflight` — perform no-write target, manifest, category, and R2 checks.
6. Run `catalog:import` manually only after preflight reports readiness.

Never place credentials in command output. Reset and upload against real R2 require a separate explicit operational approval; automated tests use fake S3 and temporary files.

The reset intentionally does not require the existing prefix object count to equal the new run's asset count. It paginates and deletes only keys listed under `products/`, then verifies that prefix is empty. Do not use it if the selected R2 account/bucket is not the approved destination; confirm the printed fingerprint before reset.

## Run-bound local import recovery

The prepared run `run-20260928232548266-6ca4606a` already owns its frozen files and verified R2 inventory. Do not run `catalog:reset-assets` or `catalog:upload-assets` for this run. `catalog:reconcile-assets` is read-only and must verify paginated keys, authenticated SHA-256 metadata and size, and public availability before recording reconstructed stage evidence. It takes the same run-bound flags as the storage commands and does not call reset, delete, or upload.

Before a database-writing operation, run `catalog:target-info` and independently confirm the displayed fingerprint. Category synchronization requires `--confirm-db-fingerprint=<fingerprint>` and binds that run to one target; a different destination requires a separately prepared run. Category synchronization reads only the frozen `categories.json` whose raw bytes match its own `fileDigests` entry.

Preflight requires the same `--confirm-db-fingerprint` and checks actual Product count, canonical Category slugs, the frozen manifest, lifecycle stages, and the exact R2 inventory. It writes only local run evidence; it does not synchronize categories, change R2, or persist products. A failed check invalidates readiness.

Import requires all of `--run-id`, `--manifest-sha256`, `--run-root`, and `--confirm-db-fingerprint` (as `--name=value` flags) as well as the exact run-owned `products.json` path. Import is the only product-persistence command and retains its exclusive transaction and in-transaction empty-Product guard. If database commit succeeds but the local `IMPORTED` receipt cannot be saved, stop and run `catalog:reconcile-import` with the same approval arguments. That command reads exact product, variant, image, and category-link rows; it corrects local state only when every row matches and never persists catalog data. Never retry an indeterminate import blindly. For verification, use temporary run directories, mocked R2, and isolated database fixtures; do not assume `DATABASE_URL_E2E` exists or use a developer database.
