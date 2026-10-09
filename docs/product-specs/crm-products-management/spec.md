# CRM Products Management Specification

## Purpose

Admin users create, edit, duplicate, delete, preview, organize, and prepare import/export flows for products using production-shaped mock contracts. Real backend persistence, real CSV processing, image processing, permissions, and guaranteed public storefront sync are out of scope. The product contracts SHOULD be shaped for future real catalog persistence, but admin in-memory mutations MUST NOT be presented as durable or guaranteed storefront-visible changes in this phase.

## Requirements

### Requirement: Create Product Form

The system MUST provide `/admin/productos/nuevo` with modular RHF+Zod form sections for identity, description, media, prices, product type, inventory, codes, logistics, shopping metadata, categories, variants, tags/brand/SEO, highlight sections, free shipping, and visibility. The product form MUST use a shared RHF form context via `FormProvider` (or equivalent centralized RHF composition) and split UI into focused section/card components. It MUST NOT be implemented as one oversized monolithic component. Required and typed fields MUST validate before save; missing images MUST warn but not block save. All form inputs, selects, and textareas MUST use the project input sizing pattern (`text-base md:text-sm` or equivalent) to prevent iOS Safari input zoom, and invalid fields MUST expose accessible error state via label, `aria-invalid`, and `aria-describedby`.

#### Scenario: Create valid product
- GIVEN the admin fills all required fields with valid values
- WHEN the admin submits the form
- THEN a product is created in the in-memory admin catalog
- AND id and slug are generated through the mock contract

#### Scenario: Save without image
- GIVEN required fields are valid and no image is attached
- WHEN the admin submits the form
- THEN the form shows a warning for media
- AND the admin may still save the product

### Requirement: Edit and Product Actions

The system MUST provide `/admin/productos/[id]` with prefilled fields, dirty/save state, public preview link, duplicate, copy ID, and destructive delete confirmation. Duplicates MUST copy editable catalog fields but generate new id and slug and MUST NOT copy SKU, barcode, or exact slug.

#### Scenario: Edit saved product
- GIVEN an existing product is loaded
- WHEN the admin changes a valid field and saves
- THEN the product is updated in the in-memory admin catalog
- AND success feedback is shown

#### Scenario: Confirm product deletion
- GIVEN an existing product is loaded
- WHEN the admin selects delete and confirms the modal
- THEN the product is removed from the admin catalog
- AND destructive styling and confirmation are used

### Requirement: Product Drawers and Variants

The system MUST provide drawers or full-screen mobile panels for category selection, variant properties, tags/brand/SEO, and highlight sections. Variant properties MUST allow at most two optional properties (one "Variante" and one "Subvariante") with mutual exclusion between presets and native checkbox selection, without generating combinatorics matrices.

#### Scenario: Generate variant configurations
- GIVEN Color and Size properties are configured
- WHEN the admin saves the variant configuration
- THEN variants are available for product management in the admin catalog

#### Scenario: Invalid SEO slug
- GIVEN another product already uses a slug
- WHEN the admin enters the same slug
- THEN the form rejects it with a field-level error

### Requirement: Organize and Export/Import Prepared UI

The system MUST provide organize routes for highlight sections, category ordering settings, out-of-stock display settings, and export/import prepared UI. Export/import buttons MAY show mock toasts but MUST NOT perform real CSV generation, parsing, or bulk persistence.

#### Scenario: Prepared import action
- GIVEN the admin opens export/import
- WHEN the admin clicks Import
- THEN the system indicates the feature is prepared for future integration

### Requirement: Duplicated products resolve from client memory

Duplicated memory-only products MUST be editable after navigation. The product edit route MUST NOT show a 404 only because the server mock cannot resolve the duplicated ID.

#### Scenario: Duplicate opens edit page
- GIVEN a product is duplicated into the admin products memory store
- WHEN the user navigates to the duplicated product edit URL
- THEN the edit UI resolves the duplicated product on the client
- AND the page does not render a 404

### Requirement: Mobile touch drag-and-drop fallback

Catalog organization MUST support touch reordering without adding a new drag-and-drop dependency. Pointer/mouse drag behavior MUST continue to work.

#### Scenario: Touch reorder moves item
- GIVEN the catalog organizer is used on a touch device
- WHEN the user touches, drags, and releases an item over a new position
- THEN the item order updates to the new position
- AND existing desktop drag behavior remains available

### Requirement: Variant property data model and schema limits

The product form MUST model `variantProperties` as at most two optional properties: one "Variante" and one "Subvariante". The schema MUST enforce Zod `.max(2, "Solo se permiten una Variante y una Subvariante")` and MUST reject duplicate property names.

#### Scenario: Maximum two variant properties are accepted
- GIVEN the product form receives one "Variante" and one "Subvariante"
- WHEN `variantProperties` is validated
- THEN the schema accepts the collection
- AND no more than two variant property entries exist

#### Scenario: Third variant property is rejected
- GIVEN the product form receives three `variantProperties` entries
- WHEN `variantProperties` is validated
- THEN validation fails with the `.max(2)` limit message

#### Scenario: Duplicate variant property names are rejected
- GIVEN "Variante" and "Subvariante" use the same property name
- WHEN `variantProperties` is validated
- THEN validation fails because property names MUST be unique

### Requirement: Variants drawer mutual exclusion

The Variants Drawer MUST render exactly two `<select>` inputs, one for "Variante" and one for "Subvariante". A selected preset in either select MUST be excluded or disabled in the other select using React Hook Form `useWatch` state.

#### Scenario: Selected preset is unavailable in the other select
- GIVEN two `<select>` inputs are rendered for "Variante" and "Subvariante"
- WHEN the "Variante" select chooses "Sabor"
- THEN "Sabor" is excluded or disabled in the "Subvariante" select
- AND the exclusion is derived from React Hook Form `useWatch`

#### Scenario: Cleared preset becomes available again
- GIVEN "Sabor" is disabled in the opposite select due to a current selection
- WHEN the original select is cleared or changed to another preset
- THEN "Sabor" becomes available in the opposite select again

### Requirement: Variants and Categories drawer UI cleanup

The Variants and Categories drawers MUST use simple text and native checkboxes (`<input type="checkbox">`). They MUST NOT use chip styling classes including `rounded-full` or `bg-accent-soft`, and MUST omit the subtitle/footer text removed by the approved design.

#### Scenario: Variants drawer renders simple checkbox UI
- GIVEN the Variants Drawer renders
- WHEN its selectable values are displayed
- THEN values use native `<input type="checkbox">` controls
- AND no value control uses `rounded-full` or `bg-accent-soft`
- AND the obsolete subtitle/footer text is omitted

#### Scenario: Categories drawer renders simple checkbox UI
- GIVEN the Categories Drawer renders
- WHEN its selectable values are displayed
- THEN values use native `<input type="checkbox">` controls
- AND no value control uses `rounded-full` or `bg-accent-soft`
- AND the obsolete subtitle/footer text is omitted

### Requirement: Variants drawer values interaction

The Variants Drawer MUST show predefined values as checkboxes for a selected preset property and MUST provide an input to add custom values to that same property. Selecting "+ Nueva variante" MUST show an input for naming the custom property.

#### Scenario: Preset property renders values and custom value input
- GIVEN a preset property such as "Sabor" is selected
- WHEN the property section renders
- THEN predefined values render as checkboxes
- AND an input to add custom values to "Sabor" is rendered

#### Scenario: Custom predefined value is added and selected
- GIVEN a predefined property is selected
- WHEN a custom value is entered and confirmed
- THEN the value is added to that property's checkbox list
- AND the new checkbox is checked

#### Scenario: New variant option opens custom property input
- GIVEN the Variants Drawer select is visible
- WHEN selecting "+ Nueva variante"
- THEN an input to name the custom property is rendered

### Requirement: Variant preset data source

Preset variant options and values MUST be loaded from `src/lib/data/admin/product-variant-presets.ts`. The drawer MUST NOT define the Sabor, Color, Tamaño, or Talle preset catalog inline.

#### Scenario: Preset catalog is loaded from data layer
- GIVEN the Variants Drawer needs preset options
- WHEN the preset catalog is resolved
- THEN it is loaded from `src/lib/data/admin/product-variant-presets.ts`
- AND the component does not duplicate the preset catalog inline

### Requirement: Admin product back navigation

Secondary admin product pages MUST provide a consistent Back control in the page header when returning to the products area is expected.

#### Scenario: Back button returns to products area
- GIVEN a secondary product management page is displayed
- WHEN the user activates the header Back control
- THEN the user is routed back to the configured products destination
- AND the page title, description, and actions remain visible in the header

### Requirement: PR Delivery and Validation

The management capability MUST be delivered through PR 3 create core fields, PR 4 edit/duplicate/delete/copy ID, PR 6 variants/drawers, and PR 8 organize plus export/import prepared UI. Each PR MUST pass lint, typecheck, build, and route-specific manual smoke testing.

#### Scenario: Phased completion
- GIVEN a management PR is ready
- WHEN validation runs
- THEN command results and manual smoke notes are documented before review
