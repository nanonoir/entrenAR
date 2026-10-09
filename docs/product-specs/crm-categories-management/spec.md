# CRM Categories Management Specification

## Purpose

Admin users manage categories and subcategories for catalog organization through mock/in-memory contracts prepared for backend migration. Category changes in this phase MUST NOT guarantee live storefront synchronization, and the public storefront MUST NOT be required to subscribe to admin in-memory category state.

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

The system MUST allow creating categories and subcategories by name. The mock contract MUST generate sanitized unique slugs and associate subcategories with the selected parent.

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
- THEN the category is updated in the in-memory admin catalog
- AND success feedback is shown

#### Scenario: Description too long
- GIVEN the category edit form is open
- WHEN the admin enters a description over 140 characters
- THEN the field shows a validation error

### Requirement: Delete and Hide Category

The system MUST require confirmation before deleting a category. The deletion confirmation MUST show this warning copy: "Si eliminás esta categoría, se eliminarán automáticamente los productos que pertenezcan solo a esta categoría. Revisá antes de continuar: esta acción es irreversible." Hiding a category MUST NOT delete products. Products MAY remain visible when they also belong to another visible category.

#### Scenario: Confirm category deletion
- GIVEN a category exists
- WHEN the admin confirms deletion
- THEN the category is removed according to the mock contract
- AND destructive confirmation styling is used
- AND the confirmation modal shows the required irreversible-action warning copy

### Requirement: PR Delivery and Validation

The categories capability MUST be delivered in PR 5. The PR MUST pass `npm run lint`, `npx tsc --noEmit`, `npm run build`, and documented manual smoke tests for category list, create, edit, hide, and delete flows.

#### Scenario: Category PR evidence
- GIVEN PR 5 is ready
- WHEN validation is completed
- THEN command outputs and manual category smoke notes are recorded
