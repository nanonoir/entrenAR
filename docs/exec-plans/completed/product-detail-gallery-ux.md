# ExecPlan: Product detail gallery UX

## Objective

Keep long thumbnail collections bounded on desktop, place the full description below both detail columns, and isolate zoom to the active slide. Approved by the owner; mobile/tablet retain dots and existing touch navigation.

## Context

`ProductImageGallery` currently renders every thumbnail in an unbounded column and scales every uncontained slide together. `ProductDetailCard` places the full description inside the purchase column. Reuse `Button`, `useCarousel`, `useImageZoom` and existing visual fallbacks. Follow `docs/FRONTEND.md`; the primary agent implements directly and delegates independent review.

## Scope & Non-Goals

Only the two detail components, optional backward-compatible zoom hook extension, and focused tests. No backend/data/schema changes, new dependencies, carousel framework, lightbox, autoplay, new touch gestures, truncated descriptions or unrelated refactors.

## Decisions & Rationale

- Desktop starts at existing `lg` (1024px). Below this breakpoint retain dots; no thumbnail strip. Align rail and main viewer heights with shared responsive sizing.
- Native thumbnail scrolling, conditional up/down controls, boundary disabled states and automatic selected-thumbnail visibility. Reuse existing primitives rather than generalizing the home carousel.
- Exact non-shrinking slide widths with per-slide clipping; only active image zooms. Desktop fine-pointer tracking changes transform origin, with centered defaults and reset on image/variant change. Preserve existing touch zoom toggle/swipe behavior.
- Description follows the upper grid and spans the detail container, not the viewport. Bound embedded content and preserve every paragraph.
- Use React 19.2 Effect Events for variant-driven image synchronization without depending on unstable carousel callbacks; shared carousel behavior remains unchanged.
- Browser regression exposed an existing detail selector defect: structured variants ignored `selectVariant(id)` because the shared hook resolves option values first. Detail buttons now also call the existing `selectOption` API; no shared selection-hook refactor. Explicit selected variant identity resets zoom even when two variants share an image.

## Execution Plan

1. Record baseline DOM and reproduction; add focused regressions.
2. Implement bounded desktop rail, responsive layout, isolated zoom and description section.
3. Run type/lint/acceptance and browser tests for first/middle/last images, many/single images, variants, reduced motion, mobile/tablet, long embedded content and page overflow.
4. Delegate independent review, correct blockers, and delegate closure to archiver.

## Progress Tracking

- [x] Approved scope and baseline inspected before changes.
- [x] Reproduced: all seven slides scale to 1.5 on zoom; baseline screenshot stored privately in Temp/opencode/product-detail-before.png.
- [x] Implementation and focused regressions.
- [x] Static and live browser validation.
- [x] Independent review and fixes.
- [x] Archival and concise owner handoff.

## Validation

Use read-only public routes or isolated fixture responses; no database or user-session writes. Existing manual frontend/backend at localhost:3300 / 3228 remain available. Existing Playwright synthetic runner can be reused without altering source data. Proposed checks: `npx tsc --noEmit`, scoped ESLint, `npm run verify:frontend-acceptance`, focused Playwright suite. Log exact results, unexecuted checks and limitations here.

Executed:

- `npx playwright test --config tests/e2e/crm-showcase.config.ts`: **4/4 passed** (three new detail cases plus previous showcase regression), final run **26.7 seconds** after zoom-exit polish. Covers 13 portrait/square/landscape images, first/middle/last zoom and clipping, pointer origin and exit-anchor retention, rail bounds, structured variant image synchronization, full-width long description/image/table containment, widths 390/768/1023, dots/swipe, reduced motion and single-image keyboard toggle. Earlier red run reproduced structured variant selection failing before the detail handler used option values.
- `npm run verify:frontend-acceptance`: API default plus **16/16 harnesses passed**.
- `npx tsc --noEmit`: passed.
- Scoped ESLint for three application files, new E2E, fixture and config: **0 errors**, two pre-existing-rule warnings for continued raw `<img>` usage in the gallery. No image-pipeline/dependency changes made to silence these.
- `git diff --check`: passed.
- Private isolated live-browser context, real DULKRE product on localhost:3300: all seven images loaded; one active slide scales 1.5 while six remain 1, slides approximately 540px with individual hidden overflow. Description spans the same width as upper section and follows it. Mobile390/tablet768 retain seven dots, no rail, no horizontal page overflow, no page errors. Private screenshots `Temp/opencode/product-detail-after-{desktop,tablet,mobile}.png`.
- Only launcher-owned servers paused for fixture runner to avoid shared `.next` contention and restored afterwards. Frontend3300/backend3228 and admin proxy checked healthy; no catalog, auth or commercial writes.
- Browser interaction is Chromium emulation, not a claim of physical touch-device testing. Production build/backend suites not required for this localized component-only change; prior build evidence belongs to its separate plan.

## Implementation Outcome

### Implemented

- **`ProductImageGallery` (`src/components/shop/products/ProductImageGallery.tsx`)**: Desktop (`lg`: 1024px+) bounded vertical thumbnail rail with native scrolling, conditional up/down controls, disabled boundary states, and automatic selected thumbnail visibility via smooth scrolling. Mobile and tablet viewports maintain existing dot indicators and touch swipe navigation unchanged. Main viewer employs strict per-slide clipping and exact sizing so that only the actively selected slide scales to 1.5 zoom level while non-active slides remain at scale 1. Desktop fine-pointer coordinates adjust transform origin dynamically with centered fallback, and zoom state resets on active image or variant change. Transform origin anchor is retained during zoom-out exit transitions.
- **`ProductDetailCard` (`src/components/shop/products/ProductDetailCard.tsx`)**: Reorganized layout to place full product description beneath both columns, spanning the full container width without viewport breakout. Preserves all paragraphs and applies containment formatting for rich media (tables, embedded images, long text blocks). Integrated React 19.2 Effect Event pattern for synchronized variant-driven image selection. Fixed structured variant button handler by dispatching to the existing `selectOption` API directly without modifying the shared selection hook.
- **`useImageZoom` (`src/hooks/useImageZoom.ts`)**: Preserved backward compatibility while providing pointer origin coordinates and zoom reset capabilities.
- **Test Harnesses & Regressions (`tests/e2e/product-detail-gallery.spec.ts`)**: Added focused Playwright suites validating edge cases across 13 images with varying aspect ratios, multi-breakpoint layouts (390px, 768px, 1023px, desktop), reduced-motion support, keyboard toggles, and variant synchronization.

### Deviations from Design

- **Variant Selector Dispatch**: During test regression execution, structured variants were observed to ignore `selectVariant(id)` because the shared hook expects option values first. The detail component buttons were updated to call the existing `selectOption` API directly. This avoided introducing an out-of-scope refactor into the shared selection hook.
- **Zoom-Exit Origin Retention**: Retained the last pointer transform origin during the scale-down exit transition instead of snapping immediately to center, preventing visual jumpiness before re-centering on subsequent interaction.

### Validation

- Full fixture Playwright suite: **4/4 passed** in 26.7s (`tests/e2e/crm-showcase.config.ts`).
- Frontend acceptance test harness: **16/16 passed** (`npm run verify:frontend-acceptance`).
- Static type checking: `npx tsc --noEmit` passed with 0 errors.
- Scoped ESLint check: 0 errors across modified application files, tests, and configurations (2 pre-existing raw `<img>` warnings retained).
- Git diff verification: `git diff --check` clean.
- Real product manual runtime validation: Verified on localhost:3300 with product `DULKRE7` (all seven images loaded, isolated 1.5 zoom, full-width description below, mobile/tablet 7 dots with no overflow and zero console errors; screenshots saved privately in Temp/opencode).
- Independent review status: **PASS** (original implementation and final zoom-exit delta verified without blockers).

### Follow-up

- Optional reviewer suggestion regarding pointer event rAF throttling was assessed; profiling showed no performance bottleneck or dropped frames, and no technical debt was introduced.
- Launcher-owned background servers on localhost:3300 and localhost:3228 were preserved in healthy running state.
