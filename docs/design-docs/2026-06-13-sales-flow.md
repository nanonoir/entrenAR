# Design: Admin Sales Flow

## Technical Approach

Implement a complete mock-based admin sales flow following the "frontend expresses intent, backend validates" target architecture, but fully simulated in-memory for the MVP. We will build a unified RHF+Zod form architecture, an in-memory Zustand store for optimistic mutations, and adapt the static product catalog to mock line items.

## Architecture Decisions

### Decision: Mock State Management

**Choice**: Use an isolated `useAdminSalesStore` with Zustand (no persistence).
**Alternatives considered**: React Context, URL State, persisting to localStorage.
**Rationale**: Keeps the mock logic out of production localStorage limits. When the real backend is added, this store will either be replaced entirely by Server Actions/SWR/React Query or act strictly as an optimistic cache.

### Decision: Form Architecture

**Choice**: `react-hook-form` + `@hookform/resolvers/zod` + `zod`.
**Alternatives considered**: Custom state validation, plain forms.
**Rationale**: Production-ready standard. Provides clean field-level validation, easy decimal parsing, and dirty-form tracking. Need to run `npm install react-hook-form zod @hookform/resolvers`.

### Decision: Data Model Separation

**Choice**: Restructure mock data into `src/lib/data/admin/statistics/` and `src/lib/data/admin/sales-flow/`. Create distinct `AdminSale` and `AdminPurchaseOrder` types.
**Alternatives considered**: Reusing the customer-facing `accountOrders` DTO.
**Rationale**: Admin views require more granular state (e.g., transition history, previous states on cancel) that the public DTO doesn't support. Separation prevents leaking admin fields to the client payload.

### Decision: Navigation Changes

**Choice**: Implement a grouped accordion in `Sidebar.tsx` and `MobileDrawer.tsx` based on `navigation.ts`.
**Alternatives considered**: Flat lists, multi-level flyouts.
**Rationale**: Meets the spec for groups with 2+ children. Maintains a clean visual hierarchy.

## Data Flow

    User UI ──→ RHF Form (Zod validation) ──→ useAdminSalesStore (Zustand)
         │                                            │
         └───────────── Reads state ──────────────────┘
                                                      │
                                                      ▼
    Mock DB (src/lib/data/admin/sales-flow/*) ⟵(Init load only)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/(admin)/admin/ventas/page.tsx` | Modify | List sales (desktop table / mobile cards). |
| `src/app/(admin)/admin/ventas/nueva/page.tsx` | Create | Wrapper for OrderFormPage (create mode). |
| `src/app/(admin)/admin/ventas/[id]/page.tsx` | Create | Sale detail view. |
| `src/app/(admin)/admin/ventas/[id]/editar/page.tsx` | Create | Wrapper for OrderFormPage (edit mode). |
| `src/app/(admin)/admin/ventas/ordenes/page.tsx` | Create | List purchase orders. |
| `src/app/(admin)/admin/ventas/ordenes/[id]/page.tsx` | Create | Purchase order detail view. |
| `src/app/(admin)/admin/ventas/archivados/page.tsx` | Create | Static placeholder. |
| `src/components/admin/layout/Sidebar.tsx` | Modify | Add accordion logic for grouped items. |
| `src/components/admin/layout/MobileDrawer.tsx` | Modify | Add accordion logic. |
| `src/lib/data/admin/navigation.ts` | Modify | Update to nested structure for accordion. |
| `src/stores/admin-sales-store.ts` | Create | Zustand store for sales & POs. |
| `src/components/admin/sales-flow/*` | Create | Forms, Drawers, Cards for sales domain. |
| `package.json` | Modify | Add `react-hook-form`, `zod`, `@hookform/resolvers`. |

## Interfaces / Contracts

```typescript
type AdminSale = {
  id: string; // "101", "102"
  status: "pending" | "paid" | "shipped" | "delivered" | "cancelled" | "archived";
  paymentStatus: "pending" | "paid" | "refunded";
  shippingStatus: "pending" | "processing" | "shipped" | "delivered";
  customer: { name: string; email: string; phone?: string; document?: string };
  items: Array<{ productId: string; variantId?: string; quantity: number; price: number; name: string }>;
  totals: { subtotal: number; discount: number; shipping: number; total: number };
  history: Array<{ date: string; action: string; note?: string }>;
  sourceOrderId?: string; // If converted from PO
};

type AdminPurchaseOrder = Omit<AdminSale, "status" | "sourceOrderId"> & {
  id: string; // "OC-2026-123456"
  status: "pending" | "converted" | "cancelled";
};
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Validation rules | Not applicable (no test runner). Enforce via strict Zod typing. |
| Integration | Store transitions | Manual browser verification of cancel -> reopen flows. |
| E2E | Create -> Convert -> Edit | Manual browser verification. |

## Migration / Rollout

Data is strictly in-memory mock data. Existing `src/lib/data/admin/*` statistics files will be moved to `src/lib/data/admin/statistics/`. No production database migration required.

## Open Questions

- None.
