# Design: CRM Payment Methods (`feat/crm-payment-methods`)

## Technical Approach

Implement the `/admin/medios-de-pago` route as a pure client-side management interface for payment providers. We will use an in-memory Zustand store (`admin-payment-methods-store`) to handle provider state (active/inactive and configuration) to satisfy the MVP requirement of no backend persistence. The UI will feature a filterable list of provider cards with inline actions that open configuration modals. Bank transfer configuration will be handled via React Hook Form and Zod for robust validation. To satisfy the requirement of reusing the existing CRM toast system without coupling to sales logic, we will extract the toast functionality into a shared `admin-toast-store`.

## Architecture Decisions

### Decision: Toast System Extraction

**Choice**: Extract toast logic from `admin-sales-store` into a new `admin-toast-store`.
**Alternatives considered**: Duplicate toast logic in the new feature; import `admin-sales-store` into payment methods just to trigger toasts.
**Rationale**: Duplication creates a parallel system (violating PRD). Importing the sales store creates a tangled domain dependency. A shared toast store is the cleanest architectural path and scales well for future admin features.

### Decision: State Location for Filtering and Modals

**Choice**: Filter state (Active/Inactive/All) and transient modal state (selected payment option, open modal ID) will live in the local React component state, not the Zustand store.
**Alternatives considered**: Put filter state and modal selection state in the Zustand store (as initially suggested by PRD exploration).
**Rationale**: Zustand should hold the "source of truth" business data (provider configurations). UI view state like which tab is active or which option is currently checked *before* confirming the modal should remain local to prevent store bloat and unnecessary global re-renders.

### Decision: Form Validation Strategy

**Choice**: Use React Hook Form + Zod for Bank Transfer; manual state for simple radio selection in gateway modals.
**Alternatives considered**: Use RHF+Zod for all modals; use manual state for all modals.
**Rationale**: Bank Transfer involves 5 fields with complex validation (22-digit CBU striping spaces, CUIT format), which requires the robust hygiene of `build-form` (RHF+Zod). Gateway modals (Mercado Pago, Stripe, Payway) are just a single required radio selection; manual state is lighter and sufficient.

## Data Flow

    [Page UI: Filters & Cards] ◄──(Reads state)──┐
                 │                               │
                 ▼                               │
      [Modals: Form / Radios]                    │
                 │                               │
                 ▼                               │
        (Dispatches Action)                      │
                 │                               │
                 ▼                               │
    [admin-payment-methods-store] ───────────────┘
                 │
                 ▼
        (Triggers Notification)
                 │
                 ▼
        [admin-toast-store] ───► [AdminToastContainer]

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/stores/admin-toast-store.ts` | Create | Shared in-memory store for CRM toast notifications. |
| `src/stores/admin-sales-store.ts` | Modify | Remove toast state/actions; update to use `admin-toast-store` where needed. |
| `src/components/admin/sales-flow/AdminToastContainer.tsx` | Modify | Refactor to consume `useAdminToastStore` instead of `useAdminSalesStore`. |
| `src/lib/data/admin/payment-methods/index.ts` | Create | Static definitions (logos, accepted methods, static gateway options, initial states). |
| `src/stores/admin-payment-methods-store.ts` | Create | Zustand store mimicking a backend interface (`activateProvider`, `deactivateProvider`, `updateProviderConfig`). |
| `src/schemas/admin/payment-method-schemas.ts` | Create | Zod schema for Bank Transfer configuration. |
| `src/app/(admin)/admin/medios-de-pago/page.tsx` | Modify | Replace `<ComingSoonPage>` with the filter tabs, empty state warning, and provider card list. |
| `src/components/admin/payment-methods/ProviderCard.tsx` | Create | Responsive card displaying provider info, fixed options table, and actions. |
| `src/components/admin/payment-methods/BankTransferModal.tsx` | Create | RHF + Zod form modal for CBU, Alias, CUIT, Holder, Bank. |
| `src/components/admin/payment-methods/GatewayModal.tsx` | Create | Radio selection modal for Mercado Pago, Stripe, and Payway options. |
| `src/components/admin/payment-methods/DeactivateModal.tsx` | Create | Confirmation modal to deactivate a provider. |

## Interfaces / Contracts

```typescript
export type PaymentProviderId = 'bank-transfer' | 'mercado-pago' | 'stripe' | 'payway';
export type PaymentStatus = 'active' | 'inactive';

// DTO representing the configured state of a provider
export interface PaymentProviderConfig {
  id: PaymentProviderId;
  status: PaymentStatus;
  // Dynamic config based on provider type
  bankConfig?: {
    cbuCvu: string;
    alias: string;
    holderName: string;
    cuitCuil: string;
    bankName: string;
  };
  selectedOptionId?: string;
}

export interface AdminPaymentMethodsState {
  providers: Record<PaymentProviderId, PaymentProviderConfig>;
  activateProvider: (id: PaymentProviderId, config: Partial<PaymentProviderConfig>) => void;
  updateProviderConfig: (id: PaymentProviderId, config: Partial<PaymentProviderConfig>) => void;
  deactivateProvider: (id: PaymentProviderId) => void;
}
```

*Note: Static UI details like `logo` or `acceptedMethods` will live in `src/lib/data/` and be merged with this state at render time, preventing duplicated static data in the store.*

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit/Type | Schema Validation | Ensure Zod schema enforces 22-digit CBU (after removing spaces/hyphens) and CUIT `XX-YYYYYYYYY-Z` format. |
| E2E (MCP) | Toast System Migration | Verify existing sales flows still show success/error toasts correctly. |
| E2E (MCP) | Form Validation | Verify Bank Transfer form blocks submission on invalid fields and normalizes inputs correctly. |
| E2E (MCP) | Responsive Layout | Verify ProviderCard columns (`Ventas en`, `Recibí en`, `Comisión`) do not cause horizontal scrolling on mobile breakpoints (`min-w-0 truncate`). |

## Migration / Rollout

No database migration required as the state is strictly in-memory (`zustand` without `persist`) for the MVP. Existing sales toast logic will seamlessly switch to the new shared store.

## Open Questions

- None. (The CBU sanitization and transient state location issues identified during exploration have been resolved in this design).