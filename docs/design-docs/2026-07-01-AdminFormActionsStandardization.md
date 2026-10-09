# Design: AdminFormActionsStandardization

## Technical Approach

The standardization relies on two foundational primitives: a compositional `FormActions` layout component and a `useUnsavedChangesGuard` hook. 
`FormActions` will enforce EntrenAR's UI and responsive constraints (bottom of scroll flow, mobile `flex-col-reverse` full width, desktop right alignment), ensuring consistency without prop-explosion.
`useUnsavedChangesGuard` will handle both uncontrolled browser exits (via native `beforeunload`) and controlled React navigation (via an `intercept` wrapper that renders a `DiscardChangesModal`), using React Hook Form's `isDirty` state as the primary trigger. 

## Architecture Decisions

### Decision: FormActions as Compositional Primitives

**Choice**: Create a `FormActions` container component rather than a monolithic `<FormActionsToolbar>`.
**Alternatives considered**: A monolithic toolbar with `submitLabel`, `cancelLabel`, `onCancel` props.
**Rationale**: Adheres to EntrenAR's `entrenar-frontend-architecture` rules favoring composition. It accommodates forms needing additional actions (e.g., "Save & Activate" or "Duplicate") without a complex API surface.

### Decision: Dirty State Navigation Interception

**Choice**: Combine native `beforeunload` with explicit controlled-exit interception (wrapping `AdminPageHeader.backLink`, Cancel buttons, and internal `LinkButton`s).
**Alternatives considered**: Overriding Next.js `router.push`/`replace` globally, or relying solely on `beforeunload`.
**Rationale**: Next.js App Router lacks a stable `beforePopState`. Global router overrides are risky (explicitly out of scope). Wrapping controlled exits covers the most common data-loss vectors safely.

### Decision: Manual-State Forms Migration Strategy

**Choice**: Postpone full migration of manual-state forms (Recovery Email, Gateway modals, sale drawers) to the final chained PR, adapting them with a local `isDirty` state flag.
**Alternatives considered**: Force-migrating them to React Hook Form now.
**Rationale**: Migrating complex legacy manual-state forms to RHF would exceed the 1000-line review budget and broaden risk. Adding a boolean flag for the dirty guard is a safer interim step.

## Data Flow

    [RHF Form (isDirty, isSubmitting)] ──┐
          │                              │ (passes state)
          │                              ▼
          │                  [useUnsavedChangesGuard]
          │                              │
          ▼                              ▼
    [FormActions]                 [User triggers exit]
      └─ Submit (loading)          ├─ External/Reload ─→ Browser Native Alert
      └─ Cancel (intercepted) ─────┴─ Internal Link ───→ DiscardChangesModal
                                                             └─ Confirm ─→ Navigate

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/admin/form-actions/FormActions.tsx` | Create | Composable layout container (`flex flex-col-reverse sm:flex-row`). |
| `src/hooks/use-unsaved-changes-guard.ts` | Create | Hook to register `beforeunload` and provide `intercept(href/callback)`. |
| `src/components/admin/modals/DiscardChangesModal.tsx` | Create | Shared primitive modal for the interceptor. |
| `src/components/admin/discounts/CouponForm.tsx` | Modify | Use `FormActions`, integrate dirty guard. |
| `src/components/admin/products-flow/ProductCreateFormPage.tsx` | Modify | Remove header actions, use `FormActions`, integrate dirty guard. |
| `src/components/admin/sales-flow/OrderFormPage.tsx` | Modify | Remove header actions, standardize bottom actions, migrate to new guard. |
| `src/components/admin/layout/AdminPageHeader.tsx` | Modify | Update `backLink` to support interception (optional callback instead of raw href). |

*(Note: Other form files listed in the proposal will follow the same modification pattern).*

## Interfaces / Contracts

```tsx
// src/components/admin/form-actions/FormActions.tsx
import { ReactNode } from "react";

export function FormActions({ children }: { children: ReactNode }) {
  // Mobile: reverse column so primary action is at the bottom. Desktop: right-aligned row.
  return (
    <div className="flex flex-col-reverse gap-3 pt-6 sm:flex-row sm:justify-end">
      {children}
    </div>
  );
}

// src/hooks/use-unsaved-changes-guard.ts
import { ReactNode } from "react";

export interface UseUnsavedChangesGuardProps {
  isDirty: boolean;
  onConfirmDiscard?: () => void; // Optional hook-level override
}

export interface UnsavedChangesGuard {
  interceptNavigation: (hrefOrCallback: string | (() => void)) => void;
  DiscardModal: ReactNode; // Render this in the parent component
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `useUnsavedChangesGuard` | (Skipped currently; rely on smoke testing as per init state). |
| Integration | RHF to Guard connection | Manual smoke test: modify a field, click Cancel, verify modal opens. |
| E2E | Interception coverage | Manual smoke test: verify header back links and browser reloads trigger guards. |

## Migration / Rollout

Due to the risk of exceeding the 1000-line budget, the implementation must be rolled out in Chained PRs:
1. **PR 1**: Create `FormActions`, `useUnsavedChangesGuard`, `DiscardChangesModal`, and update `AdminPageHeader`.
2. **PR 2**: Migrate core RHF forms (Coupons, Shipping Discounts, Products, Categories, Customers, Orders).
3. **PR 3**: Migrate remaining RHF configs (Providers, Pickups) and adapt manual-state forms (Recovery Email, etc.).

A pause is required after the `sdd-apply` phase (and before `sdd-verify` completion) for manual smoke testing, as test runners are not configured (`strict_tdd: false`).

## Open Questions

- [ ] Will manual-state forms eventually be migrated to RHF, or should we permanently support a manual `isDirty` toggle? (Assuming interim support for now).
