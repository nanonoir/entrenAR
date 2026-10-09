# Catalog Import Contract Report

This report describes the **implemented** catalog-import boundary that the future scraper and PRD2 importer must satisfy. It is not a restatement of PRD1.

## 1. Final `ImportProduct` Contract

The importer accepts a manifest with this top-level shape:

```ts
type CatalogImportManifest = {
  products: ImportProduct[] // minimum 1
}
```

The runtime contract is the Zod schema in `backend/src/modules/catalog-import/manifest-validator.ts`:

```ts
const slugSchema = z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const moneySchema = z.number().finite().positive()

const propertyValueSchema = z.object({
  id: slugSchema,
  label: z.string().trim().min(1),
})

const propertySchema = z.object({
  id: slugSchema,
  name: z.string().trim().min(1),
  values: z.array(propertyValueSchema).min(1),
})

const imageSchema = z.object({
  storageKey: z.string().trim().min(1),
  position: z.number().int().positive(),
  alt: z.string().trim().optional(),
}).strict()

const variantSchema = z.object({
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
  attributes: z.record(z.string(), slugSchema).default({}),
  stockMode: z.enum(["TRACKED", "INFINITE"]),
  quantity: z.number().int().nonnegative().optional(),
  primaryImageStorageKey: z.string().trim().min(1).optional(),
}).strict()

const productSchema = z.object({
  slug: slugSchema,
  publicSlug: slugSchema.optional(),
  name: z.string().trim().min(1),
  brand: z.string().trim().min(1).optional(),
  descriptionHtml: z.string().optional(),
  shortDescription: z.string().trim().optional(),
  price: moneySchema,
  compareAtPrice: moneySchema.optional(),
  variantProperties: z.array(propertySchema).default([]),
  categorySlugs: z.array(slugSchema).min(1),
  images: z.array(imageSchema).min(1),
  variants: z.array(variantSchema).min(1),
  tags: z.array(z.string().trim().min(1)).default([]),
  shippingRequired: z.boolean().default(true),
}).strict()

const catalogImportManifestSchema = z.object({
  products: z.array(productSchema).min(1),
})
```

### Required vs optional fields

Required at input level:

- `slug`
- `name`
- `price`
- `categorySlugs` with at least one slug
- `images` with at least one image
- `variants` with at least one variant
- `variants[].sku`
- `variants[].stockMode`

Optional/defaulted:

- `publicSlug`: defaults to `slug`
- `brand`
- `descriptionHtml`
- `shortDescription`
- `compareAtPrice`
- `variantProperties`: defaults to `[]`
- `tags`: defaults to `[]`
- `shippingRequired`: defaults to `true`
- `variants[].name`: persistence falls back to the SKU
- `variants[].attributes`: defaults to `{}`
- `variants[].quantity`: required only for `TRACKED`
- `variants[].primaryImageStorageKey`
- `images[].alt`

The schema is strict for Product, Variant, and Image objects. Unknown fields such as `salePrice`, `promotionalPrice`, or variant-level `price` are rejected.

### Complete examples

#### Simple product

```json
{
  "products": [
    {
      "slug": "creatina-monohidrato-300g",
      "name": "Creatina Monohidrato 300 g",
      "brand": "Entreno",
      "descriptionHtml": "<p>Creatina monohidrato micronizada.</p>",
      "shortDescription": "Rendimiento y recuperación.",
      "price": 8000,
      "compareAtPrice": 10000,
      "categorySlugs": ["suplementos", "creatina"],
      "variantProperties": [],
      "images": [
        {
          "storageKey": "products/creatina-monohidrato-300g/1.webp",
          "position": 1,
          "alt": "Creatina Monohidrato 300 g"
        }
      ],
      "variants": [
        {
          "sku": "ENT-CREA-300",
          "attributes": {},
          "stockMode": "TRACKED",
          "quantity": 25,
          "primaryImageStorageKey": "products/creatina-monohidrato-300g/1.webp"
        }
      ],
      "tags": ["creatina"],
      "shippingRequired": true
    }
  ]
}
```

#### Product with flavor

```json
{
  "products": [
    {
      "slug": "proteina-whey-900g",
      "publicSlug": "proteina-whey-900g",
      "name": "Proteína Whey 900 g",
      "brand": "Entreno",
      "descriptionHtml": "<p>Proteína de suero en distintos sabores.</p>",
      "price": 42000,
      "compareAtPrice": 50000,
      "categorySlugs": ["suplementos", "proteinas"],
      "variantProperties": [
        {
          "id": "sabor",
          "name": "Sabor",
          "values": [
            { "id": "chocolate", "label": "Chocolate" },
            { "id": "vainilla", "label": "Vainilla" }
          ]
        }
      ],
      "images": [
        {
          "storageKey": "products/proteina-whey-900g/1.webp",
          "position": 1,
          "alt": "Proteína Whey 900 g"
        },
        {
          "storageKey": "products/proteina-whey-900g/2.webp",
          "position": 2,
          "alt": "Proteína Whey sabor chocolate"
        }
      ],
      "variants": [
        {
          "sku": "ENT-WHEY-CHO-900",
          "name": "Chocolate",
          "attributes": { "sabor": "chocolate" },
          "stockMode": "TRACKED",
          "quantity": 12,
          "primaryImageStorageKey": "products/proteina-whey-900g/2.webp"
        },
        {
          "sku": "ENT-WHEY-VAI-900",
          "name": "Vainilla",
          "attributes": { "sabor": "vainilla" },
          "stockMode": "TRACKED",
          "quantity": 0
        }
      ]
    }
  ]
}
```

#### Product with Color + Size

```json
{
  "products": [
    {
      "slug": "remera-entrenar-performance",
      "name": "Remera EntrenAR Performance",
      "price": 22000,
      "categorySlugs": ["indumentaria", "remeras"],
      "variantProperties": [
        {
          "id": "color",
          "name": "Color",
          "values": [
            { "id": "negro", "label": "Negro" },
            { "id": "blanco", "label": "Blanco" }
          ]
        },
        {
          "id": "talle",
          "name": "Talle",
          "values": [
            { "id": "s", "label": "S" },
            { "id": "m", "label": "M" },
            { "id": "l", "label": "L" }
          ]
        }
      ],
      "images": [
        {
          "storageKey": "products/remera-entrenar-performance/1.webp",
          "position": 1,
          "alt": "Remera EntrenAR Performance negra"
        }
      ],
      "variants": [
        {
          "sku": "ENT-REM-NEG-S",
          "attributes": { "color": "negro", "talle": "s" },
          "stockMode": "TRACKED",
          "quantity": 4
        },
        {
          "sku": "ENT-REM-NEG-M",
          "attributes": { "color": "negro", "talle": "m" },
          "stockMode": "TRACKED",
          "quantity": 0
        },
        {
          "sku": "ENT-REM-BLA-M",
          "attributes": { "color": "blanco", "talle": "m" },
          "stockMode": "TRACKED",
          "quantity": 2
        }
      ]
    }
  ]
}
```

## 2. Variants

- Every Product MUST have at least one ProductVariant.
- A product with no options has `variantProperties: []` and exactly one variant with `attributes: {}`.
- A simple product does not use a visible `Default` option.
- `variantProperties` supports zero, one, or two generic properties. Property names are data; they are not limited to Color/Size/Flavor.
- Each property has a slug-like `id`, a display `name`, and at least one `{id, label}` value.
- Configurable variants MUST define exactly one attribute value for every declared property.
- Attribute keys and values must match declared property/value IDs.
- Variant combinations are unique per Product. Missing Cartesian combinations are not generated.
- A real variant with `quantity: 0` is retained and shown as unavailable/out of stock.
- `TRACKED` requires an integer `quantity >= 0`; `INFINITE` requires that `quantity` be omitted.
- `sku` is required and globally unique. It belongs exclusively to ProductVariant.
- The database also has an `OUT_OF_STOCK` enum value for legacy/internal compatibility, but the import contract accepts only `TRACKED` and `INFINITE`.
- No `isDefault` field is accepted or persisted.

## 3. Prices

### Canonical import fields

```ts
Product.price: Decimal(12, 2)       // required; current charged price
Product.compareAtPrice: Decimal?    // optional; previous crossed-out price
```

- `price` is the amount charged.
- `compareAtPrice`, when present, MUST be greater than `price`.
- Savings amount and percentage are derived from those two fields.
- There is no variant-level price in the import contract or final ProductVariant schema.

### Legacy names

- `salePrice` is no longer a Product database column. Some admin API projections still expose `salePrice` as a compatibility alias equal to `Product.price`.
- `promotionalPrice` still exists as a nullable legacy Product column in the final Prisma schema, but it is not accepted by `ImportProduct`; the importer writes it as `null` for imported products.
- The scraper MUST emit only `price` and optional `compareAtPrice`.

If source variants have different prices, the current importer rejects variant-level price fields because Variant objects are strict. It does not average, choose, or silently normalize different prices. The scraper must only emit one shared Product price when the source product is compatible; otherwise the source needs a future product/pricing decision.

## 4. Images / R2

### Persisted `ProductImage`

```ts
ProductImage {
  id: string
  productId: string
  storageKey: string
  position: integer
  altText: string?
  createdAt: DateTime
}
```

The import JSON uses `images[].alt`; the importer persists it as `ProductImage.altText`.

### Storage key

The key MUST be exactly:

```text
products/{product-slug}/{position}.webp
```

Rules:

- `{product-slug}` must equal `ImportProduct.slug`.
- `{position}` is a positive, 1-based integer.
- Positions must be unique within the Product.
- The importer compares the complete expected string; paths, hosts, query strings, other extensions, traversal, and mismatched slugs fail validation.
- Every Product requires at least one image.

### Variant primary image

The input field is:

```ts
variants[].primaryImageStorageKey?: string
```

It must reference one of the same Product's `images[].storageKey` values. The importer resolves it to `ProductVariant.primaryImageId`, a foreign key to `ProductImage`.

The database constraints are:

- unique `(productId, position)`;
- unique `(productId, storageKey)`;
- `ProductImage.productId -> Product.id` with `ON DELETE CASCADE`;
- `ProductVariant.primaryImageId -> ProductImage.id` with `ON DELETE RESTRICT`.

### R2 preflight

- The scraper uploads the WebP before running the importer.
- The importer does not download, convert, optimize, upload, or delete objects.
- `ASSETS_BASE_URL` is required for preflight.
- Each object is checked with an HTTP `HEAD` request against `ASSETS_BASE_URL/{storageKey}`. The adapter checks up to 8 keys concurrently.
- HTTP 404 becomes `MISSING_OBJECT`; other non-success responses or missing `ASSETS_BASE_URL` fail the R2 preflight.
- Public catalog URLs are resolved as `ASSETS_BASE_URL/{storageKey}`.

## 5. Categories

`ImportProduct` uses:

```ts
categorySlugs: string[] // minimum 1, unique within the product
```

- The importer only resolves existing categories by `Category.slug`.
- It does not create, rename, infer, reorder, or restructure categories.
- Every slug must already exist or the complete manifest is rejected.
- Multiple slugs create multiple `ProductCategory` rows.
- Category hierarchy is represented by the existing `Category.parentId` relationships in the database. It is not embedded in `ImportProduct` and is not created by this importer.
- The scraper must map source taxonomy to the existing EntrenAR category slugs before producing the manifest.

## 6. Description

The input field is optional `descriptionHtml`.

Before persistence, the importer sanitizes it. The current allowlist preserves only:

```text
a, br, em, h2, h3, li, ol, p, strong, ul
```

Rules:

- Unsupported tags are removed.
- Attributes are removed except `href` on `<a>`.
- `<a href>` accepts only `http:`, `https:`, or `mailto:` URLs; unsafe links become an attribute-less anchor.
- `javascript:` is removed.
- The sanitized result is persisted as Product.description.
- Plain text is valid input and remains safe content.

## 7. Importer

### Entrypoint

After building the backend:

```bash
npm --prefix backend run catalog:import -- path/to/products.json
```

The package script runs the compiled entrypoint:

```text
backend/dist/src/modules/catalog-import/catalog-import.main.js
```

The input is one UTF-8 JSON file containing `CatalogImportManifest`.

### Validation order

1. Require a manifest path.
2. Read the file as UTF-8.
3. Parse JSON.
4. Validate the strict Zod shape.
5. Normalize `publicSlug`, defaults, and sanitized `descriptionHtml`.
6. Validate product-level invariants, variant attributes, stock rules, storage keys, image ownership, and uniqueness inside the manifest.
7. Load existing Product slugs, public slugs, Variant SKUs, and Category slugs.
8. Reject conflicts or unknown categories.
9. Verify every R2 object with `HEAD`.
10. Enter the exclusive mutation gate, repeat identity conflict checks, and persist Product → ProductImage → ProductCategory → ProductVariant in one Prisma transaction.

### Atomic behavior

- One invalid product rejects the complete manifest before writes.
- Any persistence failure rolls back the complete transaction.
- No partial Product, image, category relation, or variant remains committed.
- The importer is clean-target/one-shot: existing Product slugs, public slugs, or Variant SKUs cause conflict. It does not reconcile or delete records from a previous import.

### Output

Success prints JSON similar to:

```json
{
  "ok": true,
  "runId": "catalog-import-mabc123",
  "counts": { "products": 42, "variants": 67, "images": 91 }
}
```

Failure prints redacted JSON:

```json
{
  "ok": false,
  "issues": [
    {
      "productSlug": "creatina-monohidrato-300g",
      "field": "images",
      "key": "products/creatina-monohidrato-300g/1.webp",
      "code": "MISSING_OBJECT",
      "message": "Referenced media object does not exist."
    }
  ]
}
```

Exit codes:

- `0`: successful import;
- `2`: expected reportable failure, including missing input, invalid JSON, validation, category, conflict, or R2 failure;
- `1`: unexpected application/persistence failure.

## 8. Constraints PRD2 Must Know

- Manifest `products` array: minimum 1.
- Product `slug`, `publicSlug`, property IDs/value IDs, category slugs, and SKUs use lowercase slug validation where applicable; SKU only requires trimmed non-empty text but is globally unique.
- `Product.slug` and `Product.publicSlug` are database-unique.
- `ProductVariant.sku` is database-unique globally.
- Product must have at least one Variant; the database has a deferred trigger enforcing presence for new Product inserts.
- `variantProperties` has a maximum of 2 entries.
- Product variants have unique attribute combinations.
- Simple products require exactly one variant with `attributes: {}`.
- `variants` and `images` require at least one entry.
- `categorySlugs` requires at least one unique existing category slug.
- Product `price` is a required positive Decimal(12,2).
- `compareAtPrice`, when present, must be positive and strictly greater than `price`.
- `TRACKED` quantity is required, integer, and non-negative.
- `INFINITE` quantity must be omitted.
- Image positions are positive integers and unique within a Product.
- Storage keys must exactly match `products/{slug}/{position}.webp`.
- Variant primary-image keys must belong to the Product's gallery.
- R2 object existence is mandatory before any database write.
- Existing Product slug/publicSlug/SKU conflicts reject the whole manifest.
- The target must be clean for this one-shot import; no incremental update/delete reconciliation exists.
- ProductCategory has a composite primary key `(productId, categoryId)` and restrictive Product/Category foreign keys.
- ProductImage has unique `(productId, position)` and `(productId, storageKey)` constraints.
- CartItem requires a non-null `variantId` after the final migration.
- Historical OrderItem and InventoryHistory rows may retain `variantId: null`; the scraper/importer must not attempt to provide or rewrite historical records.
- `ProductVariant.primaryImageId` uses a restrictive foreign key; referenced gallery images cannot be deleted without first clearing the association.
- R2 checks use `ASSETS_BASE_URL`; there is no importer-side R2 upload path.

## 9. Required Pre-import State

Before running the importer:

1. **R2 media**: every `storageKey` in the manifest must already exist as an accessible WebP object under `ASSETS_BASE_URL` and respond successfully to `HEAD`.
2. **Categories**: every `categorySlugs` entry must already exist in the database, including the intended hierarchy via `Category.parentId`.
3. **Database**: PostgreSQL must be reachable and all Prisma migrations must be applied. The final schema includes the catalog foundation, cleanup, and universal-variant constraint migrations.
4. **Clean target**: no existing Product with a manifest `slug`/`publicSlug` and no existing Variant with a manifest SKU.
5. **Environment**: the Nest application context requires:
   - `DATABASE_URL`;
   - `JWT_ACCESS_SECRET` with at least 32 characters;
   - `JWT_REFRESH_SECRET` with at least 32 characters;
   - `ADMIN_GATE_SIGNING_SECRET` with at least 32 characters;
   - `ASSETS_BASE_URL` for image preflight.
6. **Build**: `npm --prefix backend run build` must have produced the compiled CLI before running `catalog:import`.

Useful checks:

```bash
npm exec prisma migrate status -- --config ./prisma.config.ts --schema ./prisma/schema.prisma
npm --prefix backend run build
npm --prefix backend run catalog:import -- path/to/products.json
```

## 10. Relevant Files

- `backend/prisma/schema.prisma` — final Product, ProductVariant, ProductImage, Category, ProductCategory, and CartItem schema.
- `backend/prisma/migrations/20260925000000_catalog_import_readiness_foundation/migration.sql` — additive catalog/import foundation migration.
- `backend/prisma/migrations/20260926000000_catalog_import_readiness_cleanup/migration.sql` — removal of legacy ownership columns and non-null CartItem variant IDs.
- `backend/prisma/migrations/20260926010000_catalog_import_readiness_constraints/migration.sql` — deferred Product→ProductVariant presence trigger.
- `backend/src/modules/catalog-import/manifest-validator.ts` — exact Zod contract, normalization, invariant checks, and HTML sanitizer.
- `backend/src/modules/catalog-import/catalog-import.service.ts` — preflight order, R2 verification orchestration, and report handling.
- `backend/src/modules/catalog-import/catalog-import.repository.ts` — category resolution, atomic Prisma persistence, and transaction conflict recheck.
- `backend/src/modules/catalog-import/catalog-import.command.ts` — file input, JSON parsing, CLI exit codes, and JSON output.
- `backend/src/modules/catalog-import/catalog-import.main.ts` — compiled CLI entrypoint.
- `backend/src/modules/catalog-import/catalog-import.module.ts` — Nest registration.
- `backend/src/modules/catalog-import/ports/object-existence.port.ts` — R2 existence boundary.
- `backend/src/modules/catalog-import/adapters/r2-object-existence.adapter.ts` — `ASSETS_BASE_URL` + HTTP `HEAD` implementation and concurrency limit.
- `backend/src/app.module.ts` — imports `CatalogImportModule`.
- `backend/src/modules/catalog/catalog.mapper.ts` — public/admin image URL resolution, category projections, and compatibility aliases.
- `backend/src/config/app.config.ts` — required backend environment variables and validation.
- `backend/.env.example` — local environment variable template.
- `backend/package.json` — `catalog:import` script.
- `backend/src/modules/catalog-import/*.spec.ts` — contract, preflight, report, and sanitizer tests.
- `backend/test/catalog-import.e2e-spec.ts` — first import, conflict, rollback, and visibility tests.
- `backend/prisma/seed.ts` — final-schema showcase seed reference.

## Scraper Handoff

The scraper must output one `products.json` manifest matching the strict `ImportProduct` contract, use existing EntrenAR category slugs, generate keys exactly as `products/{slug}/{position}.webp`, upload those WebP files to the asset host before import, and emit the same keys in JSON. It must provide one shared Product price, globally unique variant SKUs, real variants only, and explicit `TRACKED`/`INFINITE` inventory. Run the compiled importer only after PostgreSQL migrations, categories, environment variables, and all R2 `HEAD` checks are ready; the importer is one-shot and atomic, so one invalid product rejects the entire manifest.
