# Frontend Specification: Catalog Listing and Taxonomy Alignment

## Design Read

- **Subject:** Browsing sports supplements, apparel, and training equipment by category and brand.
- **Audience:** Shoppers comparing a broad, real catalog on desktop and mobile.
- **Primary Job:** Find eligible products with trustworthy counts, usable filters, sorting, and access to every result.
- **Visual Character:** Preserve EntrenAR's existing direct, energetic storefront: strong dark display headings, restrained accent color, white surfaces, and recognizable product cards.
- **Density:** Balanced; listing controls are compact while products remain visually legible.
- **Composition:** Existing shop navigation above a clear listing heading and result count; desktop filter rail alongside the product grid, mobile controls kept reachable without displacing products.
- **Motion Posture:** Restrained, interaction-driven; no decorative motion.
- **Constraints:** Keep existing responsive layout, primitives, accessibility, professional Spanish labels, product card treatment and route conventions. No redesign, new brand identity, generated imagery, or brand-management UI.

## Design Principles

- Treat truthful catalog scope as part of visual trust: totals and facet counts represent unique products across the eligible result set, not just the current page.
- Preserve familiar category and brand browsing rather than introducing a new navigation metaphor.
- Make selected filters, current page, and sort choice legible and reversible.

## Visual System

### Color
- Background: Existing storefront page background.
- Surface: Existing white listing/filter surfaces.
- Primary text: Existing text and heading tokens; dark, high-contrast display type.
- Secondary text: Existing muted text token for counts and supporting information.
- Accent: Existing accent token for selected controls and primary actions.
- Borders/supporting tones: Existing border and neutral tones; no new palette.

### Typography
- Display: Existing heading family (`font-heading`) for the listing title.
- Body: Existing storefront body family; `font-subtitle` for compact control headings where already used.
- Hierarchy: Listing title first, unique result count second, controls third, product grid primary content. Keep count text concise.
- Alignment / line-length guidance: Left-align listing content; allow long category/brand names to wrap without clipping.

### Shape & Surface
- Radius: Preserve existing button/card radius tokens (`rounded-button`, `rounded-card`).
- Borders: Existing subtle border token separates filter groups and controls.
- Shadows: No new elevation; preserve current shop shell and primitive treatments.
- Texture / material: Flat, clean storefront surfaces; no gradients or glass effects.
- Image treatment: Use existing catalog product imagery/card visuals only; do not add category or brand hero imagery.

## Page / Screen Structure

### Public category, subcategory, brand, and offers listings

#### Listing header and controls
- **Purpose:** Orient shoppers and communicate the complete number of matching unique products.
- **Content:** Context title; localized product count; filter and sort controls; active filter state where applicable; pagination with current position and reachable pages.
- **Composition:** Keep the existing heading/count above the results. Desktop sorting and count remain adjacent to the heading area; pagination is clearly associated with the grid and available before/after results as appropriate to the established pattern.
- **Primary Action:** Open filters on mobile; choose a sort or page.
- **Asset:** None.
- **Responsive Intent:** Desktop uses the existing listing header/toolbar. Mobile wraps controls without horizontal overflow and retains clear access to sort, filters, and page navigation.

#### Filter controls
- **Purpose:** Narrow results by supported price, brand, category, and subcategory facets.
- **Content:** Existing labeled controls and facet counts; selected values; clear action. Facet counts reflect the full eligible scope and unique products, not only the current page. Keep valid zero-count public categories discoverable as listings, not as missing routes.
- **Composition:** Desktop filter rail beside the grid; mobile uses the established filter drawer. Preserve grouped disclosure controls and visible selection/focus states.
- **Primary Action:** Apply a filter; “Limpiar” clears selected listing filters.
- **Asset:** None.
- **Responsive Intent:** Desktop rail remains readable and independently scannable. Mobile drawer supports touch and keyboard, keeps its action reachable, and does not obscure its own scrollable options.

#### Product results and pagination
- **Purpose:** Present every eligible result across stable, navigable pages.
- **Content:** Existing product cards, truthful total, and page navigation. Empty matches remain a valid listing with a clear explanation and filter-reset action.
- **Composition:** Preserve the current two-column mobile / four-column large-screen product grid. Pagination must not look like an unrelated module and must identify the active page and disabled boundaries.
- **Primary Action:** Open a product; move to another result page.
- **Asset:** Existing product-card assets only.
- **Responsive Intent:** Preserve grid columns and card behavior; pagination controls wrap or compact without losing labels, focus, or tap targets.

### Brand directory (`/marcas`)

#### Public brand index
- **Purpose:** Help shoppers discover brands with public catalog products.
- **Content:** Available brand names as canonical links; do not add CRUD, editorial claims, or unsupported brand metadata.
- **Composition:** Reuse the storefront's listing typography, spacing, and surface language. Give brand names clear link hierarchy without inventing logos or equal-card decoration.
- **Primary Action:** Open a canonical brand listing.
- **Asset:** None required; use brand marks only if already available and associated with the brand.
- **Responsive Intent:** Desktop presents a scannable index; mobile reflows links into a readable, touch-friendly arrangement with no horizontal scrolling.

#### Brand listing and aliases
- **Purpose:** Show a brand's complete paginated product catalog.
- **Content:** Canonical brand title, unique total, shared listing controls/grid/pagination. Resolvable aliases land on the canonical route; unknown brands retain not-found behavior.
- **Composition:** Identical listing hierarchy to category results; no separate visual template.
- **Primary Action:** Filter, sort, paginate, or open a product.
- **Asset:** Existing product-card assets only.
- **Responsive Intent:** Same listing adaptations as above.

## UI States

| Surface | Required States | Intent |
|---------|-----------------|--------|
| Listing route/data | loading, populated, valid empty category, filtered no-match, controlled error, not-found unknown brand/product | Loading preserves layout; empty is distinct from failure and offers a relevant next step; failures never appear as empty or false 404. |
| Filter and sort controls | default, selected, hover where supported, keyboard focus, disabled boundary, applied/cleared | Selection is apparent and controls remain operable without pointer. |
| Pagination | default, active page, first/last boundary, loading/navigation | Current page and boundaries are clear; page changes retain applicable filters and sort. |
| Brand index | loading, populated, empty/error if data source yields them | Do not fabricate brands; explain the state plainly. |
| Legacy shaker URL | redirect | No obsolete-category empty/error screen; old storefront URL resolves to `/shakers`. |

## Responsive Behavior

### Desktop
Keep the existing horizontal shop navigation, listing header, 280px-class filter rail pattern, and four-column grid. Counts, sort, pagination, and controls must remain visible and aligned without compressing product cards.

### Tablet
Retain storefront navigation conventions; adapt the filter/grid balance before reducing card legibility. Controls may wrap; maintain clear count and sort hierarchy.

### Mobile
Use the existing filter and sort drawers, preserve the two-column grid, keep the drawer action visible, and ensure pagination/brand links wrap naturally. No horizontal overflow; keyboard focus and touch targets remain clear.

## Motion & Interaction Intent

### Filter and sort changes
- **Trigger:** Shopper toggles a facet, applies price, or chooses a sort.
- **Purpose:** Confirm that the control was accepted and results are updating.
- **Expected Feel:** Immediate, restrained feedback; avoid animating repeated option changes.
- **Communicates:** Selected state and resulting listing context remain synchronized with the URL.
- **Reduced Motion:** Preserve state and feedback without movement.

### Mobile filter/sort drawers
- **Trigger:** Shopper opens or dismisses a drawer.
- **Purpose:** Preserve spatial relationship to its control while exposing options.
- **Expected Feel:** Crisp and reversible, consistent with existing drawer behavior.
- **Communicates:** The shopper is in a temporary controls surface; dismissal returns to the same listing context.
- **Reduced Motion:** Remove positional movement while retaining clear open/closed state and focus behavior.

## Assets

| Asset | Role | Format / Ratio | Notes |
|-------|------|----------------|-------|
| Existing product catalog imagery | Product identification in existing cards | Existing source ratios/crops | No new media or generated placeholders. |
| Brand marks, if already present | Optional recognition on brand index | Existing asset ratio | Never required; do not fabricate missing marks. |

## Interface Writing

- **Primary CTA:** “Ver productos” in the existing mobile filter drawer; page controls use concise labels such as “Anterior” and “Siguiente”.
- **Secondary CTA:** “Limpiar” for clearing listing filters.
- **Terminology:** Use “Marca”, “Categoría”, “Subcategoría”, “Precio”, “Ordenar por”, and “productos”; canonical route labels remain shopper-friendly Spanish.
- **Error / Empty State Tone:** Professional and direct. Distinguish “No encontramos productos con esos filtros” from a catalog-loading error; explain that the user can retry or adjust filters where appropriate.

## Anti-Slop Constraints

- Do not add a generic centered hero, promotional banner, or invented brand story to the directory/listings.
- Do not style every brand as an identical decorative card or add logos/metadata that do not exist.
- Do not present page-local counts as total counts or descendant sums as unique products.
- Do not turn API failures into empty states or missing-category 404 pages.
- Keep the shaker canonical route and redirect behavior; do not reintroduce the obsolete category in navigation or filters.

## Visual Acceptance Criteria

- [ ] Listings and `/marcas` visibly belong to the existing EntrenAR storefront and reuse its established hierarchy and primitives.
- [ ] Unique totals, complete-page reachability, facet counts, active filters, sort, and current page are legible.
- [ ] Every public category, including valid empty categories, has an intentional listing state; failures remain visibly distinct.
- [ ] Brand links are canonical; resolvable aliases redirect and unknown brands remain not-found.
- [ ] Desktop, tablet, and mobile preserve readable product cards, usable controls, and accessible focus/touch behavior without overflow.
- [ ] Loading, empty, no-match, error, selected, disabled, and success/navigation feedback states are represented.
- [ ] Motion communicates interaction/state only and respects reduced-motion preference.
- [ ] UI copy is professional Spanish and terminology is consistent.
- [ ] No changes imply brand CRUD, new imagery, promotional strategy, or database mutation visuals beyond the approved scope.
