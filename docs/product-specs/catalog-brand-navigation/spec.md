# Catalog Brand Navigation Specification

## Purpose
Public brand discovery without brand management.

## Requirements

### Requirement: Canonical Brand Navigation
The system MUST provide `/marcas`, listing available public brands with consistent canonical links, paginated brand listings, and redirects for resolvable aliases; unknown brands MUST remain not-found.

#### Scenario: Brand discovery
- GIVEN the baseline public catalog
- WHEN `/marcas` and its brand links are followed
- THEN Star Nutrition's 51 and ENA's 67 products are reachable across pagination

#### Scenario: Alias and unknown brand
- GIVEN a resolvable alias and an unknown brand
- WHEN their URLs are requested
- THEN the alias redirects canonically and the unknown brand is not-found
