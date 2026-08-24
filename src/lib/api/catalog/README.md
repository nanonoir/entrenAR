# Catalog Adapter Compatibility

`NEXT_PUBLIC_DATA_SOURCE` selects the catalog repository. Its only supported values are `mock` (the safe default) and `api`.

The API repository maps REST DTOs into existing storefront and admin contracts without importing Prisma. Public product URLs always consume the backend `slug`, which is the backend projection of `publicSlug`.

The Phase 2 seed intentionally defers ratings, reviews, generated galleries, descriptions, subcategory links, and featured/best-seller visual metadata. While those fields are not persisted with parity, `CatalogApiRepository` retains matching mock values by product ID or public slug and supplies a deterministic one-image fallback for newly API-created products. Numeric API prices are validated as finite numbers. Public infinite stock remains `Number.MAX_SAFE_INTEGER`; admin infinite stock remains `{ type: "infinite" }` or `"infinite"` for variants.

This compatibility mapper is temporary. It belongs to the Phase 6 mock-removal gate and must be removed only after persisted API fields have parity with the existing UI contracts.
