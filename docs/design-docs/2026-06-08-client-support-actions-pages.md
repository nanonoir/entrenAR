# Design: Client Support Actions Pages

## Technical Approach
Implement client-facing support action pages (`/gestion-de-pedidos`, `/boton-de-arrepentimiento`, `/cambios-y-devoluciones`) using Server Component page shells and Client Component interactive islands. We will extract shared support and form components into `src/components/shop/support`, adapt the existing checkout validation, and isolate auth-dependent UI to mitigate hydration mismatches. The footer will be updated to point to the canonical routes, and the old route will be removed.

## Architecture Decisions

### Decision: Tracking Auth CTA Hydration Pattern
**Choice**: Render a disabled button with fixed dimensions and no text during hydration, replacing it with the proper `guest` or `authenticated` CTA once hydrated.
**Alternatives considered**: Server-side rendering the CTA (rejected because auth state is client-only in Zustand) or not showing anything until hydration (rejected due to layout shift).
**Rationale**: Avoids React hydration mismatch errors while maintaining layout stability on the page without blocking the rest of the Server Component.

### Decision: Support Form Abstraction
**Choice**: Abstract shared support fields (fullName, email, phone, orderNumber, message) into a `SupportActionForm` component, leaving specific checkboxes or varied submit logic to the consuming page/island.
**Alternatives considered**: Duplicate the form in each page (rejected due to repetition of identical fields and validation logic).
**Rationale**: Keeps validation and presentation consistent across the two form pages while allowing flexibility.

### Decision: Order Tracking Result Display
**Choice**: Reuse the existing `ShipTrackingCard` component directly.
**Alternatives considered**: Build a completely new tracking summary UI (rejected to save time and keep visual consistency).
**Rationale**: `ShipTrackingCard` takes an `AccountOrder` object. We can reuse it directly by rendering it below the form upon a successful tracking lookup of the mock `accountOrders` data.

## Data Flow
```
User -> Support Page (Server Component shell)
         │
         ├── Form (Client Component) 
         │    ├── Validates input (checkout-validation.ts)
         │    └── (Gestion de pedidos) -> Looks up `accountOrders`
         │
         └── Success/Error Modal (Client Component)
              └── Opens via internal state
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/(shop)/gestion-de-pedidos/page.tsx` | Create | Tracking form and result page |
| `src/app/(shop)/boton-de-arrepentimiento/page.tsx` | Create | Repentance form page |
| `src/app/(shop)/cambios-y-devoluciones/page.tsx` | Create | Returns form page |
| `src/app/(shop)/ayuda/cambios-devoluciones/page.tsx` | Delete | Deprecated route (now 404) |
| `src/components/shop/support/SupportActionForm.tsx` | Create | Shared form fields and validation logic |
| `src/components/shop/support/TrackingAuthCTA.tsx` | Create | Client island for the auth CTA to avoid hydration mismatch |
| `src/components/ui/Textarea.tsx` | Create | Shared UI primitive for multiline input |
| `src/components/ui/Checkbox.tsx` | Create | Shared UI primitive for boolean input |
| `src/lib/data/footer.ts` | Modify | Update help actions to point to new routes |

## Interfaces / Contracts

```typescript
// SupportActionForm payload structure
export interface SupportPayload {
  fullName: string;
  email: string;
  phone: string;
  orderNumber: string;
  message: string;
  hasReceivedOrder?: boolean;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Validation Functions | Ensure regex/validation works for phone, order number |
| Unit | Tracking Auth CTA | Verify hydration states (disabled -> guest/auth) |
| E2E | Order Tracking Flow | Manual: Valid code shows card, invalid code shows modal |
| E2E | Support Forms | Manual: Invalid inputs block submission, valid inputs show success modal |

*Note: Since no test runner is configured, "Approach" is currently manual validation.*

## Migration / Rollout
No migration required. The old `/ayuda/cambios-devoluciones` route is removed and should inherently 404.

## Open Questions
- None.
