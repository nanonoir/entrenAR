# Design: Sales Flow Manual Fixes

## Technical Approach

Implement 11 targeted fixes across the admin UI and validation schemas. We will update navigation configuration to fix accordion behaviors, adjust layout components for mobile-responsive lists (cards vs. tables), introduce bulk actions with selection tracking, and harden the checkout form with strict Zod preprocessing and input sanitization.

## Architecture Decisions

### Decision: Active State Matching
**Choice**: Explicit string match (`pathname === route`) for exact routes like `/admin/ventas`, and prefix match (`pathname.startsWith(route)`) for others, or specific exclusion rules.
**Alternatives considered**: Regex matching.
**Rationale**: Simpler and covers the specific bug where `/admin/ventas/ordenes` matched `/admin/ventas`.

### Decision: Mobile List Layouts
**Choice**: Use Tailwind `hidden md:table` for the desktop table and `grid md:hidden` for mobile cards.
**Alternatives considered**: Two separate React components rendered conditionally.
**Rationale**: CSS media queries prevent hydration mismatches and keep the DOM unified.

### Decision: Input Sanitization
**Choice**: Use React Hook Form's `onChange` to replace invalid characters (e.g., `e.target.value.replace(/\D/g, '')`) before calling the original `onChange`.
**Alternatives considered**: Zod `transform()`.
**Rationale**: Modifying the input dynamically prevents the user from typing invalid characters, giving better UX than just failing validation or silently stripping on submit.

### Decision: iOS Zoom Fix
**Choice**: Use `text-base md:text-sm` on text inputs.
**Alternatives considered**: Viewport meta tag `maximum-scale=1`.
**Rationale**: Accessibility guidelines recommend allowing user zoom; preventing it globally is bad practice. Setting the font size to 16px (`text-base`) naturally prevents iOS from auto-zooming.

## Data Flow

    [Form Input] ──(Sanitization via onChange)──→ [React Hook Form] ──(Preprocess empty strings)──→ [Zod Schema] ──→ [Zustand Store]

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/data/admin/navigation.ts` | Modify | Redefine `Estadísticas` as accordion, rename "Visión general". |
| `src/components/admin/layout/Sidebar.tsx` | Modify | Remove `<p>` titles, fix exact matching for active states. |
| `src/components/admin/layout/MobileDrawer.tsx` | Modify | Remove `<p>` titles, fix exact matching, render accordions. |
| `src/app/(admin)/admin/ventas/page.tsx` | Modify | Track row selections, add responsive mobile cards, add Archive bulk action and Download icon. |
| `src/app/(admin)/admin/ventas/ordenes/page.tsx` | Modify | Add mobile cards, product count column, compact icon actions, `Plus` icon for new order. |
| `src/app/(admin)/admin/ventas/ordenes/[id]/page.tsx` | Modify | Add a dictionary for translating `SaleHistoryEvent` keys to Spanish. |
| `src/components/admin/sales-flow/OrderFormPage.tsx` | Modify | Remove default payment, apply `text-base md:text-sm`, add sanitization, wrap shipping in Accordion. |
| `src/components/admin/sales-flow/OrderFormSchema.ts` | Modify | Preprocess `discountType` (empty string to undefined), enforce conditional validation based on expanded shipping. |

## Interfaces / Contracts

```typescript
// Zod Preprocessor Example for discountType
discountType: z.preprocess((val) => (val === "" ? undefined : val), z.enum(["fixed", "percentage"]).optional())

// History Translation Dictionary
const EVENT_TRANSLATIONS: Record<string, string> = {
  "sale_created": "Venta creada",
  "package_packed": "Paquete empaquetado",
  "package_shipped": "Paquete enviado",
  "payment_received": "Pago recibido",
  "email_sent": "E-mail enviado",
  "email_failed": "Error al enviar e-mail"
};
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Zod Schema | Verify `discountType: ""` validates successfully as `undefined`. |
| Unit | Sanitization | Verify typing digits into name or letters into DNI strips them properly. |
| Integration | Mobile Cards | Verify classes `hidden md:table` and `grid md:hidden` toggle properly in browser tests. |
| Integration | Navigation | Verify `/admin/ventas/ordenes` does not trigger active state for `/admin/ventas`. |

## Migration / Rollout

No migration required. These are UI/UX and validation fixes entirely on the frontend/admin interface.

## Open Questions

- None
