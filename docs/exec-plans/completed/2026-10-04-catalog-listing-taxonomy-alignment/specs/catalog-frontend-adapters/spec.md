# Delta for Catalog Frontend Adapters

## ADDED Requirements

### Requirement: Complete Canonical Browsing
Consumers MUST preserve complete filtered pagination/sorting, scope-wide unique facets, canonical memberships, legacy fixture compatibility and every PUBLIC category route, including zero eligible products. Failures MUST NOT become empty results/false 404s; touched admin reads MUST NOT imply partial-page completeness. Responsive/accessibility behavior and professional Spanish UI MUST remain.

#### Scenario: Canonical and fixture membership
- GIVEN canonical products with empty legacy arrays and legacy-only fixtures
- WHEN category/group filters run
- THEN both sources retain correct membership, including Performance and Control de peso

#### Scenario: Empty versus failure
- GIVEN a PUBLIC category with zero eligible products, or an upstream failure
- WHEN its route loads
- THEN it shows a valid empty listing or controlled error respectively, never false 404
