# Catalog Public API Specification

## Purpose

Expose read-only storefront catalog data without authentication while preserving public URLs and DTO compatibility.

## Requirements

### Requirement: Public Category Projection

The system MUST expose visible categories as a flat public projection and MUST NOT expose admin-only tree or management fields. Hidden categories and categories hidden by an ancestor MUST NOT be returned.

#### Scenario: Visible flat navigation
- GIVEN visible root and descendant categories
- WHEN public categories are requested
- THEN the response MUST be a flat, frontend-compatible visible collection

#### Scenario: Hidden cascade exclusion
- GIVEN a category hidden through its ancestor
- WHEN public categories are requested
- THEN that category MUST NOT be returned

### Requirement: Public Product Listing and Detail

The system MUST provide unauthenticated, read-only product listing and detail endpoints. Listing MUST support validated `page`, `limit`, category filtering, and supported sorting, returning stable pagination and an empty page for no matches. Detail lookup MUST resolve `publicSlug` through the public `slug` URL contract and return `NOT_FOUND` for absent or non-public products.

#### Scenario: Compatible filtered page
- GIVEN public products in multiple categories
- WHEN a client requests a category-filtered sorted page
- THEN it MUST return only matching public summaries with compatible numeric price and stock fields

#### Scenario: Detail URL and missing product
- GIVEN a product whose internal `publicSlug` differs from its admin slug
- WHEN its public URL slug is requested, then an unknown slug is requested
- THEN the detail MUST resolve first and the second MUST return `NOT_FOUND`

### Requirement: Public Stock and Mapping Safety

The system MUST map limited and infinite inventory to the numeric public stock contract without storing a fake infinite quantity. Public responses MUST use mapper projections and MUST NOT reveal persistence-only fields or protected data.

#### Scenario: Infinite stock projection
- GIVEN a publicly visible product with infinite stock
- WHEN its summary or detail is returned
- THEN stock MUST satisfy the numeric consumer contract while persistence remains infinite

#### Scenario: Invalid query
- GIVEN malformed pagination or unsupported sort input
- WHEN a public listing is requested
- THEN it MUST return `VALIDATION_ERROR` with no internal details
