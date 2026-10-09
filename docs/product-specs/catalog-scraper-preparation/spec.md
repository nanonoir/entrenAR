# Catalog Scraper Preparation Specification

## Purpose

Prepare a deterministic, reviewable catalog-import handoff from Entreno public data without executing product import.

## Requirements

### Requirement: Deterministic HTTP Extraction

The system MUST allocate a run before extraction, discover deduplicated and stably ordered `/productos/*` URLs from the authoritative sitemap, process requests with at most three concurrent requests, and freeze normalized observations before any storage mutation. It MUST use HTTP, Cheerio, and structured `data-variants` and `nube-sdk-script` data before presentation text; it MUST NOT use browser automation. Source requests MUST use a 15-second timeout and PRD2 retry rules. Permanent product failures MUST be isolated, classified, and reported; systemic failures MUST block readiness. (Previously: extraction produced deterministic fixture-oriented outputs without a run-bound frozen source snapshot.)

#### Scenario: Stable successful extraction

- GIVEN the same sitemap and product fixtures
- WHEN preparation runs despite different completion order
- THEN frozen outputs have identical ordered contents
- AND duplicate URLs are counted and removed

#### Scenario: Permanent source failure

- GIVEN a product request returns HTTP 404
- WHEN preparation requests it
- THEN the request is not retried and the product is reported
- AND healthy products continue through extraction

### Requirement: Conservative Transformation and Exclusions

The system MUST emit only canonical manifest fields and preserve real supported variants, including sparse combinations, zero-stock tracked variants, stock mode, SKUs, prices, compare-at prices, option values, galleries, variant-image associations, logistics, and approved memberships. It MUST map unmanaged inventory to the existing infinite-stock contract and exclude every product in a duplicate-SKU conflict, unsupported price variance, incompatible compare-at price, more than two properties, malformed data, invalid assets, or missing positive weight or approved membership. (Previously: transformation did not require preservation of the real Tiendanube variant and membership matrix.)

#### Scenario: Incomplete dimensions with valid weight

- GIVEN a product has positive variant weight and a missing dimension
- WHEN it is transformed
- THEN it is included with normalized weight and available dimensions
- AND the report includes a missing-dimensions warning

#### Scenario: Sparse zero-stock variant

- GIVEN a product has a tracked zero-stock sparse combination
- WHEN it passes other validation
- THEN the canonical manifest retains its values and availability state

#### Scenario: Duplicate SKU conflict

- GIVEN a SKU belongs to variants of two source products
- WHEN global ownership is evaluated
- THEN both products are excluded and reported

### Requirement: Local Validated Asset Handoff

The system MUST download every selected gallery image locally before reset, preserving positive source order, and require HTTP 200, bounded WebP-compatible MIME, valid RIFF/WEBP bytes, a digest, and a canonical key. Any selected-image failure MUST exclude its product and all of its assets from the expected inventory. It MUST freeze the accepted manifest and inventory before destructive storage work. (Previously: assets were validated during an overwrite-oriented handoff.)

#### Scenario: Ready handoff

- GIVEN categories are synchronized, local assets are valid, and canonical validation passes on an empty target
- WHEN preparation completes
- THEN the report identifies the frozen run as eligible for no-write preflight
- AND preparation does not execute `catalog:import`

#### Scenario: Invalid image bytes

- GIVEN an image response is HTTP 200 but lacks WebP magic bytes
- WHEN the asset is validated
- THEN its product is excluded with `INVALID_IMAGE_ASSET`
- AND none of its keys enter the inventory

### Requirement: Selected-Run Operational Handoff

The system MUST provide reset, upload, and handoff operations that select one existing frozen run and consume only its `categories.json`, `products.json`, frozen inventory, and validated local asset bytes. The operational handoff MUST reject fixture-only or synthetic output, missing run artifacts, changed frozen inputs, and inventory/manifest disagreement. It MUST preserve the manual `catalog:import` boundary and MUST NOT perform live scraping, database import, or automatic import.

#### Scenario: Frozen-run handoff
- GIVEN a selected frozen run has complete immutable artifacts and validated local bytes
- WHEN its handoff operation executes
- THEN it prepares only that run's reset, upload, and preflight inputs

#### Scenario: Fixture rejection
- GIVEN a handoff source is fixture-only or lacks a selected frozen run
- WHEN the operational handoff is requested
- THEN it rejects without storage or database writes

#### Scenario: Frozen-input mismatch
- GIVEN a selected run's inventory disagrees with its manifest or local bytes
- WHEN handoff validates the run
- THEN it reports a sanitized blocker and does not advance readiness

### Requirement: Real Source-to-Manifest Preparation

`catalog:scrape` MUST extract product identity, metadata, actual option/variant matrix, managed stock, SKU, prices, compare-at prices, gallery order and variant-image associations, logistics, and source memberships from structured Tiendanube data. It MUST apply the existing PRD2 exclusions globally, including every owner of a duplicate SKU, and use `normalizeCatalogImportManifest` as the sole final manifest validator. It MUST NOT substitute fixture variants, invent prices, or weaken the canonical contract.

#### Scenario: Sparse matrix survives
- GIVEN structured source data has sparse option combinations and a tracked zero-stock variant
- WHEN the product is accepted
- THEN the validated manifest retains those variants, stock, option values, image associations, and memberships

#### Scenario: Conflicting SKU ownership
- GIVEN two products own the same SKU in different variants
- WHEN the complete source set is evaluated
- THEN both products are excluded with explicit reasons while unrelated products remain eligible

### Requirement: Accepted Local Image Set

`catalog:scrape` MUST download every selected image in source order into its run, require HTTP 200, bounded WebP-compatible MIME and valid RIFF/WEBP bytes, and retain canonical `products/{product-slug}/{position}.webp` keys. Any selected-image download, validation, or local-write failure MUST exclude the whole product as `INVALID_IMAGE_ASSET` and remove all its assets from the final inventory and final local asset set. It MUST NOT upload or mutate R2.

#### Scenario: Complete valid gallery
- GIVEN all selected gallery responses pass validation
- WHEN the product is accepted
- THEN each manifest image has validated local bytes at its canonical key and position

#### Scenario: Later image fails
- GIVEN an earlier image was saved but a selected later image has invalid bytes
- WHEN preparation finishes
- THEN the product is excluded and none of its images remain in the final inventory or final local asset set


