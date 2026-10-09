# CRM Products Drawers Redesign: Technical Design

## Component Decomposition

**Decision:** Do not create new full drawer wrapper components for this redesign. `ProductAdvancedDrawersCard.tsx` already owns the shared `<Drawer>` shell and the `openDrawer` state for category, variants, metadata, and highlights. The redesign should extract only the drawer **content** into focused components and keep the existing `Drawer` primitive as the shell.

1. **`src/components/admin/products-flow/product-form/ProductAdvancedDrawersCard.tsx` (Update)**
   - Remains the owner of the `<Drawer>` shells and `openDrawer` state.
   - Imports focused content components for category and variant drawer bodies.
   - Removes the current inline category and variants drawer bodies.
2. **`src/components/admin/products-flow/product-form/ProductCategoryList.tsx` (New content component)**
   - Renders category drawer content intended to be placed inside the existing `<Drawer>` shell.
   - Owns search input, the `Crear categoría` entry row, and the flat category list.
   - Renders multi-select checkboxes and inline parent/child hierarchy text.
   - Receives category data, selected ids, and toggle callbacks from `ProductAdvancedDrawersCard` / RHF state.
3. **`src/components/admin/products-flow/product-form/ProductVariantSelector.tsx` (New content component)**
   - Renders one variant tier (`Variante` or `Subvariante`) inside the existing variants drawer.
   - Handles the select, preset values as native checkboxes, custom values input, and optional custom property name input.
   - Receives selected property data, blocked option names, and update callbacks from the parent.
4. **Existing `src/components/ui/Drawer.tsx`**
   - Continues to provide the shared drawer shell, header, close behavior, and layout primitives.
   - Must not be duplicated by product-specific full drawer wrappers unless a future reuse case requires it.

## Data Model & Schema Impacts

- **Categories**: The schema for categories remains hierarchical in the backend/mock layer (`id`, `name`, `parentId`), but the UI representation flattens this into `id` and `displayPath` (e.g., `Nutrition > Proteins`) to allow easy searching and multi-select.
- **Variants**: The variant selection model will strictly limit to two active property types (`propertyOne`, `propertyTwo`) such as `Color` and `Talle`. The state requires an array of values for each property (e.g., `propertyOne: { name: 'Color', values: ['Rojo', 'Azul'] }`).

## State Management Strategy

- **React Hook Form (RHF) Integration**: If the parent product creation form uses RHF (as per the `build-form` skill hygiene rules), these drawers will interact with the form state using `useWatch` and `setValue`.
- **Drawer State**:
  - `setValue('categoryIds', [...], { shouldValidate: true, shouldDirty: true })` for category checkboxes.
  - Local state (`useState`) within the drawer to handle the *Search Input* (which filters the category list) and the *Custom Variant Input* string before it is "added" to the variant values.
- **Mutual Exclusion**: Managed at the `ProductVariantsDrawer` level. When `Variante` selects "Color", "Color" is added to a disabled/hidden list for the `Subvariante` select options. If a conflict occurs, the secondary select is cleared.
- **Mutual Exclusion**: Managed by `ProductAdvancedDrawersCard` (or a tiny helper/hook colocated with it) using RHF `useWatch` as the source of truth. When `Variante` selects "Color", "Color" is disabled/hidden for `Subvariante`. If a conflict occurs, the secondary select is cleared via `setValue`.

## Preserving the Design System (Compact & Top-Aligned)

- **Layout**: Utilize Tailwind classes like `items-start`, `justify-start`, and removing flex-center defaults in the drawer body.
- **Components**: Reuse standard `Checkbox`, `Input`, and `Select` primitives from `src/components/ui`.
- **Spacing**: Use dense spacing utilities (`gap-2`, `p-4`) instead of large padding to maintain compactness.
- **Removal of Clutter**: Explicitly avoid using `Badge`/chips or decorative cards for selected variants. Render them purely as checkboxes with labels.

## Risks & Tradeoffs

1. **Flat Hierarchy Representation**: Flattening "unlimited" subcategories into inline text (`Parent > Child > Grandchild`) scales visually better than deep trees, but extremely long names might truncate. *Mitigation*: Use `truncate` and `title` attributes for tooltips.
2. **Mutual Exclusion Complexity**: Handling variant changes dynamically while maintaining strict RHF arrays could lead to race conditions or stale data if not carefully synchronized. *Mitigation*: Keep the mutual exclusion logic strictly in the UI layer before calling `setValue`.

## Decoupling

To avoid coupling the new drawer UX to unrelated product flows:
- The drawers must act as purely controlled or independently managed UI components that receive a `selectedIds` array and an `onChange` callback.
- Category and variant content components must not own full drawer open/close state. They receive data and callbacks, while `ProductAdvancedDrawersCard` remains the shell/orchestration owner.
- They must not assume they are saving directly to the database; they only reflect and mutate the form's local state. The actual submission logic remains the responsibility of the parent `ProductForm` component.
