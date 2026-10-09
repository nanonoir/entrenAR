# Delta for Catalog Public API

## MODIFIED Requirements

### Requirement: Public Product Listing and Detail
The system MUST provide unauthenticated read-only listings/details, validated `page`/`limit`, category/brand/offer filters, supported sorting, stable pagination and empty no-match pages. Queries and unique totals/facets MUST cover all eligible products, not a global 100-product slice/descendant sums; categories MUST use canonical associations. Offers MUST retain `compareAtPrice > price`. Detail MUST resolve `publicSlug` through public `slug`, returning `NOT_FOUND` for absent/non-public products.
(Previously: Complete scope/unique facets were unspecified.)

#### Scenario: Compatible filtered page
- GIVEN public products in multiple categories
- WHEN category-filtered sorted pages are requested
- THEN matching public summaries retain numeric price/stock compatibility

#### Scenario: Detail URL and missing product
- GIVEN differing `publicSlug` and admin slug
- WHEN the public slug and then an unknown slug are requested
- THEN detail resolves first and the second returns `NOT_FOUND`

#### Scenario: Complete unique scope
- GIVEN baseline products beyond page one and overlapping memberships
- WHEN filtered pages, totals and facets are requested
- THEN products remain reachable once; Creatina totals 60, Pre/Intra 26, offers 649
