# Catalog Listing and Taxonomy Alignment

Status: Refined — Ready for SDD

## Overview and Product Decision

Restore complete, correctly categorized browsing of the imported local catalog. The owner approved the proposed listing/filter/brand repairs, consolidation of `shakers-y-botellas` into `shakers`, implementation followed by verification using Playwright across every public category, and use of the same existing local database. Do not reopen or repeat the completed catalog cutover.

## Problem and Verified Alignment

Three independent read-only investigations verified 649 products, 1,119 variants, 3,790 images, 2,124 category links and 61 categories. Imported associations match the frozen manifest, but the frontend fetches only global page 1 (100 products), filters canonical subcategories against empty legacy `subcategorySlugs`, and has missing/incorrect route mappings. `/marcas` has no root handler, some brand links use different slug rules, and API errors can masquerade as empty listings or 404s. `/shakers` currently displays 2 of 19 directly linked products; `shakers-y-botellas` has 23, including four missing from the root category. Parent descendant sums must not be treated as unique-product counts.

## Goals and Workflows

1. Category, subcategory, brand, offer, sort and filter browsing must consider the entire eligible catalog, retain truthful totals and expose pagination rather than treating a single API page as the complete dataset.
2. Real canonical category associations must drive route/filter membership and facet counts; explicit mock/harness scenarios remain compatible without changing live data to resemble fixtures.
3. `/marcas` is an index of available public brands. Brand pages use consistent canonical slugs and pagination. Existing erroneous aliases redirect to the canonical brand route where resolvable.
4. `shakers` is the single shaker category. Move every existing `shakers-y-botellas` product association into it, deduplicate existing memberships, remove the obsolete category and its memberships, and permanently redirect its old storefront URL to `/shakers`.
5. A real empty category remains a valid empty listing; upstream failures are controlled errors, not false empty results or false resource-not-found responses.

## Scope and Invariants

- Repair public catalog reads, filters, pagination, route resolution, brand navigation/index and missing supplement mappings. Any admin adapter touched must not misrepresent a partial page as the entire dataset; do not expand into unrelated CRM work.
- Preserve the existing visual language, responsive behavior, accessible filter controls, product cards and UI primitives. UI copy remains professional Spanish.
- Preserve current offer eligibility (`compareAtPrice > price`); do not invent curated campaigns or new discount thresholds.
- Consolidate the category on the same positively identified local `entrenar` database in one bounded transaction. Verify current counts and every reference before mutation; rollback on failure. No separate scratch database is requested.
- At the verified baseline, add four missing `shakers` links, remove 23 obsolete links and one category, yielding 23 unique shakers, 60 categories and unchanged product/variant/image totals. Expected resulting category-link count is 2,105. Recompute prerequisites if the baseline has legitimately changed; never silently widen scope.
- Preserve other valid product memberships, including the combo's supplement/protein associations. Preserve IDs, prices, stock, product/variant/image rows, admin identities, configuration, existing R2 assets and ordinary inventory protection.
- Check/reference-audit the current populated catalog and save a private recoverable pre-change snapshot/backup or equivalent targeted rollback evidence before the approved category transaction. Do not overwrite existing backups or expose secrets/PII.
- Update active editable taxonomy/import normalization where necessary so future normal operations do not resurrect the obsolete category. Historical frozen scrape/import artifacts and cutover receipts remain immutable.

## Non-Goals

No database drop, commercial-data cleanup, catalog reimport, schema-wide migration, role separation, admin authentication refactor, R2 upload/delete, production operation, new brand-management CRUD/entity, new CRM events, payment integration, Git delivery or repository issue tracking.

## Acceptance Criteria

- Creatina and Pre/Intra Entreno list eligible totals matching live API and database (baseline 60 and 26); supplement root/group filters work, including Performance and Control de peso.
- `/marcas` succeeds; Star Nutrition's baseline 51 products and ENA's 67 are accessible across pagination. Known brand aliases no longer lead to false 404s.
- `/shakers` has baseline 23 unique products after consolidation; `shakers-y-botellas` is absent from active taxonomy/navigation/filters and its old URL redirects.
- `/ofertas` reports baseline 649 qualifying products with complete pagination. No arbitrary 100-item ceiling; filter counts derive from the complete eligible scope, not merely the visible page.
- All retained public category URLs discovered from the live canonical taxonomy and navigation are checked with Playwright, including categories outside the original sample. For each, compare unique eligible totals, pagination reachability, empty/error behavior and representative product membership against the API/database; no broken links or hidden first-page omissions.
- Representative brand, category, subcategory and offer filters/sorting work on desktop and mobile. Real browser/API evidence is mandatory; HTTP 200 alone is insufficient.
- Changed logic receives appropriate harness/unit coverage, including legacy fixture compatibility, products outside page 1, slug aliases, duplicate membership, API failure versus empty response, and consolidation rollback/idempotence.
- Final evidence distinguishes observed data changes from auth-only tokens created by browser tests. Product, variant, image, stock, price, protected configuration and R2 invariants are proved unchanged.

## Success and Authorization

The owner requested tasks, a dedicated apply executor and then a verifier with Playwright for every category. Continue automatically to verification, asking only on material scope/risk changes or oversized work units. The bounded local consolidation is authorized; creation of another database and Git delivery are not. The refined PRD is Product SSOT for this new focused change, which amends catalog browsing/taxonomy after the prior completed operational cutover, not its historical evidence.
