# ExecPlan: Wishlist real product images

## Objective

Wishlist cards in the account area show the real product photo, falling back to `ProductVisual` only when no image URL exists.

## Context

- `WishlistProductCard` typed its product as `ProductSummary` and rendered `ProductVisual` unconditionally.
- The wishlist section does not render the `/wishlist` response. `AccountDashboardClient` filters the `products` prop (server-loaded `getCatalogRepository().getPublicProducts()`, i.e. `ProductDetail[]` with authorized `images`) by the ids held in `useWishlistStore`.
- `GET /wishlist` (`toWishlistProduct`, `mapWishlistProduct`) only feeds `productIds` into the store; its summary shape is not rendered, so it is not the source of the missing image.
- `ProductCard` already renders persisted images with `ProductVisual` fallback; `getProductImage` (`src/lib/cart-items.ts`) selects the first image with a `url`.

## Scope & Non-Goals

In: card rendering, a local intersection type (`WishlistProduct`) threaded through the account component chain.
Out: backend wishlist contract/mapper, wishlist API adapter, `src/types/product.ts`, catalog mapper, variants and checkout work, per-card fetches.

## Execution Plan

1. Add `WishlistProduct = ProductSummary & Partial<Pick<ProductDetail, "images">>` to `src/types/account.ts`.
2. Use it in `AccountDashboard`, `AccountDashboardClient`, `AccountLayout`, `AccountSectionPanel`, `WishlistSection`, `WishlistProductCard`.
3. Render the real image in `WishlistProductCard` (via `getProductImage`) with `ProductVisual` fallback.

## Decisions & Rationale

- Backend and adapter are unchanged: the media already reaches the client through the public catalog data and no extra fetch is needed. Adding `images` to the wishlist DTO would be dead payload and would touch shared contracts. No backend restart is required.
- Intersection type avoids editing the shared `ProductSummary`.

## Progress Tracking

- [x] 1 type
- [x] 2 prop chain
- [x] 3 card rendering
- [ ] Manual visual validation in browser (pending user verification; does not block technical closure)

## Validation

- `npx tsc --noEmit`
- `npx eslint src/types/account.ts "src/components/shop/account/**/*.tsx"`
- `npm run verify:frontend-acceptance`
- Manual visual validation in browser (pending user verification)

## Implementation Outcome

### Implemented

- **Type Definition (`src/types/account.ts`)**:
  - Introduced local intersection type `WishlistProduct = ProductSummary & Partial<Pick<ProductDetail, "images">>`.
  - Avoided altering the global `ProductSummary` contract while allowing product images from the catalog repository to be carried through.
- **Account Dashboard Prop Chain**:
  - Updated `AccountDashboard`, `AccountDashboardClient`, `AccountLayout`, `AccountSectionPanel`, and `WishlistSection` to type catalog product collections as `WishlistProduct[]`.
- **Card Rendering (`src/components/shop/account/cards/WishlistProductCard.tsx`)**:
  - Leveraged `getProductImage(product.images)` from `@/lib/cart-items` to retrieve the first image with a valid `url`.
  - Rendered `<img>` with `object-contain` when a URL exists, preserving `ProductVisual` fallback when no image URL is present.
- **Backend & Network Footprint**:
  - Zero backend or API adapter changes; no backend restart or schema migration required. Public catalog data already delivers image URLs to the client.

### Deviations from Design

None. The implementation follows the execution plan and architectural boundaries without deviation.

### Validation

- Static type check (`npx tsc --noEmit`):
  - Wishlist and account files are completely free of type errors.
  - Global `tsc` check was blocked during validation by a transient error in concurrent, uncommitted variants work outside this scope (`QuickBuyProductConfigurator.tsx(82)` referencing undefined `attributes`). Not declared as globally approved due to this parallel task.
- Lint check (`npx eslint src/types/account.ts "src/components/shop/account/**/*.tsx"`): passed clean with 0 warnings and 0 errors.
- Acceptance harness (`npm run verify:frontend-acceptance`): passed all 17 harnesses successfully.
- Visual inspection: explicitly pending user verification in browser; not marked as done, does not block technical closure.
- Backend isolation: backend was untouched; no backend test suites executed and no server restart needed.

### Follow-up

- Manual visual verification in browser by the user to confirm wishlist image display and fallback styling against live data.
- Deliberately out-of-scope work: backend wishlist contract/mapper updates, wishlist API adapter modifications, global `ProductSummary` changes, per-card fetches, and variant selection in wishlist.
