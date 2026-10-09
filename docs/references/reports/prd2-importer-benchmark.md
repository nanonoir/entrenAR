# Production-Scale Importer Benchmark Report

- **Change**: `prd2-entreno-catalog-scraper-import-pipeline`
- **Date**: 2026-09-27
- **Environment**: Isolated Disposable Docker PostgreSQL (`postgres:16-alpine`), Node.js v24.18.0, Prisma 7.6.0
- **Target Importer**: Current `backend/src/modules/catalog-import/*` implementation with baseline 12-second transaction timeout (`MUTATION_GATE_TRANSACTION_TIMEOUT_MS = 12_000`)
- **Isolation Boundary**: Database persistence isolated on dedicated port `5439`; storage existence preflight decoupled via `StubObjectExistence` port adapter. Configured application database and storage were untouched.

---

## 1. Executive Summary

A full-scale performance benchmark was conducted against the current catalog importer to evaluate whether the baseline single-transaction implementation can ingest the full production catalog without timing out or violating the 8.0-second safety margin.

The catalog dataset was generated deterministically from the real source anomaly census (`prd2-source-anomaly-census.json`) and category reconciliation report (`prd2-category-reconciliation.json`):
- **Products**: 657 accepted products
- **Variants**: 1,131 accepted variants (459 single-variant, 198 multi-variant with 1 or 2 option dimensions)
- **Images**: 3,869 gallery images (derived directly from real census image counts per product, ranging from 1 to 23 images/product, mean 5.89 images/product)
- **Categories**: 61 active categories with 804 total product-category links matching the empirical distribution (531 single-leaf, 109 two-leaf, 13 three-leaf, 4 four-leaf)

### Acceptance Scorecard

| Acceptance Criterion | Target Threshold | Measured Result | Evaluation |
|----------------------|------------------|-----------------|------------|
| **No Timeouts** | Zero runs exceeding 12.0s | Max duration was 6.23s (0 timeouts across 5 runs) | **PASS** |
| **Safety Margin** | Max total importer time < 8.0s | Max was 6.23s; Mean was 5.76s | **PASS** |
| **Rollback Integrity** | Exactly 0 catalog rows after forced scale failure | 0 products, 0 variants, 0 images, 0 links committed | **PASS** |

While the current importer passed all acceptance criteria in an isolated local SSD container environment, persistence accounts for **99.2%** of total execution time. The underlying implementation executes **6,971 individual sequential SQL statements** inside a single transaction. In environments with 1–2ms network round-trip latency to PostgreSQL, this sequential pattern would exceed 12 seconds and timeout.

---

## 2. Benchmark Architecture & Methodology

### 2.1 Isolation & Disposable Infrastructure

To guarantee zero mutation or side effects on the configured project database:
1. A disposable PostgreSQL 16 container (`disposable-pg-bench-17730`) was launched on an isolated host port (`5439`).
2. All 16 project migrations (`20260823170000_init` through `20260926010000_catalog_import_readiness_constraints`) were applied using `npx prisma migrate deploy`.
3. The 61 active categories from `prd2-category-reconciliation.json` were pre-seeded in hierarchical order (level 0 root categories first, then child categories).
4. Between every run, catalog tables (`ProductCategory`, `ProductVariant`, `ProductImage`, `Product`) were truncated via `TRUNCATE ... CASCADE`, resetting catalog row counts to 0 while preserving the 61 categories.
5. In a `finally` block, the container was stopped and removed, leaving zero persistent containers or databases.

### 2.2 Reused Importer Components

The benchmark reused the actual production codebase without modification:
- **Validator**: `normalizeCatalogImportManifest` from `backend/src/modules/catalog-import/manifest-validator.ts`
- **Service**: `CatalogImportService` from `backend/src/modules/catalog-import/catalog-import.service.ts`
- **Repository**: `PrismaCatalogImportRepository` from `backend/src/modules/catalog-import/catalog-import.repository.ts`
- **Concurrency & Transaction Gate**: `MutationGate` with unchanged `MUTATION_GATE_TRANSACTION_TIMEOUT_MS = 12_000`
- **Media Preflight**: `StubObjectExistence` implementing `ObjectExistencePort` with instantaneous `existsMany` resolution to isolate database persistence from R2 network latency.

---

## 3. Dataset Shape & Cardinality

The benchmark manifest strictly replicates the census findings:

| Entity | Count | Census Basis / Cardinality Notes |
|--------|-------|----------------------------------|
| **Accepted Products** | 657 | Matches `summaryCounts.totalClassifiedAccepted` in census. All 657 slugs and names preserved. |
| **Accepted Variants** | 1,131 | Matches `summaryCounts.acceptedVariantsCount`. 459 products with 1 variant; 198 products with 2–15 variants. |
| **Option Dimensions** | 1 or 2 | Matches census distribution: 84 single-variant simple products, 545 1-dimension variants, 28 2-dimension variants. |
| **Gallery Images** | 3,869 | Derived directly from `p.imageCount` per product in census. Distribution: 90 with 1, 19 with 2, 46 with 3, 91 with 4, 55 with 5, 55 with 6, 105 with 7, 84 with 8, 48 with 9, 21 with 10, up to 23 images. |
| **Active Categories** | 61 | Exactly matches `catReport.proposedCategorySnapshot` active set (7 roots, 54 child categories). |
| **Product-Category Links** | 804 | Matches `catReport.sourceTaxonomyFacts.leafCategoryProductDistribution` (531 with 1, 109 with 2, 13 with 3, 4 with 4). |

### Workload Database Operations per Run

Inside the single exclusive transaction, the current importer executed:
- `1` Advisory lock acquisition (`pg_advisory_xact_lock`)
- `2` Target cleanliness assertion queries (`findMany` on slugs and SKUs)
- `657` Category resolution queries (`transaction.category.findMany`)
- `657` Product insertions (`transaction.product.create`)
- `3,869` Product image insertions (`transaction.productImage.create` - single row per call)
- `657` Product category batch insertions (`transaction.productCategory.createMany`)
- `1,131` Product variant insertions (`transaction.productVariant.create` - single row per call)
- **Total SQL queries executed per run**: **6,975 operations** inside one transaction.

---

## 4. Benchmark Results (5 Clean Runs)

High-resolution timing was measured across five consecutive clean runs:

| Run | Validation (ms) | Preflight Total (ms) | Transaction Persistence (ms) | Total Importer Time (ms) | Total Time (s) | Under 8.0s Margin | Verified DB Rows (P/V/I/PC) | Heap Used (MB) |
|:---:|:---------------:|:--------------------:|:----------------------------:|:------------------------:|:--------------:|:-----------------:|:---------------------------:|:--------------:|
| **1** | 27.43 | 44.11 | 6,162.94 | 6,234.48 | 6.23s | YES | 657 / 1,131 / 3,869 / 804 | 100.82 |
| **2** | 19.70 | 29.40 | 5,642.84 | 5,691.94 | 5.69s | YES | 657 / 1,131 / 3,869 / 804 | 89.30 |
| **3** | 17.14 | 17.91 | 5,870.72 | 5,905.77 | 5.91s | YES | 657 / 1,131 / 3,869 / 804 | 78.47 |
| **4** | 16.30 | 23.02 | 5,439.22 | 5,478.55 | 5.48s | YES | 657 / 1,131 / 3,869 / 804 | 102.70 |
| **5** | 12.46 | 22.50 | 5,471.66 | 5,506.63 | 5.51s | YES | 657 / 1,131 / 3,869 / 804 | 113.47 |

### Statistical Summary

| Phase | Min (ms) | Max (ms) | Mean (ms) | Median (ms) | Std Dev (ms) | Share of Total |
|-------|:--------:|:--------:|:---------:|:-----------:|:------------:|:--------------:|
| **Validation (`normalizeManifest`)** | 12.46 | 27.43 | 18.61 | 17.14 | 4.98 | 0.32% |
| **Preflight (Validation + DB + Stub)** | 17.91 | 44.11 | 27.39 | 23.02 | 9.13 | 0.48% |
| **Transaction Persistence** | 5,439.22 | 6,162.94 | 5,717.48 | 5,642.84 | 270.31 | 99.20% |
| **Total End-to-End Importer** | **5,478.55** | **6,234.48** | **5,763.47** | **5,691.94** | **280.84** | **100.00%** |

---

## 5. Rollback Integrity Verification

A sixth test was executed to test transaction rollback behavior under failure at scale.

### Test Setup
- The full 657-product / 1,131-variant / 3,869-image manifest was prepared.
- A failure was injected late in the sequence at **product #650** by assigning an unresolvable category slug (`"non-existent-category-slug-force-rollback"`).
- At product #650, after 649 products, 3,812 images, and 1,118 variants had already been created in the transaction, the `productCategory.createMany` statement failed due to a missing foreign key identifier.

### Results
- **Transaction Rollback Duration**: `5,412.03 ms`
- **Error Caught**: `Invalid transaction.productCategory.createMany() invocation ... Argument categoryId is missing.`
- **Post-Rollback Database Audit**:
  - `Product`: **0**
  - `ProductVariant`: **0**
  - `ProductImage`: **0**
  - `ProductCategory`: **0**
  - `Category`: **61** (Pre-existing taxonomy completely intact)
- **Rollback Verdict**: **PASS** — Atomicity holds 100%. No partial or orphaned rows leaked into PostgreSQL.

---

## 6. Critical Findings & Latency Sensitivity Analysis

### 6.1 Why the Current Importer Passed
On the benchmark machine (local Docker on Windows WSL2 using NVMe storage and sub-millisecond loopback TCP networking), average round-trip time per query is ~0.82ms ($5,717\text{ ms} / 6,975\text{ queries} \approx 0.82\text{ ms}$). At this speed:
- Maximum execution time was **6.23s**, which comfortably clears the **8.0s** safety margin.
- Total transaction time was ~52% of the **12.0s** transaction timeout limit.

### 6.2 The Hidden Risk: Network Round-Trip Amplification
Because the current repository iterates sequentially over products and nested entities:
- Every image calls `await transaction.productImage.create(...)` sequentially (3,869 queries).
- Every variant calls `await transaction.productVariant.create(...)` sequentially (1,131 queries).
- Every product queries categories individually (`await transaction.category.findMany(...)`, 657 queries).

If the backend and PostgreSQL are separated across a network (such as Docker bridge networking under CPU throttling, Kubernetes pods, or a managed cloud database with a standard 1.5ms network round-trip time):

$$\Delta T = 6,975 \times 1.5\text{ ms} = 10,462\text{ ms} \text{ (network wait alone)}$$
$$\text{Total Transaction Time} \approx 10.46\text{s} + 2.5\text{s CPU/Disk} = 12.96\text{s} > 12.0\text{s (TIMEOUT)}$$

Any non-local database latency greater than **0.9ms per query** will cause the current importer to hit `MUTATION_GATE_TRANSACTION_TIMEOUT_MS = 12_000` and roll back the entire import.

---

## 7. Recommendations for PRD2

Based on the empirical evidence gathered from this benchmark:

1. **Pre-Resolve Categories in Bulk**:
   Instead of executing `category.findMany` 657 times (once per product), execute a single `category.findMany` before or at the start of the transaction and cache the `slug -> id` map in memory. This eliminates 656 redundant database queries.

2. **Bulk Insert Images via `createMany`**:
   The 3,869 sequential `productImage.create` calls represent 55.5% of all database round trips. By batching image insertions per product (or globally across products after product IDs are known), round trips drop from 3,869 to 657 (or fewer).
   *Note*: Because `ProductVariant.primaryImageId` references `ProductImage.id`, image insertions must return their generated IDs. Using PostgreSQL `INSERT INTO ... RETURNING id, storage_key` or batching by product with sequential position indexing allows multi-row inserts without losing ID references.

3. **Bulk Insert Variants via `createMany`**:
   The 1,131 sequential `productVariant.create` calls can be batched using `createMany` per product, eliminating another ~474 round trips.

4. **Estimated Performance Gains with Batching**:
   - Total queries reduced from **6,975** to approximately **1,320** (~81% reduction in database round-trips).
   - Estimated transaction persistence time reduced from **~5.7s to ~1.2s - 1.8s**.
   - Safety margin headroom increased from 28% to >75%.

5. **Timeout Recommendation**:
   For PRD2 catalog ingestion, keep the 12-second default for normal application operations, but support an explicit options override in `MutationGate.runExclusive(prisma, callback, { timeout: 30_000 })` for scheduled full-catalog scraping imports to safeguard against transient network jitter.

---

## 8. Cleanup & Disposal Receipt

- **Disposable Container**: `disposable-pg-bench-17730` (`postgres:16-alpine` on port 5439) was cleanly stopped and removed.
- **Disposable Database**: `entrenar_benchmark` destroyed along with container volume.
- **Pre-existing Containers**: Unaffected (`entrenar-backend-1` and `entrenar-postgres-1` remained healthy and untouched on port 5432).
- **Temporary Scripts & Artifacts**: All test scripts (`test_single_run.ts`, `test_forced_failure.ts`, `run_full_benchmark.ts`, `inspect_*.js`, etc.) and intermediate JSON files in `C:\Users\Nahuel\AppData\Local\Temp\opencode` were completely removed.
- **Repository State**: No code, migrations, package files, lockfiles, or environment files were modified. Only this markdown report was created.

## 9. Post-Optimization Corrective Rerun

The optimized importer was rerun on 2026-09-27 against a fresh disposable PostgreSQL 16 container on port 5439. The configured application database on port 5432 was not used.

| Run | Total importer time | Products | Variants | Images | Links | Observed SQL queries |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1,730.21 ms | 657 | 1,131 | 3,869 | 804 | 20 |
| 2 | 1,654.07 ms | 657 | 1,131 | 3,869 | 804 | 20 |
| 3 | 1,553.53 ms | 657 | 1,131 | 3,869 | 804 | 20 |
| 4 | 1,455.48 ms | 657 | 1,131 | 3,869 | 804 | 20 |
| 5 | 1,523.75 ms | 657 | 1,131 | 3,869 | 804 | 20 |

- **Maximum:** 1,730.21 ms (< 8 seconds)
- **Mean:** 1,583.41 ms
- **Batching evidence:** one category resolution, product insert, image insert, relation insert, and variant insert per transaction stage.
- **Forced late rollback:** passed; post-failure counts were Product 0, ProductVariant 0, ProductImage 0, ProductCategory 0.
- **Cleanup:** Product 0; Categories 61 preserved; disposable container and volume removed.
- **Machine-readable evidence:** `openspec/reports/prd2-importer-benchmark-rerun.json`
