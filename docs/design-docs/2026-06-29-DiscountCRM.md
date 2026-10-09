# Design: DiscountCRM

## Technical Approach

The change introduces a fully functional mock CRM module for managing commercial discounts: Coupons and Automatic Free Shipping rules. The module will be integrated into the existing `(admin)` route group and will use a single centralized in-memory Zustand store (`admin-discounts-store.ts`) for both entities. We will create two separate navigation branches (`/admin/descuentos/cupones` and `/admin/descuentos/envio-gratis`), abandoning direct links in favor of a sidebar accordion. Form complexity will be managed using React Hook Form + Zod, split into logical sub-component cards, and UI will adhere strictly to existing primitives and responsive mobile-card constraints.

## Architecture Decisions

### Decision: State Management Structure

**Choice**: A single `admin-discounts-store.ts` managing both `coupons` and `shippingDiscounts` arrays, with separate domain commands (e.g. `createCoupon`, `createShippingDiscount`).
**Alternatives considered**: Two separate stores (`admin-coupons-store.ts` and `admin-shipping-discounts-store.ts`).
**Rationale**: Both entities belong to the "Discounts" domain and share common UI patterns (like history, empty states, and status toasts). Managing them in one store aligns with the existing EntrenAR pattern (e.g., `admin-sales-store.ts` manages sales, payments, and shipments) and reduces boilerplate while keeping the entities structurally independent.

### Decision: Reusable Selection Drawers

**Choice**: Build a generic `SelectionDrawer<T>` component (or a shared pattern) that can handle products, categories, shipping methods, and zones, taking an array of options and returning selected IDs via callback, preserving them as chips in the form.
**Alternatives considered**: Copy-pasting four separate drawer components (`CategoryDrawer`, `ProductDrawer`, etc.).
**Rationale**: A single generic component reduces code duplication significantly, keeps components under the 300-line limit, and ensures consistent behavior (search, checkbox selection, state persistence on back) across all discount forms.

### Decision: Mobile Table Strategy

**Choice**: Use responsive CSS (`md:table`, `block md:hidden`) to render data as cards on mobile/tablet and as a full table on desktop. Ensure containers use `min-w-0` and `truncate`.
**Alternatives considered**: Wrapping the HTML table in an `overflow-x-auto` container.
**Rationale**: The `entrenar-frontend-architecture` skill explicitly forbids relying on horizontal scrolling for admin tables on mobile/tablet.

### Decision: Form Architecture

**Choice**: Use `FormProvider` from React Hook Form to wrap the parent creation/edition page, and break down sections (e.g., "Discount Type", "Usage Limits") into separate child components that use `useFormContext`.
**Alternatives considered**: A monolithic form component passing `control` and `register` props to a dozen children.
**Rationale**: Using `FormProvider` avoids prop drilling, keeps individual section files small (<200 lines), and makes conditional field rendering (like hiding limits for free shipping) easier to isolate.

## Data Flow

```text
User ──(interacts)──→ Admin Forms (RHF + Zod)
                           │ (validates)
                           ▼
                 Zustand (admin-discounts-store)
                 (in-memory state, generates ID, updates history)
                           │
                           ▼
User ◄──(navigates)── List Views / Detail Views
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/data/admin/navigation.ts` | Modify | Convert `Descuentos` to accordion with `Cupones` and `Envío gratis`. |
| `src/components/admin/layout/admin-nav-matching.ts` | Modify | Update matching logic for the new accordion subroutes. |
| `src/app/(admin)/admin/descuentos/page.tsx` | Create | Redirect to `/admin/descuentos/cupones`. |
| `src/app/(admin)/admin/descuentos/cupones/page.tsx` | Create | Coupons list and empty state. |
| `src/app/(admin)/admin/descuentos/cupones/[...slug]/page.tsx` | Create | Catch-all for `nuevo` and `[id]` coupon form. |
| `src/app/(admin)/admin/descuentos/envio-gratis/page.tsx` | Create | Free shipping list and empty state. |
| `src/app/(admin)/admin/descuentos/envio-gratis/[...slug]/page.tsx` | Create | Catch-all for `nuevo` and `[id]` free shipping form. |
| `src/stores/admin-discounts-store.ts` | Create | Zustand state for both coupons and shipping discounts. |
| `src/schemas/admin/discount-schemas.ts` | Create | Zod schemas for both forms. |
| `src/components/admin/discounts/CouponForm.tsx` | Create | Parent RHF provider for coupons. |
| `src/components/admin/discounts/ShippingDiscountForm.tsx` | Create | Parent RHF provider for free shipping. |
| `src/components/admin/discounts/SelectionDrawer.tsx` | Create | Generic drawer for multi-select (products, categories, etc.). |
| `src/lib/data/admin/shipping/provinces.ts` | Create | Mock data for Argentine provinces (shipping zones). |

## Interfaces / Contracts

```typescript
// Zustand Store Contract
interface AdminDiscountsStore {
  coupons: Coupon[];
  shippingDiscounts: ShippingDiscount[];
  
  createCoupon: (data: z.infer<typeof couponSchema>) => Coupon;
  updateCoupon: (id: string, data: z.infer<typeof couponSchema>) => void;
  deleteCoupon: (id: string) => void;
  toggleCouponStatus: (id: string) => void;

  createShippingDiscount: (data: z.infer<typeof shippingDiscountSchema>) => ShippingDiscount;
  updateShippingDiscount: (id: string, data: z.infer<typeof shippingDiscountSchema>) => void;
  deleteShippingDiscount: (id: string) => void;
  toggleShippingDiscountStatus: (id: string) => void;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Zod schemas | No automated tests (per project config). Manual testing via UI. |
| Integration | Forms & Store | Manual testing of creation, validation (e.g. duplicate codes), and editing flows. |
| E2E | Navigation & Responsive | Manual verification of sidebar active states, and mobile layout without horizontal scrolling. |

## Migration / Rollout

No migration required. The state is purely mock and in-memory.

## Open Questions

- None.
