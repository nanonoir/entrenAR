# Proposal: Catalog Listing and Taxonomy Alignment

## Intent

Restore complete, correctly categorized local browsing without repeating cutover or changing commercial data.

## Scope

### In Scope
- Complete pagination, sorting, filters and unique facet totals; canonical membership with legacy fixture compatibility.
- `/marcas` index, canonical brand slugs and resolvable alias redirects; missing supplement/category routes.
- Controlled API failures distinct from valid empty listings and missing resources.
- Consolidate `shakers-y-botellas` into `shakers`, permanently redirect its URL, and prevent resurrection.

### Out of Scope
- Brand CRUD/entities, CRM expansion, admin-auth rewrites, payments and Git delivery.
- Scratch databases, resets, reimports, schema-wide changes, production operations, R2 mutations and historical frozen-artifact edits.

## Capabilities

### New Capabilities
- `catalog-brand-navigation`: Public brand index, canonical routes and alias redirects, without brand management.

### Modified Capabilities
- `catalog-public-api`: Complete eligible listing pagination, truthful totals and canonical category filtering.
- `catalog-frontend-adapters`: Complete listing/filter scope, canonical membership, fixture compatibility and failure/empty states; touched admin reads cannot imply completeness from partial results.
- `catalog-taxonomy-sync`: Active 60-category normalization and bounded local shaker consolidation, preserving frozen run evidence and unrelated memberships.

## Approach

Retain domain-facing repositories and NestJS authority. Remove the first-page ceiling; derive membership and unique counts from canonical associations, not legacy arrays or descendant sums. Preserve offers (`compareAtPrice > price`), responsive visual language, accessibility and professional Spanish copy. Pagination architecture belongs to design.

Identify the existing local database, audit every reference and retain private rollback evidence. Execute only the authorized deduplicating transaction; stop on material baseline drift.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/api/catalog/` | Modified | Complete reads and outcomes |
| `src/lib/data/shop-routes.ts` | Modified | Canonical routing and aliases |
| `src/components/shop/products/listing/` | Modified | Pagination and filters |
| `backend/src/modules/catalog/` | Modified | Listing and taxonomy boundaries |
| `backend/` active taxonomy/import normalization | Modified | Prevent obsolete category recreation |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Partial results or duplicated counts | High | Beyond-page-one and unique-membership coverage |
| Destructive merge or stale prerequisites | Medium | Target/reference checks, backup, bounded transaction |

## Rollback Plan

Revert focused code/active-taxonomy changes. Roll back failed transactions; after commit, restore the original category/memberships and remove only newly added shaker links from private pre-change evidence, preserving unrelated subsequent data.

## Dependencies

- Refined PRD and existing local API/database.

## Success Criteria

- [ ] Baseline totals: Creatina 60, Pre/Intra 26, Star Nutrition 51, ENA 67, offers 649; no 100-product ceiling.
- [ ] 23 unique shakers, 60 categories, 2,105 links; preserve 649 products, 1,119 variants, 3,790 images, other memberships, prices, stock, admin/configuration and R2.
- [ ] Playwright checks every retained public category against API/database, plus representative desktop/mobile filters, brands, sorting, aliases and empty/error states.
- [ ] Coverage proves fixture compatibility, pagination, duplicate membership, failures and consolidation rollback/idempotence; evidence separates auth-test tokens from catalog changes.
