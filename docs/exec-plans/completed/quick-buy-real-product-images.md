# ExecPlan: Quick-buy real product images

## Objective

Quick-buy modal, "product added" confirmation and offer cards show the real product photo, falling back to `ProductVisual` only when no image URL exists.

## Context

- `QuickBuyProduct` (`src/types/product.ts`) omitted `images`; `toQuickBuyProduct` (`src/lib/quick-buy-products.ts`) dropped them.
- `CartPreviewItem` (`src/types/cart.ts`) only carried `imageTone`.
- `QuickBuyProductConfigurator`, `OfferProductCard`, `ProductAddedModal` always rendered `ProductVisual`.
- `ProductCard` and `ProductImageGallery` already render `<img>` with `object-contain` when `url` exists.
- Cart persists in localStorage (`entrenar-cart-preview`), so new cart fields must be optional.

## Scope & Non-Goals

In: type changes, image propagation, image selection helper, three components, quote reconciliation keeping the image.
Out: backend, redesign, cart page/checkout thumbnails, persisted-store migration.

## Execution Plan

1. Add `images` to `QuickBuyProduct`; keep them in `toQuickBuyProduct`.
2. Add optional `imageUrl`/`imageAlt` to `CartPreviewItem`; fill them in `toCartPreviewItem` using a shared `getProductImage` helper (variant `primaryImageId` image with url, else first image with url).
3. Preserve image fields in `reconcileCartWithQuote`.
4. Render the real image in the three components with `ProductVisual` fallback.

## Decisions & Rationale

- Optional cart fields: existing persisted carts remain valid and fall back to `ProductVisual`.
- Selected variant drives the configurator image so it matches the cart item produced.
- Detail page entry works unchanged: `ProductDetail` already has `images`, passed to `toCartPreviewItem`.

## Progress Tracking

- [x] 1 types + quick-buy mapper
- [x] 2 cart item + helper
- [x] 3 quote reconciliation
- [x] 4 components
- [ ] Manual visual validation in browser (explicitly pending user verification; does not block technical closure)

## Validation

Planned and executed verification commands:

- `npx tsc --noEmit`: passed with 0 errors.
- `npx eslint` on modified files: passed with exit code 0.
- `npm run verify:frontend-acceptance`: passed (16/16 harnesses).
- Live browser visual validation: deliberately omitted from automated agent execution; explicitly pending user verification.
- Independent review: not required for localized, low-risk UI/adapter correction scope.

## Implementation Outcome

### Implemented

- **Types (`src/types/product.ts`, `src/types/cart.ts`)**:
  - Added `images` property to `QuickBuyProduct`.
  - Added optional `imageUrl?: string` and `imageAlt?: string` to `CartPreviewItem` to maintain full backward compatibility with persisted local carts (`entrenar-cart-preview`).
- **Mappers & Helpers (`src/lib/cart-items.ts`, `src/lib/quick-buy-products.ts`)**:
  - Updated `toQuickBuyProduct` mapper to retain `images: product.images`.
  - Added shared `getProductImage(images, variant)` helper to select the variant's `primaryImageId` image with a valid `url`, falling back to the first image with a valid `url`.
  - Updated `toCartPreviewItem` to populate `imageUrl` and `imageAlt` when available.
- **Cart Store Reconciliation (`src/stores/cart-checkout.actions.ts`)**:
  - Updated `reconcileCartWithQuote` to preserve existing `imageUrl` and `imageAlt` during quote refresh.
- **Component Rendering (`QuickBuyProductConfigurator`, `ProductAddedModal`, `OfferProductCard`)**:
  - `QuickBuyProductConfigurator` (`src/components/shop/quick-buy/QuickBuyProductConfigurator.tsx`): Dynamically resolves and renders the real product image for the currently selected variant (or first image) with `object-contain`, falling back to `ProductVisual` if absent.
  - `ProductAddedModal` (`src/components/shop/quick-buy/ProductAddedModal.tsx`): Displays `item.imageUrl` with fallback to `ProductVisual`.
  - `OfferProductCard` (`src/components/shop/quick-buy/OfferProductCard.tsx`): Displays real image for offer items with fallback to `ProductVisual`.

### Deviations from Design

None. The implementation follows the execution plan and architectural boundaries without deviation.

### Validation

- Static type check (`npx tsc --noEmit`): passed with 0 errors.
- Lint check (`npx eslint` focused): passed with exit code 0.
- Acceptance harness (`npm run verify:frontend-acceptance`): 16/16 passed.
- Browser visual inspection: explicitly pending user verification; not marked as completed and does not block technical closure.
- Independent review: not required given the localized nature of the correction.

### Follow-up

- User visual check in browser to verify image rendering in quick-buy configurator, modal, and offer cards against live or preview assets.
- Deliberately out-of-scope items: cart page / checkout thumbnails, backend model modifications, and persisted store migrations.
