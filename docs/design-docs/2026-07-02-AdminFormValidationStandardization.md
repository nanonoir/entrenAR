# Design: AdminFormValidationStandardization

## Technical Approach

We will create a centralized validation library in `src/schemas/admin/shared.ts` to standardize Zod primitives (prices, percentages, stock, codes) without using `z.coerce`, ensuring consistent Spanish error messages and type safety. We will implement a hybrid scroll-to-error utility in `src/components/admin/utils/scroll-to-error.ts` that relies on dynamic DOM queries (`[aria-invalid="true"]`) with static section fallbacks. Finally, we will refactor complex manual forms to RHF+Zod and enforce a11y bindings (`aria-invalid`, `aria-describedby`) and iOS zoom prevention (`text-base md:text-sm`) across all admin inputs.

## Architecture Decisions

### Decision: Numeric Parsing Strategy

**Choice**: Use `z.preprocess()` to normalize empty strings to `undefined` followed by strict `z.number()`, or `.transform()` with `Number()` only after strict regex validations. Do not use `z.coerce.number()`.
**Alternatives considered**: Using `z.coerce.number()`.
**Rationale**: `z.coerce` turns empty strings into `0`, confusing "user did not input" with "user inputted zero". Explicit preprocess allows us to accurately enforce optional vs required rules and prevents `NaN` leaks.

### Decision: Scroll-to-Error API

**Choice**: A hybrid utility `scrollToFirstError(errors, prioritySections?)` that finds the first DOM element with `aria-invalid="true"` or matches a `data-error-section="id"` fallback for hidden fields (like drawers).
**Alternatives considered**: Strict static section-ID mapping (current implementation).
**Rationale**: Static mapping scales poorly and misses hidden fields like field arrays or drawers. A dynamic DOM query handles 80% of cases automatically, while `prioritySections` provides manual overrides for complex UI structures.

### Decision: RHF Generic Typing

**Choice**: Enforce explicit generics `useForm<z.input<typeof schema>, unknown, z.infer<typeof schema>>` for any form where Zod schema transforms input.
**Alternatives considered**: Relying on default `useForm<z.infer<typeof schema>>`.
**Rationale**: Default generics cause silent TypeScript errors when Zod inputs (e.g. strings for `stockQuantity`) differ from the transformed output (numbers). Explicit typing guarantees end-to-end safety.

### Decision: Form Migration Scope (800-line budget)

**Choice**: Migrate `InlineStockCell`, `CustomerEmailModal`, and `RecoveryConfigModal` to RHF+Zod. Stage/defer `CustomerNotesModal`, `GatewayModal`, and `ProductCategoryList` as manual forms but with improved a11y and text-classes.
**Alternatives considered**: Migrate all forms.
**Rationale**: Migrating everything exceeds the 800-line budget and introduces regression risk in non-critical paths. Prioritizing forms with business-critical numeric/state data yields the highest ROI.

## Data Flow

    [ User Input ] ──→ [ onChange (RHF) ] ──→ [ Zod Preprocess / Normalizer ]
                                                   │
                                     (If invalid)  │  (If valid)
                                                   ▼
                                        [ aria-invalid="true" ]
                                        [ scrollToFirstError() ]

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/schemas/admin/shared.ts` | Create | Zod primitives for price, percentage, stock, and coupon codes. |
| `src/components/admin/utils/scroll-to-error.ts` | Create | Shared `scrollToFirstError` utility function. |
| `src/schemas/admin/order-schema.ts` | Create | Relocated from `sales-flow/OrderFormSchema.ts`. |
| `src/components/admin/**/*.tsx` | Modify | Add `aria-invalid`, `aria-describedby`, `text-base md:text-sm`. |
| `src/components/admin/products-flow/inventory/InlineStockCell.tsx` | Modify | Migrate to RHF+Zod. |
| `src/components/admin/customers/CustomerEmailModal.tsx` | Modify | Migrate to RHF+Zod. |
| `src/components/admin/sales-flow/RecoveryConfigModal.tsx` | Modify | Migrate to RHF+Zod. |
| `src/components/admin/stats/PeriodFilter.tsx` | Modify | Fix iOS zoom (add `text-base`). |

## Interfaces / Contracts

```typescript
// src/schemas/admin/shared.ts
export const emptyStringToUndefined = (val: unknown) => (val === "" ? undefined : val);

export const adminPrimitives = {
  price: z.preprocess(emptyStringToUndefined, z.number({ required_error: "El precio es requerido" }).min(0, "Debe ser mayor o igual a 0")),
  percentage: z.preprocess(emptyStringToUndefined, z.number().min(0).max(100)),
  stock: z.preprocess(emptyStringToUndefined, z.number().int("Debe ser un entero").min(0)),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]+$/, "Formato inválido"),
};

// src/components/admin/utils/scroll-to-error.ts
export function scrollToFirstError(
  errors: FieldErrors,
  prioritySections?: string[]
): void {
  // 1. Try priority sections (e.g., hidden drawers)
  // 2. Fallback to document.querySelector('[aria-invalid="true"]')
  // 3. element.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Zod primitives | Verify `NaN`, empty string, and `0` behavior in `shared.ts`. |
| E2E / Smoke | Form submission | Manual smoke test: leave required numeric fields blank, verify Spanish errors and auto-scroll. |
| E2E / Smoke | iOS Zoom | Inspect inputs in mobile view to ensure `text-base md:text-sm` is present. |

## Migration / Rollout

No database migration required. Rollout will be split into two review slices:
- **Slice A (PR 1)**: `shared.ts`, schema relocation, iOS/a11y bindings (`aria-invalid`), and `scroll-to-error.ts` implementation.
- **Slice B (PR 2)**: RHF+Zod migrations for `InlineStockCell`, `CustomerEmailModal`, and `RecoveryConfigModal`.

## Open Questions

- [ ] Does `scrollToFirstError` need to automatically open collapsed accordions, or will `prioritySections` handle that via state lifting?
