# Design: Checkout Flow

## Technical Approach

Create a dedicated `src/app/(checkout)` route group for `/carrito` and `/checkout` so checkout avoids the `(shop)` chrome (`TopPromoBar`, nav, drawers, footer). Keep this phase static/mock-only: reuse the Zustand cart preview, totals, free-shipping, and offer-product patterns; centralize checkout-specific copy/options in `src/lib/data`; use focused client components for persisted cart hydration, collapsible steps, and selected options.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Checkout shell | New `(checkout)` layout with static `#F5F5F5` header/footer and black logo | Hide shop chrome conditionally inside `(shop)` | Preserves route-group separation and avoids coupling checkout to shop drawers/nav. |
| Cart source | Reuse `useCartStore`, `useCartTotals`, `useCartOffers` | Duplicate static cart data per page | Keeps preview cart behavior consistent and respects existing `localStorage` persistence. |
| Mock data | Add `src/lib/data/checkout.ts` | Scatter literals in components | Keeps current data-layer convention and prepares backend replacement later. |
| Input icons | Extend `Input` with optional `trailingIcon`/`trailingLabel` wrapper slot | Build one-off checkout inputs only | Backward-compatible primitive change supports labels/helpers/icons without changing validation semantics. |
| Shipping logos | Reference `public/andreani.svg` and `public/correoArgentino.svg` via `next/image` | Add remote assets or duplicate SVGs | Repo already contains both static logos; keep stable public paths for mock shipping providers. |

## Data Flow

    /carrito, /checkout
      └─ Checkout client islands ──→ useCartStore.persist.rehydrate()
              │                     ├─ useCartTotals(items)
              │                     └─ useCartOffers(items)
              └─ src/lib/data/checkout.ts ──→ shipping/payment/coupon/transfer UI

Final actions update only local UI state/copy. They MUST NOT create orders, payment sessions, coupon validation, upload persistence, stock reservation, or backend validation.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/(checkout)/layout.tsx` | Create | Distraction-free shell with black logo, minimal header/footer, grey background. |
| `src/app/(checkout)/carrito/page.tsx` | Create | Cart review entry route. |
| `src/app/(checkout)/checkout/page.tsx` | Create | Checkout step route using client step shell. |
| `src/components/checkout/*` | Create | `CheckoutShell`, `CartReview`, `CheckoutSummary`, `CheckoutSteps`, `DeliveryOptions`, `PaymentOptions`, `BankTransferPanel`, `CouponBox`, `FreeShippingProgress`. |
| `src/lib/data/checkout.ts` | Create | Mock shipping providers, payment methods, coupon display, bank-transfer instructions, secure-copy labels. |
| `public/andreani.svg`, `public/correoArgentino.svg` | Keep/use | Existing static logos for shipping options; reference with `src="/andreani.svg"` and `src="/correoArgentino.svg"`. |
| `src/components/ui/Input.tsx`, `src/types/ui.ts` | Modify | Add optional trailing icon support with accessible label. |
| `src/components/shop/cart/CartDrawer.tsx` | Modify | Point `Iniciar Pago` to `/carrito` or `/checkout` per final CTA flow. |
| `src/lib/routes.ts` | Modify | Add `checkoutRoutes = { cart: "/carrito", checkout: "/checkout", legacy: "/finalizar-compra" }`. |
| `src/app/(shop)/finalizar-compra/page.tsx` | Modify | Replace with redirect/compatibility entry so old shop-chrome checkout is not primary. |

## Interfaces / Contracts

```ts
type CheckoutStepId = "identification" | "delivery" | "payment";
type CheckoutPaymentMethodId = "mercado-pago" | "stripe" | "bank-transfer";
type ShippingProvider = { id: string; name: string; logoSrc: string; eta: string; price: number };
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Not configured | Defer; no test runner exists. |
| Integration | Route rendering, cart hydration, step selection | Manual smoke checks for `/carrito`, `/checkout`, empty cart, mobile/medium/desktop. |
| Quality | Types, lint, production build | Run `npm run lint`, `npx tsc --noEmit`, `npm run build`. |

## Migration / Rollout

No data migration required. Work-unit boundaries: 1) route shell/routes/route constants, 2) cart review and summary, 3) checkout steps/payment/shipping data, 4) input icon support and polish/quality pass. PR may exceed 400 lines, but commits should follow these boundaries.

## Open Questions

- [ ] Should `/finalizar-compra` redirect to `/carrito` or `/checkout` for legacy compatibility?
