# Storefront implementation evidence — 2026-10-09

Scope: ExecPlan workstream 3 only, against the approved PRD and technical design. No backend/manifest changes, database writes, generator invocation, source repairs or commits. Follow-up verification used task-owned, temporary loopback fixture servers; all were stopped.

## Implemented

- Pure discovery selectors use mapped existential variant availability; summary cards use the backend stock projection. Related products rank direct canonical category ID intersection before normalized nonempty real brand, then deterministic ID, excluding current/depleted/duplicate products and stopping at four without arbitrary fill. Only legacy records with absent canonical memberships use exact category slugs.
- API preserves explicit false flags with nullish fallback and leaves absent brand empty. Home and detail obtain complete fresh public reads; errors are not converted into empty recommendations.
- Both ProductCard densities display static “Sin stock” text in the price/body area, separate from image shipping and promotion labels. Detail links and existing buy/backend validation remain intact.

## Executed validation

| Command | Result |
| --- | --- |
| `npm run verify:frontend-acceptance` | Passed: API defaults and 16 harnesses. Discovery covers canonical/legacy/empty memberships, category-over-brand ordering, normalized brand, no arbitrary fill, current/duplicates/depleted exclusions, cap, multi-variant, infinite and re-evaluation after depletion. Adapter checks explicit false/absent brand and category affinity beyond page one. Card SSR checks both densities, stock labels, detail links and no static live announcements. |
| `npx tsx tests/harnesses/product-card.harness.tsx` | Passed. |
| `npx tsc --noEmit` | Passed, including final test additions. |
| `npx eslint "src/lib/product-discovery.ts" "src/lib/api/catalog/catalog-api.repository.ts" "src/lib/api/catalog/catalog-adapter.harness.ts" "src/lib/data/shop-routes.ts" "src/app/(shop)/page.tsx" "src/components/shop/products/ProductCard.tsx" "tests/harnesses/product-discovery.harness.ts" "tests/harnesses/product-card.harness.tsx" "tests/harnesses/frontend-acceptance.harness.ts"` | Passed without warnings/errors. |
| `npm run lint` | Failed outside scope: `backend/src/modules/catalog-cutover/catalog-cutover.spec.ts` lines 203 and 215, `@typescript-eslint/no-non-null-asserted-optional-chain`; 72 other existing warnings. No unrelated fixes made. |
| `git diff --check` | Passed; Git emitted CRLF normalization warnings only. |

An initial new harness assertion assumed a fixture bestseller flag was absent; the fixture already had it. Corrected the expected available infinite bestseller; final acceptance run passed.

## Browser follow-up: completed with synthetic fixtures

The earlier port-3000/MCP-runner limitation was overcome with dedicated processes, without touching the unrelated application. `tests/fixtures/crm-showcase-server.ts` reuses the existing synthetic product baseline, exposes public catalog-shaped responses on literal loopback 3218, and starts Next on 3217. All fixture state is in memory. Catalog reads use API mode with explicit fixture URLs; commerce/checkout use existing mock mode. No backend, database client or commercial writer is imported.

Manual launch used a hidden detached process (`windowsHide`, redirected temp log) and a bounded readiness loop. Log reported ready in 3.8 seconds. MCP navigated Home → product detail and category listing, observing the real ARIA structure before authoring the test.

Reusable command: `npx playwright test --config tests/e2e/crm-showcase.config.ts`.

Final standalone run: **1 passed (15.1s)**, including fresh process start and teardown. Test covers:

- Home excludes the depleted flagged product, includes a product with one surviving variant and infinite stock.
- Real detail navigation shows ordered category candidates before brand-only candidate, no self/duplicates/arbitrary unrelated fill.
- Depleting the surviving variant via the in-memory fixture control removes that product from detail recommendations after reload and from Home on a new navigation. Infinite stays eligible; related count falls to three without arbitrary fill.
- General listing retains all seven synthetic products and stock labels. The depleted product link opens its real detail and existing add-to-cart is disabled.
- Both density implementations render in Chromium with the live app stylesheet at 1440 and 390 widths. Standard density has no depleted live-route consumer, so this portion loads actual SSR ProductCard fixture markup, not a new production route. Assertions check visible text, detail links, no live announcement, no stock/shipping/promotion overlap and WCAG contrast ratio >= 4.5. Available/infinite cards have no depleted badge. Real route navigation has no uncaught page errors.

Final follow-up also reran `npx tsc --noEmit`, scoped ESLint on the three new test/fixture files and updated card harness, and `npm run verify:frontend-acceptance`: all passed (16 harnesses). One standalone runner attempt initially failed because Playwright's config-relative working directory resolved the fixture path incorrectly; explicit repository cwd fixed it, and final standalone runs passed.

Visual artifacts are outside the repo under `%TEMP%/opencode/`: `crm-storefront-home.png`, `crm-storefront-related.png`, `crm-storefront-listing-mobile.png`, `crm-storefront-cards-1440.png`, `crm-storefront-cards-390.png`; manual log `crm-storefront-process.log`. Desktop card screenshot was inspected: visible dark stock badges with white text separate from shipping and sale labels. Fixture cards use realistic constrained dimensions; the initial unconstrained screenshot was replaced, not treated as visual proof.

Cleanup: stopped only the recorded manual fixture process tree (PID 15980) using bounded taskkill. Standalone config then started/stopped its own fixture process tree. Bounded fetch probes after final execution confirmed **3217 closed / 3218 closed**. No changes to the unrelated port 3000 process. The two artifacts from the previous attempt (snapshot and unrelated-app HMR console log) plus five artifacts from this follow-up were task-generated and removed from `recordings/`; no recording artifacts are retained as deliverables.

## Remaining limitations

- This is real browser verification over synthetic API fixtures, not proof of backend visibility enforcement, inventory persistence, checkout concurrency, authenticated CRM or real stock mutation. The source PII/configuration gates remain blocking for those independent validations.
- Standard-density fixture markup is SSR-only; live Home/detail/listing are hydrated Next routes. No new product behavior or production test route was introduced.
- Existing Next image-aspect warning for `logoWhite.svg` remains outside scope; no uncaught page errors occurred.
- Independent review and overall plan closure belong to the coordinating workstream. No unresolved product/architecture decisions were introduced.
