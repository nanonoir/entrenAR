# ExecPlan: Structured variant selectors and readable variant names

## Objective

Every product with structured variant attributes (`Product.variantProperties` + `ProductVariant.attributes`) exposes one independent selector per attribute (Color, Talle, ...) in the product detail and the quick-buy configurator, using shared logic. SKU/name combinations are never offered as options when structured attributes exist. Variant names stop being SKUs for imported products.

## Context

- `ProductDetailCard` rendered `product.variants.map(item.label)` (one button per combination) and ignored `variantOptions`.
- `QuickBuyProductConfigurator` already had per-attribute selectors, but its logic lived inline and the hook let `selectedOptions` drift into combinations that do not exist.
- `useProductVariantSelection` is the shared state hook for both.
- Backend `toPublicCatalogProduct` maps `variant.name` to `label`; `PrismaCatalogImportRepository.persist` stores `variant.name ?? variant.sku`; the scraper transformer never sets variant `name`. Audit: 1119 names equal the SKU (1038 rebuildable from attributes, 81 simple products without properties).
- Prices, SKUs, stock and ids remain backend authority; the frontend only chooses which variant id to send.

## Scope & Non-Goals

In:
- Pure selection model (`src/lib/variant-selection.ts`) and shared `ProductVariantSelector` component used by detail and quick-buy.
- Single-value attributes shown as informational text instead of a choice.
- Cart/summary label derived from structured values (`Negro / M`).
- Backend `deriveVariantLabel` helper: used by the public/admin catalog mappers (when the stored name is empty or equals the SKU) and by manifest normalization so future imports persist readable names.
- Idempotent dry-run-by-default script to normalize existing names.

Out:
- Checkout API / checkout integration (investigated elsewhere).
- Heuristic SKU parsing; replacing custom names that differ from the SKU.
- Hardcoding product-specific behavior (combo contents come from existing description/properties only).
- Historical carts: persisted `variantLabel` keeps working; labels are not re-fetched.

## Execution Plan

1. Write `variant-selection.ts`: build selector model (selectable vs informational attributes), resolve a selection when an option changes (nearest existing combination, in-stock preferred), compute per-value availability, derive variant label.
2. Hook uses the resolver; add model output.
3. `ProductVariantSelector` component; replace inline UIs in detail and quick-buy.
4. `toCartPreviewItem` uses derived label.
5. Backend `variant-label.ts`; wire into mappers and `normalizeCatalogImportManifest`.
6. Normalization script `catalog:normalize-variant-names` (dry-run default, `--apply`).
7. Tests (frontend harness + backend specs), then tsc, lint, acceptance, backend unit.

## Decisions & Rationale

- A stored name is considered a placeholder only if empty or equal to the SKU; any other name is custom and kept.
- Derivation requires every property to resolve to a declared value label; otherwise nothing is derived (no guessing).
- Simple imported products (no properties) get the product name as variant name at import; existing ones are left to the dry-run report.
- Absent combinations: selecting a value changes only that attribute (no silent change of the others). A missing combination resolves to no variant (add disabled) and shows "Sin stock" on the values that cannot be combined with the current selection; every value stocked somewhere stays selectable, so disjoint sets remain navigable. The hook never falls back to an arbitrary variant; initialization still picks a real in-stock variant.
- Manifest/mapper label derivation accepts the `variantPropertySchema` shapes (optional property id = `slugify(name)`, string values = `slugify(label)`), and import treats `name === sku` as a placeholder.
- A value is unavailable only when every variant carrying it is out of stock.

## Progress Tracking

- [x] 1 selection model
- [x] 2 hook
- [x] 3 component + detail/quick-buy
- [x] 4 cart label
- [x] 5 backend helper + mappers + import
- [x] 6 normalization script
- [x] 7 tests and validation
- [ ] Manual visual verification in browser (explicitly pending user verification; does not block technical closure)

## Validation

- `tests/harnesses/variant-selection.harness.ts` (`npx tsx tests/harnesses/variant-selection.harness.ts`): passed. Verified independent attributes, absent combination handling without silent changes to other attributes, no arbitrary variant fallback (returns `undefined`/`null`), contextual stock availability flags, disjoint attribute navigation, exhausted combo handling, single-value informational attributes, derived combo labels, and legacy unconfigured fallback.
- `npm run verify:frontend-acceptance`: passed (17 harnesses including variant selection).
- Backend unit test suites (`npm run test:backend`): 90 suites / 549 tests passed (including `variant-label.spec.ts` covering label derivation, manifest schema shapes with optional property ids and string values, placeholder detection for `name === sku` or empty, and normalization planning).
- Static type checking (`npx tsc --noEmit` on root and backend): passed with 0 errors.
- Production builds: root frontend build (`npm run build`) and backend build (`npm run build:backend`) pass.
- Linting (`npx eslint` focused): passed clean with 0 errors on modified files.
- Local database normalization: executed once previously on local target database (`127.0.0.1:5432/entrenar`), updating 1,119 placeholder variant names (`name` only; `sku`, stock, prices untouched; 0 custom, 0 unresolved). Re-runs report 0 pending changes. No additional DB mutations were re-executed.
- Independent review: PASS.
- Deliberately not executed: live browser visual verification (pending manual user check), backend integration and e2e suites (targeted acceptance and unit tests provide proportional verification).

## Implementation Outcome

### Implemented

- **Selection Model & State (`src/lib/variant-selection.ts`, `src/hooks/useProductVariantSelection.ts`)**:
  - Independent variant selectors per attribute, eliminating raw SKU/combo buttons when structured attributes exist.
  - Pure selection resolution: selecting an attribute value modifies only that attribute without mutating others.
  - Strict combination matching: if an attribute combination does not exist, `findVariantByOptions` returns `undefined`, the hook resolves `selectedVariant` as `null`, and add-to-cart is disabled without falling back to an arbitrary variant.
  - Contextual stock and availability: attributes calculate `disabled` (when no variant has stock for that value across the product) and `outOfStock` (when the value cannot be combined with currently selected attributes in stock). Disjoint attribute sets remain fully navigable.
  - Single-value attributes render as informational labels rather than interactive choices.
  - Cart line items and preview labels derive human-readable names (`Negro / M`) from structured values.
- **UI Components (`src/components/shop/products/ProductVariantSelector.tsx`)**:
  - Shared selector component used by both `ProductDetailCard` and `QuickBuyProductConfigurator`.
- **Backend Label Derivation & Import Validation (`backend/src/modules/catalog/variant-label.ts`, `backend/src/modules/catalog-import/manifest-validator.ts`)**:
  - Canonical `deriveVariantLabel` and `resolveVariantLabel` integrated into public and admin catalog mappers (`catalog.mapper.ts`).
  - Import manifest normalization detects placeholder names (`name === sku` or empty) and generates structured labels while preserving custom names.
  - Full catalog schema compatibility: supports optional property `id` (defaulting to slugified name) and string array values.
- **Database Normalization Script (`backend/src/modules/catalog/variant-name-normalization.main.ts`, `backend/src/modules/catalog/variant-name-normalization.ts`)**:
  - `catalog:normalize-variant-names` script with idempotent dry-run default and `--apply`.
  - Executed once on local target database (`127.0.0.1:5432/entrenar`), updating 1,119 placeholder variant names (`name` only; `sku`, stock, prices untouched; 0 custom, 0 unresolved). Re-run confirms 0 pending.

### Deviations from Design

None. The implementation follows the design and architectural boundaries without deviation.

### Validation

- Frontend acceptance test harness (`tests/harnesses/variant-selection.harness.ts` & `npm run verify:frontend-acceptance`): 17/17 harnesses passed.
- Backend unit test suites (`npm run test:backend`): 90 suites / 549 tests passed (including `variant-label.spec.ts`).
- Root and backend static type checking (`npx tsc --noEmit`): 0 errors.
- Frontend and backend production builds: passed.
- Linting (`npx eslint` focused): passed clean with 0 errors.
- Database normalization: 1,119 rows updated once on local database; re-run idempotent (0 pending). No additional DB mutations performed.
- Independent review: PASS.
- Live browser visual inspection: explicitly tracked as pending manual user check.
- Integration and e2e test suites: omitted in favor of proportional unit and acceptance harness coverage.

### Follow-up

- Live browser visual verification: pending user review on storefront product detail and quick-buy configurator.
- Normalization reporting telemetry: `planVariantNameNormalization` classifies non-placeholder names as `customNames`, which on re-run includes previously normalized names alongside human-authored custom names. Tracked in `docs/exec-plans/tech-debt-tracker.md`.
- Deliberately out-of-scope: checkout and payment gateway integration; retroactively rewriting historical cart records stored in localStorage.
