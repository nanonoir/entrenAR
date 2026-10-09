# Design: Admin Filter Drawers Normalization

## Context & Intent
Standardize the filter drawers across the Admin/CRM section by utilizing the newly created `AdminFilterDrawer` and `FilterOptionGroup` components. This reduces boilerplate, ensures a consistent scrollable shell with a fixed footer, and unifies the interaction patterns for single-choice filter groups.

## Architecture & Approach

- **Base Component**: Wrap the target filter drawers with `AdminFilterDrawer`. This component absorbs the `open`, `onOpenChange`, `title`, `description`, `onApply`, `onReset`, and `applyDisabled` props, handling the `Sheet` layout, header, scrollable content area, and fixed sticky footer automatically.
- **Filter Groups**: Inside the drawer content, replace custom `<RadioGroup>` and label layouts with `FilterOptionGroup` for single-choice selections.
- **State Preservation**: The drawers will remain controlled components. Existing screen-owned filter state (managed via local state or Zustand stores at the page level) will be preserved without architectural changes to the data flow.
- **Out of Scope**: Non-filter drawers (e.g., creation or edit drawers) will not be touched in this change to limit the blast radius.

## Component-Specific Migration Plan

### 1. `ProductFilterDrawer`
- **Path**: `src/components/admin/products/ProductFilterDrawer.tsx` (or equivalent location).
- **Shell**: Replace custom UI boilerplate with `<AdminFilterDrawer>`.
- **Props Cleanup**: Remove the `categories` prop (identified during exploration as unused/voided).
- **Controls**: Migrate "Status" (Active, Draft, Archived) and other single-choice fields to use `<FilterOptionGroup>`.

### 2. `CustomerFilterDrawer`
- **Path**: `src/components/admin/customers/CustomerFilterDrawer.tsx`
- **Shell**: Replace custom UI boilerplate with `<AdminFilterDrawer>`.
- **Controls**: Migrate "Status" (Active, Inactive) to use `<FilterOptionGroup>`.

### 3. `ShipmentFilterDrawer`
- **Path**: `src/components/admin/shipments/ShipmentFilterDrawer.tsx`
- **Shell**: Replace custom UI boilerplate with `<AdminFilterDrawer>`.
- **Controls**: Migrate "Status" (Pending, Shipped, Delivered) to use `<FilterOptionGroup>`.

## Validation Plan
1. **Static Analysis**: Run `npm run lint` and `npx tsc --noEmit` to ensure no type errors were introduced by the prop changes (especially the removed `categories` prop).
2. **Build Test**: Run `npm run build` to confirm production readiness.
3. **Visual Regression**: Visually compare the running application against `openspec/changes/archive/2026-06-29-AdminDrawerNormalization/drawerFiltros.png` to verify padding, typography, and footer alignment.
4. **Responsive Smoke Test**: Open the drawers on a mobile viewport size to verify the footer sticks to the bottom and the body content scrolls without hiding options.