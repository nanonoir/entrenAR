# Design: Sales Flow Archives & Abandoned Carts

## Technical Approach

We will extend the existing administrative sales flow by adding two new branches: Archived Sales (`/admin/ventas/archivados`) and Abandoned Carts (`/admin/ventas/carritos`). To ensure maintainability, we will reuse the existing sales list and detail UI components by introducing `readOnly` and `isArchived` flags. State for abandoned carts, recovery settings, and email templates will be managed entirely in local mock stores (Zustand) to align with the MVP scope.

## Architecture Decisions

### Decision: Reuse vs. Rebuild Sales UI for Archives

**Choice**: Refactor existing `SaleList` and `SaleDetail` components to accept a `readOnly` prop.
**Alternatives considered**: Duplicate components specifically for the archives view.
**Rationale**: Duplicating components would lead to UI drift. By passing flags, we ensure design consistency while safely disabling actions (like "Más opciones" or status updates) for historical data.

### Decision: State Management for Abandoned Carts

**Choice**: Create a new dedicated Zustand store `useAbandonedCartsStore`.
**Alternatives considered**: Extend the existing `useAdminSalesStore`.
**Rationale**: Abandoned carts have distinct workflows (email recovery timing, template editing) compared to active sales. Keeping them in a separate store prevents bloating the active sales state.

### Decision: Email Editor Implementation

**Choice**: Build a custom local tabbed interface (HTML, Plain Text, Preview) using standard React state and existing UI primitives.
**Alternatives considered**: Integrate a heavy WYSIWYG library.
**Rationale**: For the mock MVP phase, standard textareas for HTML/Plain text and a rendered `dangerouslySetInnerHTML` div for Preview are sufficient and keep the bundle light.

## Data Flow

    [Admin UI] ──(reads/writes)──→ [useAbandonedCartsStore]
         │                                │
         │                                ├── configures timing
         │                                └── updates email template
         │
    [Admin UI] ──(reads)──→ [Mock Data (lib/data/admin/*)]
         │
         ├──→ Displays Archived Sales (read-only)
         └──→ Displays Abandoned Carts List

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/(admin)/admin/ventas/archivados/page.tsx` | Create | New route for archived sales list |
| `src/app/(admin)/admin/ventas/carritos/page.tsx` | Create | New route for abandoned carts list & config modal |
| `src/app/(admin)/admin/ventas/carritos/email/page.tsx` | Create | Email template editor interface |
| `src/lib/data/admin/navigation.ts` | Modify | Add `Carritos Abandonados` and `Archivados` to `Ventas` nav |
| `src/stores/admin/useAbandonedCartsStore.ts` | Create | Zustand store for cart recovery config and email state |
| `src/lib/data/admin/mock-carts.ts` | Create | Mock data for abandoned carts |
| `src/components/admin/sales/SaleList.tsx` | Modify | Add `isArchived` support to disable inline actions |
| `src/components/admin/sales/SaleDetail.tsx` | Modify | Add `readOnly` support to hide edit controls |

## Interfaces / Contracts

```typescript
// src/stores/admin/useAbandonedCartsStore.ts
export interface RecoveryConfig {
  timing: '6hs' | '24hs' | '3_days' | '7_days' | '14_days' | 'manual';
  isActive: boolean;
}

export interface EmailTemplate {
  subject: string;
  htmlBody: string;
  plainTextBody: string;
}

export interface AbandonedCartsState {
  config: RecoveryConfig;
  template: EmailTemplate;
  updateConfig: (config: Partial<RecoveryConfig>) => void;
  updateTemplate: (template: Partial<EmailTemplate>) => void;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Zustand Store | Verify `updateConfig` and `updateTemplate` mutate state correctly |
| Integration | Archived Sales UI | Render `SaleDetail` with `readOnly={true}` and assert edit buttons are hidden |
| E2E | Carts Flow | Navigate `/admin/ventas/carritos`, open config modal, save timing, and verify persistence in UI |

## Migration / Rollout

No migration required. All additions operate on 100% mock data for the current MVP phase.

## Open Questions

- None
