# Catalog Persistence Specification

## Purpose

Persist the authoritative product catalog, category hierarchy, variants, and catalog settings while retaining frontend-compatible identities and projections.

## Requirements

### Requirement: Catalog Records, Seeds, and Money

The system MUST persist Product, ProductVariant, variant options, Category, product-category assignments, and CatalogSettings. Catalog seeds MUST preserve supported legacy IDs and be repeatable. Money MUST use fixed-scale Decimal storage and mappers MUST return finite JavaScript numbers; persistence models MUST NOT be exposed as DTOs.

#### Scenario: Repeatable compatible seed
- GIVEN an empty migrated catalog database
- WHEN the catalog seed runs twice
- THEN supported legacy IDs and one settings record MUST remain stable without duplicates

#### Scenario: Decimal mapping
- GIVEN a product price with cents
- WHEN an admin or public projection is returned
- THEN its price MUST be a finite numeric value with no Decimal object exposed

### Requirement: Product Identity and Variants

The system MUST enforce unique product `slug`, unique `publicSlug`, and globally unique non-empty SKUs. It MUST validate no more than two distinct variant properties and an exact Cartesian product of active values. Each product MUST have a purchasable default variant when it has no option axes. Variant price MAY inherit the product price when no override is stored.

#### Scenario: Valid inherited variant
- GIVEN a product with two option axes and no variant price override
- WHEN every expected combination is submitted with unique SKUs
- THEN all combinations MUST persist and each returned variant MUST use the product price

#### Scenario: Identity or combination conflict
- GIVEN an existing public slug or SKU, or a submitted missing/stale combination
- WHEN a product is created or updated
- THEN the operation MUST fail with a testable conflict or validation error and persist nothing partial

### Requirement: Category Lifecycle and Organization

The system MUST enforce unique category slugs and prevent a category from becoming its own ancestor. Hiding a category MUST hide every descendant; showing it MUST NOT reveal descendants. Deletion MUST fail with `CATEGORY_IN_USE` when products reference the category or any descendant. Category ordering and `showOutOfStockAtEnd` MUST be persisted by stable IDs/settings.

#### Scenario: Hierarchy visibility
- GIVEN a visible parent and hidden descendants
- WHEN the parent is hidden and then shown
- THEN hiding MUST cascade and showing MUST leave each descendant hidden

#### Scenario: Protected deletion and cycle
- GIVEN a subtree referenced by a product, or a parent reassignment that closes a cycle
- WHEN deletion or reassignment is requested
- THEN it MUST fail with `CATEGORY_IN_USE` or `CATEGORY_CYCLE` and preserve the tree
