# PRD — Entreno Catalog Scraper and Import Preparation Pipeline

**Status:** Refined — Ready for SDD  
**Refined:** 2026-09-27  
**Product SSOT:** This document is authoritative for downstream proposal, specification, frontend-specification, design, tasks, implementation, and verification phases.

## Objective

Design and implement a one-shot catalog scraping and transformation pipeline that extracts the current public product catalog from Entreno (`https://entreno.com.ar/`), transforms it into EntrenAR's implemented `CatalogImportManifest` contract, uploads product images to Cloudflare R2 using the canonical storage-key convention, and produces a validated `products.json` file ready for the existing EntrenAR catalog importer.

This PRD must preserve the EntrenAR catalog domain. It includes only the approved compatibility extensions required to ingest the real catalog: product logistics fields in the import boundary, deterministic hierarchical category consumption, strict clean-target enforcement, and bulk-import hardening.

PRD1 defined and implemented the baseline target contract. PRD2 is responsible for preparing source data and closing the measured blockers that prevent that contract from accepting and serving the real catalog safely:

```text
Entreno
→ Extract
→ Transform
→ Prepare categories
→ Prepare assets
→ Validate
→ Produce import manifest
```

The final catalog import command is intentionally executed manually after the scraper finishes successfully.

---

## Context

PRD1 is already implemented.

EntrenAR now has:

- universal variants;
- SKU and stock owned by `ProductVariant`;
- product-level pricing;
- real/sparse variant combinations;
- `ProductImage` gallery support;
- Cloudflare R2-compatible `storageKey` persistence;
- variant-specific primary-image references;
- multiple categories;
- sanitized HTML descriptions;
- an atomic one-shot catalog importer;
- strict Zod validation;
- R2 preflight checks;
- implemented backend/frontend/admin catalog surfaces, with the category and logistics compatibility gaps documented in this refined PRD.

The importer expects one UTF-8 JSON file shaped as:

```ts
type CatalogImportManifest = {
  products: ImportProduct[]
}
```

The scraper must conform to the canonical validator after the approved PRD2 compatibility fields have been added. It must not emit undocumented source-specific fields.

---

## Research Findings

Technical research against Entreno/Tiendanube established that browser automation is not required for catalog extraction.

All relevant product and variant data is server-rendered into static HTML.

### `data-variants`

Product markup contains a `data-variants` HTML attribute with a JSON array representing the real variants of the product.

It contains data such as:

- Tiendanube variant ID;
- SKU;
- `option0`;
- `option1`;
- stock;
- availability;
- price;
- compare-at price;
- associated image ID;
- associated image URL.

The array contains real defined variants, including out-of-stock variants.

Invalid/nonexistent Cartesian combinations are omitted.

### `nube-sdk-script`

Product pages contain:

```html
<script id="nube-sdk-script">
```

with serialized product state.

This provides complementary product metadata such as:

- brand;
- product metadata;
- option/property names;
- complete gallery;
- image order;
- image alt text;
- dimensions and weight;
- variant information;
- description-related product state.

### Catalog discovery

Entreno exposes:

```text
https://www.entreno.com.ar/sitemap.xml
```

which contains the canonical URLs for the public product catalog.

The scraper must use the sitemap as the primary product-discovery source.

A paginated Tiendanube endpoint also exists:

```text
/productos/page/{n}/?results_only=true&limit=100&theme=toluca
```

but it is not required for primary product discovery.

Category pages may use the same pagination mechanism when category membership needs to be inspected.

### Verified catalog baseline

The 2026-09-27 complete census established the planning baseline:

- 676 discovered products;
- 1,199 source variants;
- 657 products and 1,131 variants accepted by the current product-domain decisions;
- 19 excluded products: 4 for duplicate SKU ownership, 12 for unsupported variant price variance, and 3 for incompatible compare-at pricing;
- 3,869 images across the accepted set;
- zero extraction failures and zero products without images or variants;
- 672 products with complete positive weight and dimensions, 4 with missing/zero dimensions, and 2 with small weight differences across variants.

These counts are evidence, not hardcoded output requirements. A later source change must be reflected in the generated report rather than forced to match this snapshot.

---

## Core Decisions

The following decisions are approved requirements:

1. Use `sitemap.xml` as the primary source of product URLs.
2. Use pure HTTP extraction with Node.js `fetch`, Cheerio, and JSON parsing.
3. Do not use Playwright in the production scraper.
4. If a product has different prices across variants, exclude it and report it.
5. If a product uses more than two variant properties, exclude it and report it.
6. Products involved in duplicate-SKU conflicts must be excluded rather than repaired or deduplicated.
7. Reuse EntrenAR's existing categories.
8. Add categories that currently exist in Entreno but are missing in EntrenAR as part of this PRD before final manifest generation.
9. Download Entreno's existing WebP product images directly; do not recompress or convert them by default.
10. Map Tiendanube stock management into EntrenAR's `TRACKED` / `INFINITE` contract.
11. Produce final `categories.json`, `products.json`, and a separate report covering exclusions, warnings, category changes, counts, and anomalies.
12. Do not automatically execute the EntrenAR catalog importer at the end. The user/orchestrator will run it explicitly after reviewing the scraper result.
13. Object storage is mandatory. There is no no-upload or partially-ready dry-run mode for the final pipeline.
14. Extract source weight and dimensions and persist normalized product logistics through the canonical import contract.
15. Reconcile categories into a deterministic `categories.json`, then persist them through a separate idempotent `catalog:sync-categories` step before manifest handoff.
16. Preserve the full approved functional taxonomy and make backend/frontend consumers derive category behavior from the hierarchy rather than random IDs or stale fixture arrays.
17. The import target must contain zero products. Existing categories are allowed; any existing product makes `catalog:import` fail before persistence.
18. Optimize full-catalog persistence to avoid thousands of avoidable sequential database round trips while preserving one atomic transaction.
19. R2 uploads overwrite the deterministic target key so reruns cannot preserve stale image bytes.

---

## Codebase Alignment & Invariants

The following repository facts and approved corrections are binding:

1. **Canonical backend boundary:** scraper, category synchronization, storage upload, and importer integration belong under `backend/`; the Next.js frontend must not become a second catalog backend.
2. **Canonical validation:** `normalizeCatalogImportManifest` remains the only final manifest schema. PRD2 extends that schema and its tests for logistics; it does not create a parallel validator.
3. **Clean target:** the PRD1 durable specification requires a clean target, but the current implementation checks only identity collisions. PRD2 must enforce `Product` count zero before writes and provide a categories-only preparation path.
4. **Category persistence:** the current importer writes `ProductCategory` relations but not the legacy `Product.subcategorySlugs` array, while storefront listings still depend on that array. PRD2 must make public/admin category projection deterministic from the relational hierarchy and remove this behavioral dependency from listing decisions. Duplicating the same taxonomy into a JSON field is not the source of truth.
5. **Primary category:** category selection must never depend on lexicographic CUID ordering. It must be derived deterministically from approved hierarchy and route priority.
6. **Parent-level membership:** products may belong directly to root or intermediate categories. The verified source contains 13 products without a leaf assignment; the pipeline must not fabricate one.
7. **Multi-category membership:** the verified source contains 132 multi-leaf products. All approved memberships must be preserved.
8. **Route compatibility:** `performance` and `control-de-peso` must become first-class supported storefront categories; existing hardcoded mappings must align with the approved taxonomy.
9. **Logistics:** source logistics are variant-level, while EntrenAR currently calculates shipping from product-level weight. PRD2 must deterministically aggregate source values and persist product-level logistics.
10. **Shipping safety:** every included product must have positive `weightGrams`; missing dimensions may mark logistics incomplete but must not erase a valid weight.
11. **Storage:** authenticated R2 S3 `PutObject`, `HeadObject`, `GetObject`, `DeleteObject`, and post-delete cleanup are verified. Public `ASSETS_BASE_URL` HEAD remains an operational acceptance check pending custom-domain DNS propagation.
12. **Importer scale:** the measured accepted set persisted locally in 5.48–6.23 seconds with atomic rollback, but required 6,975 SQL operations. Local success does not justify retaining latency-sensitive sequential persistence.
13. **Security:** credentials remain environment-only, must never appear in reports/logs, and storage diagnostics must use isolated keys with guaranteed cleanup.
14. **No automatic final import:** the preparation pipeline and category synchronization may run, but product `catalog:import` remains a separate explicit operation.

### Approved taxonomy baseline

The reconciliation report defines 61 active categories from 65 evaluated source nodes:

- 6 existing categories kept;
- 14 source slugs mapped to canonical EntrenAR slugs;
- 41 categories created;
- 4 promotional/brand collection nodes rejected (`liquidacion`, `hot-entreno`, `objetivos`, `marcas`).

The machine-readable authority for the proposed taxonomy is `openspec/reports/prd2-category-reconciliation.json`.

### Evidence references

- `openspec/reports/prd2-source-anomaly-census.json`
- `openspec/reports/prd2-source-anomaly-census.md`
- `openspec/reports/prd2-category-reconciliation.json`
- `openspec/reports/prd2-category-reconciliation.md`
- `openspec/reports/prd2-r2-smoke-report.md`
- `openspec/reports/prd2-importer-benchmark.md`

---

## 1. Dependency and Runtime Setup

Before installing anything, inspect the repository's existing dependencies and runtime.

Reuse compatible existing packages.

Install only missing packages required by the scraper.

Expected tooling:

```text
Node.js / TypeScript
fetch              — built into modern Node.js
Cheerio            — HTML parsing
Zod                — validation where useful/reusable
@aws-sdk/client-s3 — authenticated Cloudflare R2 uploads
```

`@aws-sdk/client-s3` is already installed in the backend package. Prefer a small native bounded worker pool over adding `p-limit` unless implementation evidence proves another dependency necessary.

Do not install these unless implementation evidence shows they are required:

```text
Playwright
Puppeteer
Selenium
Crawlee
Sharp
```

If a required dependency is missing, the implementation agent may install it and must update the correct package manifest and lockfile.

The scraper and its commands must live under `backend/` so they can reuse the canonical validator, environment contract, logging conventions, and catalog boundaries.

---

## 2. Product Discovery

Fetch:

```text
https://www.entreno.com.ar/sitemap.xml
```

Extract every canonical product URL matching:

```text
/productos/*
```

The product URL list must be deduplicated.

The discovery stage must produce deterministic ordering so repeated scraper runs generate stable output.

The scraper should report:

```text
discoveredProducts
duplicateUrlsRemoved
```

Do not use browser automation.

---

## 3. Product Page Extraction

For each discovered product URL:

1. request the product page through HTTP;
2. parse the returned HTML with Cheerio;
3. extract product metadata;
4. parse the `data-variants` JSON;
5. parse relevant state from `nube-sdk-script`;
6. extract gallery/media data;
7. normalize the result into an internal source representation;
8. transform it into EntrenAR-compatible data.

Prefer structured embedded data over brittle presentation text whenever both are available.

---

## 4. Internal Extraction Model

The scraper may define an internal Tiendanube-specific extraction type.

Example conceptual shape:

```ts
type ExtractedEntrenoProduct = {
  sourceProductId: number
  url: string
  slug: string

  name: string
  brand?: string
  descriptionHtml?: string

  optionNames: string[]

  variants: Array<{
    sourceVariantId: number
    sku: string
    option0?: string | null
    option1?: string | null

    stockManagement: boolean
    stock?: number

    price: number
    compareAtPrice?: number

    imageId?: number
    imageUrl?: string

    weightKg?: number
    widthCm?: number
    heightCm?: number
    depthCm?: number
  }>

  images: Array<{
    sourceImageId: number
    url: string
    position: number
    alt?: string
  }>
}
```

This internal type may contain source-specific details.

It must not leak source-specific identifiers or URLs into the final EntrenAR import manifest unless explicitly required by the implemented target contract.

---

## 5. Target Import Contract

The final `products.json` must match the existing strict EntrenAR `CatalogImportManifest` Zod contract.

The scraper must not invent additional fields.

The final product shape must follow the implemented contract:

```ts
type ImportProduct = {
  slug: string
  publicSlug?: string

  name: string
  brand?: string

  descriptionHtml?: string
  shortDescription?: string

  price: number
  compareAtPrice?: number

  variantProperties: Array<{
    id: string
    name: string
    values: Array<{
      id: string
      label: string
    }>
  }>

  categorySlugs: string[]

  images: Array<{
    storageKey: string
    position: number
    alt?: string
  }>

  variants: Array<{
    sku: string
    name?: string
    attributes: Record<string, string>

    stockMode: "TRACKED" | "INFINITE"
    quantity?: number

    primaryImageStorageKey?: string
  }>

  tags?: string[]
  shippingRequired?: boolean

  weightGrams: number
  widthCm?: number
  heightCm?: number
  lengthCm?: number
}
```

Unknown fields must not be emitted.

The canonical Zod contract, importer repository, generated API types where applicable, and importer tests must be extended consistently for these logistics fields. `weightGrams` is required for this pipeline because every verified source product has positive weight. Dimensions remain optional because four verified products contain zero/missing source dimensions.

---

## 6. Slug Normalization

Product slugs and property/value IDs must satisfy EntrenAR's slug format:

```regex
^[a-z0-9]+(?:-[a-z0-9]+)*$
```

Product slug should be derived deterministically from the canonical Entreno product URL whenever possible.

Option/property IDs and value IDs must be normalized deterministically.

Examples:

```text
"Sabor" → "sabor"
"Color" → "color"
"Talle" → "talle"
"Cookies & Cream" → "cookies-cream"
```

Escaped values such as `16"` must also normalize deterministically into a valid slug value.

Display labels must preserve the original human-readable value.

The implementation must define and test one deterministic slug-normalization helper.

If two distinct source names normalize to the same property ID or value ID, exclude the affected product with `NORMALIZATION_COLLISION`. Do not silently suffix or merge identifiers.

---

## 7. Universal Variant Transformation

Every final product must contain at least one variant.

### Simple product

A source product with no selectable option still has a Tiendanube variant.

Transform it into:

```json
{
  "variantProperties": [],
  "variants": [
    {
      "sku": "SOURCE-SKU",
      "attributes": {},
      "stockMode": "TRACKED",
      "quantity": 10
    }
  ]
}
```

Do not introduce a visible `"Default"` property or value.

### Product with one option

For a product such as:

```text
Sabor
├── Chocolate
├── Vainilla
└── Frutilla
```

generate one `variantProperties` entry and one real `ProductVariant` entry per source variant.

### Product with two options

For products such as `Color + Talle`, transform only the real source combinations.

Do not generate missing Cartesian combinations.

Out-of-stock variants must still be retained.

---

## 8. Unsupported Variant Shapes

EntrenAR supports a maximum of two variant properties.

Before final manifest generation, detect the number of source option dimensions used by every product.

If a source product requires more than two properties:

```text
exclude product
→ add exclusion report entry
→ do not fail the complete scraping run
```

Do not silently discard the third property.

---

## 9. Price Transformation

EntrenAR accepts one shared product-level price:

```text
price
compareAtPrice?
```

It does not accept variant-level pricing.

For each source product:

1. collect the current price from every variant;
2. collect compare-at prices where present;
3. verify that all variants are compatible with one shared product-level pricing representation.

### Compatible case

If all variants have the same current price:

```text
Product.price = shared current price
```

If all applicable compare-at prices are consistent:

```text
Product.compareAtPrice = shared compare-at price
```

Emit `compareAtPrice` only when the shared value is strictly greater than `price`. If every source compare-at value is absent or non-promotional (`<= price`), omit it and report a warning. If populated compare-at values differ in a way that cannot be represented by one valid product value, exclude the product with `COMPARE_AT_INCOMPATIBLE`.

### Incompatible case

If source variants contain materially different current prices:

```text
exclude product
→ report PRICE_VARIANCE_UNSUPPORTED
```

Do not:

- average prices;
- choose minimum price;
- choose maximum price;
- silently use the first variant;
- generate variant-level price fields.

The same principle applies when compare-at pricing cannot be represented consistently.

The report must include the source product, affected SKUs, and observed price values.

---

## 10. Stock Transformation

Use Tiendanube's stock-management state.

### Managed stock

When the source variant tracks stock:

```text
stockMode = "TRACKED"
quantity = exact integer stock
```

Zero stock is valid and the variant must still be imported.

### Unmanaged stock

When source stock management is disabled:

```text
stockMode = "INFINITE"
```

and `quantity` must be omitted.

Do not emit EntrenAR's legacy/internal `OUT_OF_STOCK` enum value.

---

## 10A. Logistics Transformation

Extract logistics from each variant in `nube-sdk-script`:

```text
weight — kilograms
width  — centimeters
height — centimeters
depth  — centimeters, mapped to lengthCm
```

Normalize to positive product-level integers:

```text
weightGrams = ceil(max(valid variant weightKg) * 1000)
widthCm     = ceil(max(valid positive variant widthCm))
heightCm    = ceil(max(valid positive variant heightCm))
lengthCm    = ceil(max(valid positive variant depthCm))
```

Rules:

1. zero, negative, empty, and non-finite source values are missing, never valid measurements;
2. use the maximum valid variant value for each field so product-level shipping never underestimates a real variant;
3. differing positive variant values are retained through this conservative maximum and reported as `LOGISTICS_VARIANCE`;
4. `weightGrams` is required for every included product; exclude with `MISSING_REQUIRED_LOGISTICS` if no positive source weight exists;
5. dimensions are optional; preserve valid components and report `MISSING_LOGISTICS_DIMENSIONS` when one or more are unavailable;
6. the importer must persist the normalized values and derive `missingLogistics` from incomplete dimensions rather than trusting source input for that flag.

---

## 11. SKU Handling

Every final variant requires a non-empty SKU.

The scraper must:

1. collect all candidate products;
2. build a global SKU ownership map;
3. detect every SKU collision before manifest generation.

When a SKU is used by more than one source variant/product:

```text
exclude every affected product involved in that collision
```

Do not:

- append suffixes;
- mutate the source SKU;
- generate replacement SKUs;
- choose one conflicting product automatically.

Every exclusion must be reported with:

```text
code: DUPLICATE_SKU
sku
affected products
affected source variant IDs
```

The resulting `products.json` must contain globally unique SKUs.

---

## 12. Category Discovery and Reconciliation

The complete reconciliation has already established the target taxonomy: 61 active categories with 100% product coverage. Implementation must consume that evidence rather than rediscovering product decisions.

Requirements:

1. regenerate/verify current functional memberships from category endpoints;
2. apply the approved keep/map/create/reject actions from the reconciliation artifact;
3. generate deterministic `scrape-output/categories.json` containing canonical slug, name, parent slug, visibility, and stable order;
4. validate global slug uniqueness, valid parent references, and an acyclic hierarchy;
5. persist categories through an idempotent `catalog:sync-categories` command before final manifest readiness;
6. preserve the intended hierarchy using `Category.parentId`;
7. permit root/intermediate memberships for the verified parent-only products;
8. preserve all approved multi-category memberships;
9. produce a category-change report.

Do not import promotional collections or brands as categories. Do not recreate the entire source taxonomy blindly.

The implementation agent must inspect current EntrenAR category records/seed definitions before making changes.

---

## 13. Category Membership Mapping

Product pages use brand-oriented breadcrumbs and therefore cannot be treated as the authoritative functional category path.

Use Entreno's category pages / category pagination endpoints to build a mapping:

```text
source product ID
→ functional category/categories
```

Transform that mapping into existing/new EntrenAR category slugs.

The final manifest must contain:

```ts
categorySlugs: string[]
```

with at least one valid category for every included product.

All referenced categories must exist in EntrenAR before the final import is executed.

The scraper must not create categories during the `catalog:import` command.

Category additions belong to repository/database preparation performed by this PRD before final manifest handoff.

`catalog:sync-categories` must be safe to rerun: it may create missing approved nodes and update approved names, parent relationships, visibility, or ordering, but must not create duplicates or delete unrelated categories implicitly. Any destructive conflict must fail with a report.

---

## 14. Brand

Extract the source brand from structured product state.

Persist it through:

```ts
brand?: string
```

Do not introduce a separate Brand model as part of this PRD.

Brand names should preserve intended human-readable casing.

Brand-specific category creation should only occur when required by the existing EntrenAR taxonomy.

---

## 15. Description

Extract the product description as HTML.

The scraper does not need to duplicate the backend sanitizer.

The existing importer sanitizes `descriptionHtml`.

The scraper should preserve useful semantic content and avoid unnecessary presentation wrappers when extraction can target the source product-description container directly.

The scraper must not depend on unsupported styling/classes being preserved.

---

## 16. Images

Use the complete Tiendanube product gallery.

Current catalog images are already exposed as WebP assets suitable for direct ingestion.

Preferred source:

```text
-1024-1024.webp
```

Do not use Sharp or perform format conversion/resizing by default.

For each product:

1. extract gallery images in source order;
2. normalize deterministic 1-based positions;
3. download each source WebP and require HTTP 200, bounded size, WebP-compatible MIME, and valid RIFF/WEBP magic bytes;
4. assign the required EntrenAR storage key;
5. upload the file to R2;
6. emit the same storage key in `products.json`.

---

## 17. Canonical R2 Storage Keys

Every product image key must be exactly:

```text
products/{product-slug}/{position}.webp
```

Examples:

```text
products/ena-creatina-300g/1.webp
products/ena-creatina-300g/2.webp
products/remera-shark-boxy/1.webp
```

Rules:

- relative path only;
- no leading slash;
- lowercase;
- `/` separators;
- `.webp` extension;
- product slug must exactly match `ImportProduct.slug`;
- position is positive and 1-based;
- positions are unique per product;
- no bucket name;
- no hostname;
- no query string;
- no provider-specific prefix.

The scraper defines the key before upload.

R2 does not generate the storage key.

---

## 18. Variant-Specific Primary Images

Tiendanube variants may reference a source image ID.

When a source variant has a known associated image:

1. map the source image ID to the corresponding normalized product gallery image;
2. determine its final `storageKey`;
3. emit `primaryImageStorageKey`.

The key must reference one of that same product's `images[]` entries.

If no source-specific image association exists, omit the field.

---

## 19. R2 Upload

The scraper must upload all required product image assets before the final import command is run.

Before choosing an R2 upload implementation:

1. inspect existing repository infrastructure;
2. reuse existing S3/R2 tooling if present;
3. otherwise choose the smallest maintainable solution.

A direct programmatic S3-compatible client such as:

```text
@aws-sdk/client-s3
```

is the approved implementation. `@aws-sdk/client-s3` is installed in the backend package and has been verified against the configured R2 bucket.

Do not introduce browser automation or image-processing infrastructure for R2 upload.

The exact upload mechanism is an implementation detail as long as:

```text
storageKey in R2
==
storageKey in products.json
```

Required environment contract:

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_ENDPOINT
ASSETS_BASE_URL
```

Configuration must be validated before catalog network work begins. Values must be non-empty; `R2_ENDPOINT` and `ASSETS_BASE_URL` must be valid HTTPS URLs. Malformed assignments must fail fast rather than be silently repaired. Secrets and sensitive endpoint/bucket identifiers must never be logged.

---

## 20. Asset Upload Behavior

Uploads must be deterministic and safe to rerun. Always overwrite the exact deterministic storage key with the currently validated source bytes. This prevents stale objects when Entreno changes an image without changing product slug or gallery position.

Before scraping the complete catalog, the pipeline must verify authenticated bucket access through an isolated temporary object lifecycle: PUT, HEAD metadata, optional GET integrity, DELETE in `finally`, and post-delete NotFound confirmation. The diagnostic key must be unique and must not inspect or overwrite unrelated objects.

No distributed transaction or compensating-delete mechanism is required.

If:

```text
R2 upload succeeds
DB import later fails
```

the object may remain in R2.

This is acceptable for this one-shot showcase workflow.

Do not implement orphan cleanup automation.

---

## 21. Concurrency and Request Throttling

Do not fire hundreds of simultaneous requests at Entreno.

Use bounded concurrency.

Use:

```text
maximum 3 concurrent source requests
```

The complete 676-product census succeeded at concurrency 3 without rate limiting; higher concurrency requires new evidence.

Each source request must use a 15-second timeout and at most three attempts with exponential backoff and jitter. Retry network failures, HTTP 429, and HTTP 5xx. Do not retry permanent HTTP 4xx responses other than 429.

Do not attempt to bypass:

- Cloudflare rate limits;
- bot protection;
- challenges;
- authentication;
- access controls.

If protection prevents normal public HTTP extraction, stop and report the condition rather than implementing bypass logic.

---

## 22. Error Isolation During Scraping

A single unsupported or malformed source product should not necessarily terminate the entire extraction process.

Distinguish between:

### Fatal pipeline errors

Examples:

- sitemap cannot be fetched;
- output cannot be written;
- R2 configuration unavailable when asset upload is requested;
- category reconciliation cannot be completed;
- systemic parser failure affecting the catalog.

These should fail the run.

### Product-level exclusions

Examples:

- duplicate SKU conflict;
- more than two variant properties;
- incompatible variant pricing;
- required source field missing;
- malformed product-specific data.
- missing required positive weight;
- normalized property/value collision;
- invalid downloaded image bytes.

These products should be excluded from the final manifest and added to the report.

The final report must make exclusions explicit.

---

## 23. Final Validation

Before producing the final handoff, validate the generated manifest with the exact canonical `normalizeCatalogImportManifest` implementation. Reimplementing or approximating the schema is not allowed.

The final preparation step must verify at least:

- valid JSON shape;
- valid product slugs;
- at least one product;
- at least one image per product;
- at least one variant per product;
- simple-product invariant;
- maximum two variant properties;
- valid attribute/property mappings;
- globally unique SKUs;
- valid price;
- valid compare-at price;
- valid stock rules;
- positive normalized product weight;
- valid optional dimensions;
- unique variant combinations;
- valid storage-key format;
- valid primary-image ownership;
- at least one category per product;
- all final category slugs exist.
- target product catalog is empty;
- every referenced R2 key passes authoritative object-existence preflight.

The existing importer will perform the authoritative validation again later.

---

## 24. Output Files

The scraper/preparation pipeline must produce at least:

```text
scrape-output/
├── categories.json
├── products.json
└── report.md
```

Optional implementation-specific intermediate files may exist, but the final handoff should remain simple.

---

## 25. `products.json`

`products.json` must contain only the final EntrenAR import manifest:

```json
{
  "products": []
}
```

It must not contain:

- source URLs;
- Tiendanube product IDs;
- Tiendanube variant IDs;
- source image URLs;
- debug data;
- extraction warnings;
- excluded products;
- scraping metadata.

Those belong in the report or temporary internal data.

---

## 26. `report.md`

Create a human-readable Markdown report containing:

### Summary

```text
Discovered products
Successfully transformed
Excluded products
Final variants
Final images
R2 uploads
Categories reused
Categories added
Warnings
```

### Category Changes

List:

- existing categories reused;
- newly added categories;
- hierarchy changes/additions.

### Exclusions

For every excluded product include:

```text
product
URL
reason code
reason
relevant SKU/variant/value
```

Expected reason codes include:

```text
DUPLICATE_SKU
PRICE_VARIANCE_UNSUPPORTED
COMPARE_AT_INCOMPATIBLE
TOO_MANY_VARIANT_PROPERTIES
NORMALIZATION_COLLISION
MISSING_REQUIRED_LOGISTICS
INVALID_IMAGE_ASSET
INVALID_SOURCE_PRODUCT
MISSING_REQUIRED_DATA
```

### Warnings

Non-blocking anomalies that did not require exclusion.

### Final Readiness

Explicitly state whether:

```text
products.json is ready for catalog:import
```

and list any remaining manual blockers.

The report may state `ready for catalog:import` only when category synchronization has succeeded, all assets are uploaded, canonical manifest validation passes, the target has zero products, and R2 object preflight succeeds. There is no partially-ready or no-upload success state.

---

## 27. Import Execution Boundary

This PRD must not automatically execute:

```bash
npm --prefix backend run catalog:import -- scrape-output/products.json
```

The preparation pipeline ends after:

```text
categories ready
+ assets uploaded
+ products.json generated
+ final validation passed
+ report generated
```

The user/orchestrator will explicitly execute the importer afterward.

### Clean-target preparation

The project must provide a documented categories-only preparation path for the target environment. `catalog:import` must acquire its existing exclusive gate and reject before product persistence when any `Product` row already exists, even when incoming slugs and SKUs do not collide. Categories and other non-product commerce configuration may already exist.

### Full-catalog persistence hardening

The importer must preserve one atomic transaction while reducing avoidable database round trips:

1. resolve all referenced category slugs in one bulk query and reuse an in-memory slug-to-ID map;
2. batch image insertion while retaining the generated IDs needed by variant primary-image references;
3. batch variant insertion where supported;
4. retain the 12-second default mutation timeout for normal application operations;
5. allow only the explicit full-catalog ingestion path to request a timeout up to 30 seconds;
6. preserve exclusive advisory locking and complete rollback behavior.

The optimization is accepted only if the full-scale verification dataset remains below 8 seconds locally across five clean runs and a forced late failure commits zero catalog rows.

---

## 28. Existing Importer Must Remain Authoritative

Do not weaken or bypass importer validation to make scraped data pass.

If source data is incompatible with the existing contract:

```text
transform correctly
or
exclude/report
```

The following genuine blockers were measured and are approved PRD1 compatibility corrections within PRD2:

- product logistics fields in the import contract;
- strict zero-product clean-target enforcement;
- hierarchy-derived deterministic category projection;
- full-catalog persistence batching and ingestion-specific timeout support.

No other PRD1 domain decision may be weakened or bypassed.

---

## 29. Tests

Add automated tests for the scraper/transformer covering at minimum:

All normal automated tests must use committed local XML/HTML/binary fixtures and mocked network/storage boundaries. CI must not depend on the live Entreno site, Cloudflare DNS, or a real R2 bucket. The real-site census and R2 lifecycle remain explicit operational verification commands.

### Product discovery

- sitemap parsing;
- duplicate URL removal.

### Simple product

- no option properties;
- exactly one variant;
- empty attributes.

### Flavor variants

- property/value normalization;
- variant mapping;
- zero-stock variant retained.

### Color + Size

- two properties;
- sparse combinations;
- exact attribute mapping.

### Pricing

- identical prices accepted;
- differing prices excluded;
- valid compare-at price;
- incompatible compare-at values reported.

### Stock

- tracked positive quantity;
- tracked zero quantity;
- infinite/unmanaged stock without quantity.

### Logistics

- kilograms converted to positive integer grams;
- `depth` mapped to `lengthCm`;
- maximum valid variant values selected conservatively;
- zero/missing dimensions reported but valid weight retained;
- differing variant weights reported;
- product excluded when every variant lacks positive weight.

### SKU

- unique SKUs accepted;
- duplicate SKU products excluded.

### Images

- gallery order;
- 1-based positions;
- canonical storage-key generation;
- variant image association;
- missing association safely omitted.
- non-200 response rejected;
- invalid MIME or non-WebP magic bytes rejected;
- deterministic overwrite upload;
- uploader cleanup behavior for diagnostic objects.

### Categories

- existing categories reused;
- missing categories identified/added;
- final category slugs valid.
- 61-category snapshot invariants;
- idempotent category synchronization;
- parent-only and multi-leaf memberships;
- deterministic primary category independent of CUID;
- `performance` and `control-de-peso` route compatibility.

### Network and determinism

- stable product/category/report ordering under concurrent completion;
- timeout behavior;
- retry of 429/5xx and network failure;
- no retry of permanent 4xx;
- normalization collision exclusion.

### Validation

- generated manifest accepted by the canonical importer validator.
- populated target rejected before product writes;
- full-scale forced persistence failure rolls back every product, variant, image, and category link.

---

## 30. Verification

Implementation is complete only when:

- unit/integration tests pass;
- TypeScript passes;
- lint has no new blocking errors;
- build passes;
- generated `products.json` passes canonical validation;
- generated `categories.json` passes hierarchy validation and category synchronization is idempotent;
- R2 uploads referenced by the manifest exist;
- every final category slug exists;
- final SKUs are globally unique;
- excluded products are fully reported;
- no Playwright/browser automation is required;
- no image conversion pipeline is required;
- the existing catalog importer has not been automatically executed.
- production-scale benchmark covers at least 657 products, 1,131 variants, 3,869 images, and 804 category links;
- persistence avoids per-image and per-variant sequential insertion where batching is supported;
- category slugs are resolved in bulk rather than queried once per product;
- measured local end-to-end import remains below 8 seconds across five clean runs;
- forced late failure leaves zero catalog rows;
- public `ASSETS_BASE_URL` HEAD is verified once the custom domain is active.

---

## Out of Scope

Do not implement:

- recurring synchronization with Entreno;
- scheduled scraping;
- change detection;
- source hashes;
- `lastScrapedAt`;
- source URL persistence;
- incremental import;
- update reconciliation;
- deletion reconciliation;
- R2 orphan cleanup;
- distributed transactions;
- price-per-variant support;
- support for more than two variant properties;
- automatic SKU repair/deduplication;
- Playwright scraping;
- browser automation;
- CAPTCHA/challenge bypass;
- image recompression unless later proven necessary;
- automatic execution of `catalog:import`.

This is a **one-shot showcase catalog migration**.

---

## Deliverables

The implementation must leave:

1. scraper/extraction code;
2. transformation code;
3. deterministic `scrape-output/categories.json` and idempotent `catalog:sync-categories` support;
4. R2 asset upload support;
5. deterministic storage-key generation;
6. tests;
7. category-derived storefront/backend compatibility updates;
8. importer logistics, strict-clean-target, and bulk-persistence compatibility updates;
9. final `scrape-output/products.json`;
10. final `scrape-output/report.md`;
11. any required dependency/package-lock changes;
12. documented commands for storage preflight, scraping, category synchronization, validation, and manual import handoff.

---

## Completion Criteria

PRD2 is complete when the scraper can start from Entreno's public catalog and deterministically produce a fully prepared EntrenAR catalog import handoff:

```text
Entreno sitemap
        ↓
product URLs
        ↓
HTTP + Cheerio extraction
        ↓
data-variants + nube-sdk-script
        ↓
normalize / transform
        ↓
category reconciliation
        ↓
categories.json
        ↓
catalog:sync-categories
        ↓
download WebP assets
        ↓
generate canonical storageKeys
        ↓
upload assets to R2
        ↓
validate ImportProduct[]
        ↓
products.json
        +
report.md
```

The final output must be ready for the user/orchestrator to manually run the existing atomic EntrenAR catalog importer without requiring further transformation or product-domain decisions.
