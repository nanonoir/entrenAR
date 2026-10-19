# CRM Categories Management Specification

## Purpose

Admin users manage categories and subcategories through the authenticated backend (`POST/PUT/DELETE /admin/categories`, `PUT /admin/categories/:id/visibility`). The UI reaches it only through the `AdminCategoriesRepository` interface (`src/lib/api/admin/categories`), whose implementation follows `NEXT_PUBLIC_DATA_SOURCE` (API by default; the in-memory mock is explicit, offline and non-production only). The backend is the authority for slugs, cycles, references and visibility cascade; the mock only imitates those rules.

Mutations are non-optimistic and serialized: the UI reports success only after the server answers, then reloads the canonical tree. Category changes persist across page reloads and are what the public storefront reads from the catalog API.

## Requirements

### Requirement: Category List and Tree

The system MUST provide `/admin/productos/categorias` with title, explanatory copy, create action, help link, and a nested category list. Categories MAY have multiple nested levels. Manual drag ordering MUST NOT be part of the MVP.

#### Scenario: View nested categories
- GIVEN categories and subcategories exist
- WHEN the admin opens the category page
- THEN parent and child categories are shown in a nested hierarchy
- AND each row exposes its action menu

#### Scenario: Hidden parent category
- GIVEN a parent category has visible subcategories
- WHEN the parent category is hidden
- THEN its subcategories are also hidden from storefront-facing category navigation rules

### Requirement: Category Creation and Subcategory Creation

The system MUST allow creating categories and subcategories by name. The backend MUST generate sanitized unique slugs (the mock mirrors this) and associate subcategories with the selected parent. The created category MUST appear only after the server confirms it and the canonical tree is read back.

#### Scenario: Create category
- GIVEN the category page is open
- WHEN the admin enters a valid new category name
- THEN the category is added with a generated slug

#### Scenario: Duplicate category slug
- GIVEN a category already uses a slug
- WHEN another category name resolves to the same slug
- THEN the system adjusts or rejects the slug to keep it unique

### Requirement: Edit Category

The system MUST provide `/admin/productos/categorias/[id]` with fields for name, optional description, optional image, Google Shopping prepared field, SEO title, SEO description, editable URL slug, and visibility. Name MUST be required; description MUST be limited to 140 characters; SEO fields MUST respect 70 and 160 character limits. All category form inputs, selects, and textareas MUST use the project input sizing pattern (`text-base md:text-sm` or equivalent) to prevent iOS Safari input zoom, and invalid fields MUST expose accessible error state via label, `aria-invalid`, and `aria-describedby`.

#### Scenario: Save category changes
- GIVEN an existing category is loaded
- WHEN the admin edits valid fields and saves
- THEN the category is updated through the backend and the canonical tree is read back
- AND success feedback is shown only after server confirmation

#### Scenario: Partial update preserves omitted fields
- GIVEN a category has parent, description, image, Google Shopping and SEO values
- WHEN `PUT /admin/categories/:id` omits an optional field (including `slug` and `parentId`)
- THEN the stored value and hierarchy are preserved

#### Scenario: Explicit null clears
- GIVEN the admin blanks an optional field or selects "Sin padre" in the edit form
- WHEN the form is saved
- THEN the UI sends an explicit `null` for that field (`parentId: null` moves the category to the root)
- AND the backend clears it; cycle checks, slug uniqueness and hidden-visibility cascade remain backend-enforced

#### Scenario: Save pending, failure and sync failure
- GIVEN a mutation is in flight
- THEN the form and list actions are disabled and no state changes are shown (one mutation at a time)
- WHEN the server rejects it (validation, slug conflict, cycle, 401/403, 503)
- THEN an admin-facing error is shown, local state is untouched and retry is possible
- AND if the mutation succeeds but the canonical reload fails, the UI reports the sync failure instead of claiming a fresh state

#### Scenario: Description too long
- GIVEN the category edit form is open
- WHEN the admin enters a description over 140 characters
- THEN the field shows a validation error

### Requirement: Delete and Hide Category

The system MUST require confirmation before deleting a category. Deleting a category MUST NOT delete products: the backend refuses to delete a category (or any descendant) still referenced by products with `409 CATEGORY_IN_USE`, and the confirmation copy MUST say so instead of promising product removal. The modal closes only after the server confirms the deletion. Hiding a category MUST NOT delete products and cascades hidden visibility to its descendants (showing does not reveal descendants). Products MAY remain visible when they also belong to another visible category.

#### Scenario: Confirm category deletion
- GIVEN a category exists
- WHEN the admin confirms deletion
- THEN the category hierarchy is removed by the backend when unreferenced
- AND destructive confirmation styling is used

#### Scenario: Deletion of a referenced category
- GIVEN products reference the category or a descendant
- WHEN the admin confirms deletion
- THEN the backend answers `409 CATEGORY_IN_USE`, the category stays, and the UI shows the rejection

### Requirement: PR Delivery and Validation

The categories capability MUST be delivered in PR 5. The PR MUST pass `npm run lint`, `npx tsc --noEmit`, `npm run build`, and documented manual smoke tests for category list, create, edit, hide, and delete flows.

#### Scenario: Category PR evidence
- GIVEN PR 5 is ready
- WHEN validation is completed
- THEN command outputs and manual category smoke notes are recorded
