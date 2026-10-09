# Catalog Admin API Specification

## Purpose

Provide ADMIN-authorized catalog, category, organization, and inventory-management contracts with complete CRM projections.

## Requirements

### Requirement: Protected Admin Catalog Commands

Every `/api/v1/admin/*` catalog command MUST require ADMIN authorization. The system MUST provide validated create, read, update, delete, price, and duplicate operations for products and categories, plus catalog-organization settings. Expected failures SHALL use the shared safe error envelope.

#### Scenario: Authorized product lifecycle
- GIVEN an ADMIN access token and valid product input
- WHEN the product is created, updated, and retrieved
- THEN each response MUST return the current admin projection with `slug` and `publicSlug`

#### Scenario: Unauthorized or invalid command
- GIVEN no ADMIN authorization or invalid product/category input
- WHEN an admin command is submitted
- THEN it MUST return `UNAUTHORIZED`, `FORBIDDEN`, or `VALIDATION_ERROR` without mutation

### Requirement: Independent Product Duplication

The system MUST duplicate a product with new product, slug, publicSlug, SKU, variant, and inventory identities. The duplicate MUST retain compatible catalog content, reset `salesCount` to zero, receive a new manual-order position, and MUST NOT share mutable children with its source.

#### Scenario: Duplicate product
- GIVEN an ADMIN and an existing multi-variant product
- WHEN duplication is requested
- THEN the returned product MUST contain unique collision-safe identifiers and independent variants/inventory

#### Scenario: Missing source
- GIVEN an ADMIN and an unknown product ID
- WHEN duplication is requested
- THEN it MUST return `NOT_FOUND`

### Requirement: Admin Tree and Collection Queries

The system MUST return categories as a recursive adjacency-list projection to admin consumers. Product, inventory-history, and applicable list endpoints MUST support validated pagination, filters, and sort order; empty matches MUST return an empty page rather than an error.

#### Scenario: Filtered admin page
- GIVEN matching and non-matching products
- WHEN an ADMIN requests a bounded filtered/sorted page
- THEN it MUST return only matching records and stable pagination metadata

#### Scenario: Empty category root
- GIVEN no root categories match an ADMIN query
- WHEN the category tree is requested
- THEN it MUST return an empty recursive collection
