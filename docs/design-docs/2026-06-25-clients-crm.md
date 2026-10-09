# Design: Clients CRM

## Technical Approach

We will build a standalone `customers` domain within the admin layer. It will use its own Zustand store (`admin-customers-store`) for state management of customers, but will rely on the existing `admin-sales-store` for all sales-related data to avoid duplicating the operational source of truth. We will introduce a `customerId` field to the existing `AdminSale` models to establish a deterministic linkage.

Anonymization will be orchestrated by the `admin-customers-store`, which will update its own state and then dispatch a cross-store update to `admin-sales-store` to anonymize the snapshots on linked sales.

Forms will use React Hook Form + Zod, with `.superRefine` for conditional address validation. CSV generation will use raw JS with UTF-8 BOM headers.

## Architecture Decisions

### Decision: Sales Linkage Strategy

**Choice**: Add `customerId` to `AdminSale` and derive history from `admin-sales-store`.
**Alternatives considered**: Derive by e-mail matching; Duplicate sales into a `CustomerOrderSummary` array inside the customer object.
**Rationale**: E-mail matching is fragile (e-mails can change). Duplicating data violates the rule of not creating a parallel operational source. Adding `customerId` cleanly links the two bounded contexts.

### Decision: Anonymization Orchestration

**Choice**: The customer store exposes `anonymizeCustomer(id)`, which sets `isAnonymized: true` and clears personal fields. It then imperatively calls `useAdminSalesStore.getState().anonymizeCustomerSales(id)`.
**Alternatives considered**: An event emitter; having the sales store subscribe to customer store changes.
**Rationale**: Zustand doesn't have native event emitters across stores. Direct imperative calls across slice boundaries in the mutation function are predictable, easy to trace, and fit the current architecture.

### Decision: Form Address Validation

**Choice**: Zod schema with `.superRefine` checking if any address field is present, then enforcing the required address fields.
**Alternatives considered**: Two separate schemas; nested object with `.optional()` vs `.required()`.
**Rationale**: Zod `.superRefine` provides the cleanest "all or nothing" validation at the object root level without overly complex nesting that conflicts with flat RHF field registration.

### Decision: CSV Generation

**Choice**: Raw string building with `\ufeff` (UTF-8 BOM) prefix and `;` separators.
**Alternatives considered**: External libraries like `papaparse` or `csv-writer`.
**Rationale**: The MVP data shape is simple enough that we don't need heavy dependencies, and we specifically need exact control over BOM and `;` for Excel compatibility in Argentina.

## Data Flow

```text
[ Client UI ]
     │ (Zustand Actions)
     ▼
[ Admin Customers Store ] ──(read/write customer)──> In-Memory State
     │ (Cross-store action)
     ▼
[ Admin Sales Store ] ──(anonymize sales snapshots)──> In-Memory Sales State
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/(admin)/admin/clientes/page.tsx` | Modify | Implement customer list and filters. |
| `src/app/(admin)/admin/clientes/nuevo/page.tsx` | Create | Form screen to create customers. |
| `src/app/(admin)/admin/clientes/[clienteId]/page.tsx` | Create | Detail screen for a customer. |
| `src/app/(admin)/admin/clientes/[clienteId]/editar/page.tsx` | Create | Form screen to edit customers. |
| `src/components/admin/customers/*` | Create | List, cards, email modal, forms. |
| `src/lib/data/admin/customers/types.ts` | Create | Domain models (`Customer`, etc.). |
| `src/lib/data/admin/customers/mock-customers.ts` | Create | Seed data. |
| `src/lib/data/admin/customers/csv.ts` | Create | CSV generation utilities. |
| `src/lib/data/admin/sales-flow/types.ts` | Modify | Add `customerId` to `AdminSale`. |
| `src/lib/data/admin/sales-flow/sales.ts` | Modify | Update mock sales with `customerId`s. |
| `src/stores/admin-customers-store.ts` | Create | Zustand store for customer CRM. |
| `src/stores/admin-sales-store.ts` | Modify | Add `anonymizeCustomerSales` action. |

## Interfaces / Contracts

```typescript
// src/lib/data/admin/customers/types.ts
export type Customer = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  dniOrCuil?: string;
  firstInteractionDate: string;
  address?: CustomerAddress;
  notes?: string;
  isAnonymized: boolean; // Controls UI redaction
  createdAt: string;
  updatedAt: string;
}

// In src/lib/data/admin/sales-flow/types.ts
export type AdminSale = {
  // ... existing fields
  customerId?: string; // Links sales to customers deterministically
  // ...
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit/Zod | Form Validation | Test conditional address validation logic. |
| E2E | Anonymization | Playwright flow: view sale -> anonymize customer -> verify sale anonymized. |
| E2E | Deterministic Bounce | Playwright flow: submit bounce mock email -> verify error toast. |

## Migration / Rollout

No migration required for the mock database. Existing mock sales will be updated with static `customerId` values manually in `src/lib/data/admin/sales-flow/sales.ts`.

## Open Questions

- None. The deterministic bounce email will use a specific target string like "bounce@mock.com".
