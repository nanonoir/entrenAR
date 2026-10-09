# Design: CRM Products Management

## Technical Approach

Implement the CRM Products module using Next.js App Router, strictly separating the `(admin)` route group from the storefront. Data fetching will use async mock adapters in Server Components, passing data to Client Components via props. Client mutations will use a Zustand mock-backend store (`admin-products-store`) exposing business domain commands. Complex forms will use `react-hook-form` with Zod validation and a modular `FormProvider` architecture. Inline editing will use localized controlled cell adapters.

## Architecture Decisions

### Decision: Form Architecture for Product Management
**Choice**: Modular `react-hook-form` (RHF) using `FormProvider` and Zod schema validation.
**Alternatives considered**: One monolithic RHF component, or manual state management.
**Rationale**: The product form is large and complex (identity, pricing, variants, logistics). Splitting it into smaller card components (e.g., `<ProductIdentityCard>`) using `useFormContext` avoids a 1000-line file and excessive re-renders, adhering to the `entrenar-frontend-architecture` limit of 300 lines per component.

### Decision: Inline Editing Strategy (Prices & Stock)
**Choice**: Localized controlled components per cell with internal status (idle/loading/success/error) and Zod validation, delegating to the Zustand store on blur/Enter.
**Alternatives considered**: A global table-wide RHF form.
**Rationale**: A table-wide form causes massive re-renders and caret instability. Localized cells keep interactions fast, isolate errors, and easily implement the required trailing status icons (spinner, check, X).

### Decision: Data Fetching and Mutation Boundary
**Choice**: Server Components fetch via async `getAdminProducts()` (even for static mocks). Client Components dispatch domain actions to a Zustand store (`useAdminProductsStore.getState().updatePrice()`).
**Alternatives considered**: Importing mock data directly into Client Components, or using Route Handlers prematurely.
**Rationale**: importing mocks into Client Components bloats the bundle. Async server fetching prepares the codebase for a zero-friction Prisma transition, matching the `entrenar-data-layer` rules.

## Data Flow

    [Server Component] ──(async fetch)──→ mock-products.ts (Future: Prisma)
         │ (passes props)
         ▼
    [Client Component (Table/Form)] ──(user action)──→ RHF / Local State
         │ (dispatch)
         ▼
    [Zustand Store (admin-products-store)] ──(updates memory)──→ UI Re-renders

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/(admin)/admin/productos/page.tsx` | Create | Product list Server Component. |
| `src/app/(admin)/admin/productos/nuevo/page.tsx` | Create | Create product form page. |
| `src/app/(admin)/admin/productos/[id]/page.tsx` | Create | Edit product form page. |
| `src/app/(admin)/admin/productos/categorias/page.tsx` | Create | Categories list and tree view. |
| `src/app/(admin)/admin/productos/inventario/page.tsx` | Create | Inventory list with inline stock. |
| `src/components/admin/products-flow/*` | Create | Domain components (ProductTable, InlinePriceCell, CategoryModal). |
| `src/stores/admin-products-store.ts` | Create | Zustand store mimicking backend mutations. |
| `src/schemas/admin/product-schemas.ts` | Create | Zod schemas for AdminProduct, Category, validation. |
| `src/lib/data/admin/products-flow/mock-products.ts` | Create | Mock data and async getter functions. |

## Interfaces / Contracts

```typescript
// DTOs (Stored in src/lib/data/admin/products-flow/types.ts)
export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  salePrice: number;
  promotionalPrice?: number;
  stock: number | 'infinite';
  categoryId: string;
  visibility: 'visible' | 'hidden';
  // ...other fields
}

// Zustand Store Contract
export interface AdminProductsStore {
  products: AdminProduct[];
  updateProductPrice: (id: string, prices: { salePrice: number, promotionalPrice?: number }) => Promise<void>;
  createProduct: (data: z.infer<typeof productSchema>) => Promise<AdminProduct>;
  deleteCategory: (categoryId: string) => Promise<void>; // Enforces warning logic
  // ...other commands
}
```

## Testing & Validation Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| CI | Code Quality | `npm run lint` and `npx tsc --noEmit` on every PR. |
| Build | Production Readiness | `npm run build` on every PR. |
| Manual | Form Validation | Smoke test RHF errors, iOS zoom prevention (`text-base md:text-sm`), accessibility (`aria-invalid`), scroll-to-error. |
| Manual | Inline Editing | Smoke test blur/Enter triggers, loading spinner, green check, red X, and idle reset. |
| Manual | Modals | Verify exact destructive copy for category deletion. |

### PR Boundaries
1. **PR 1**: Foundation + admin product list.
2. **PR 2**: Inline price editing + filters/sorting.
3. **PR 3**: Create product form — core fields (RHF `FormProvider`).
4. **PR 4**: Edit product + duplicate/delete/copy ID.
5. **PR 5**: Categories management (list, create, edit, delete with specific copy).
6. **PR 6**: Variants + product drawers (safe flex layouts).
7. **PR 7**: Inventory + stock history.
8. **PR 8**: Organize + export/import prepared UI.

## Migration / Rollout
No database migration required yet. The frontend is built "Prisma-ready". Once the backend phase starts:
1. Replace `getAdminProducts()` mock with Prisma queries in Server Components.
2. Replace Zustand store actions with Next.js Server Actions or Route Handlers.
3. Replace Zustand store state consumption with `useQuery` or standard server-to-client prop waterfalls.

## Open Questions
- None. The mock contracts and execution phases are fully defined.
