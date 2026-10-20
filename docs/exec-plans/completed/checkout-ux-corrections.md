# Checkout UX corrections

## Objective
Implement the approved customer checkout corrections using the canonical checkout-ui-flow, checkout-quote and commerce-shipping specifications.

## Context
Technical decisions: [checkout inputs, drafts and delivery](../../design-docs/2026-10-19-checkout-inputs-drafts-delivery.md). Existing checkout conflates pending shipping with free shipping, selects services by provider identity, and requests quotes while address values change. Form drafts are not retained.

## Scope & Non-Goals
Correct page typography, field validation timing, quote lifecycle, draft recovery, national geography, service identity/modality, provider labels and configured tariffs. Preserve pickup as a separate delivery modality. No payment/email integration, unrelated cleanup, seeds, resets or unreviewed migrations. Preserve existing local environment changes and recordings. Git publication was authorized later and recorded in [the checkout delivery plan](./checkout-ux-delivery.md), then completed through PRs #197–#205.

## Execution Plan
1. Owner decisions (2026-10-19): Georef localities + manual format-validated CP with province recognition (CPA letter deterministic, CP4 only from verified correspondences, unknown never blocks); all paid shipping bands adjusted to non-round amounts above ARS 12,000. Exhaustive postal coverage must not be claimed.
2. Implement field blur/advance validation and typography; retain accessible field guidance and focus first invalid field on attempted advance.
3. Implement allowlisted expiring session drafts, hydration safeguards and successful-completion/explicit-clear cleanup; never restore quotes or completed flags as authoritative.
4. Implement province/locality lookup from verified complete snapshots and the approved postal strategy. Preserve numeric street names and postal ambiguity.
5. Use exact service IDs end to end, filter by delivery modality, reject incompatible selections server-side and show carrier brand distinctly from service.
6. Gate quote requests on committed relevant destination values; prevent stale responses from restoring outdated totals. Render pending/calculating/confirmed shipping states distinctly.
7. Implement approved merchant tariffs in authoritative configuration and fixtures. Any runtime changes require inspected destination, narrow dry-run diff, explicit applicable scope and verification; never reset commerce data.
8. Run focused regression tests, frontend acceptance, root/backend types, scoped lint and browser checks. Obtain independent review, fix findings and delegate final documentation reconciliation and plan archival.

## Decisions & Rationale
- Specs and design are authoritative; this plan tracks execution rather than duplicating behavioral rules.
- Session draft retention is limited to 24 hours; payment secrets are excluded by construction.
- Georef provides jurisdiction/locality coverage, not an exhaustive postal-code directory.
- Configured shipping prices are merchant prices, not official carrier quotations. Promotions and free pickup remain distinct from paid-shipping base rates.

## Progress Tracking
- [x] Investigate current implementation and existing contracts.
- [x] Update canonical specs and document technical design.
- [x] Create execution plan.
- [x] Resolve postal strategy and tariff authorization (owner decisions recorded above; docs updated before code).
- [x] Implement and validate correction units (automated checks and isolated browser checks passed).
- [x] Independent review and fixes.
- [x] Reconcile documentation and archive plan.

## Validation
Run focused tests for blur versus typing, attempted advance, draft expiry/privacy/recovery, geographic lookup, service selection, modality rejection, quote freshness and pending shipping. Run `npm run verify:frontend-acceptance`, root/backend TypeScript and relevant checkout/commerce backend tests. Browser checks cover desktop/mobile typing, refresh, delivery switches and accurate shipping totals. Record commands and outcomes during execution; do not claim checks not performed.

## Implementation Outcome

### Implemented

The approved checkout UX corrections and shipping configuration were fully implemented across storefront and backend modules:

- **Typography & Heading Tokens**:
  - Replaced undefined `font-title` with the established Bebas Neue heading token (`font-heading`) across cart review and checkout headings, aligning with storefront typography.

- **Field Validation Timing & Interaction**:
  - Replaced premature per-keystroke errors with blur-scoped validation on all checkout fields.
  - Typing updates values and clears visible error states without triggering full-form validation or global alerts.
  - Step continuation and finalization validate all section fields, display accessible helper text with `aria-invalid` / `aria-describedby`, and automatically focus the first invalid field.
  - Preserved numeric street names ("9 de Julio", "Ruta 2", "Avenida 14") with length limits (≤200 chars, at least one letter) via `sanitizeStreetInput` and `isValidStreetName`.
  - Added structured optional `floor` (≤80 chars, letters/digits/`. , / # - °`) and `neighborhood` (≤120 chars, alphanumeric like "Barrio 31", "1-11-14") with accessible blur error handling.

- **Session Draft Recovery & Privacy Guardrails**:
  - Implemented client-only session storage helper using key `entrenar-checkout-draft:v1` with a strict 24-hour expiration window.
  - Strict allowlist: identification (email, name, DNI, phone), address (province, locality, CP, street, number, floor, neighborhood, recipient), and selection intent IDs (modality, exact shippingMethodId, providerId, pickupPointId, paymentMethodId).
  - Explicit exclusion: credit card numbers, CVVs, tokens, passwords, transfer proofs, auth credentials, and authoritative quotes or totals.
  - Safe hydration: reads draft after component mount, guarding against overwriting stored drafts with initial empty states; restores values as untrusted intent starting at Identificación without completed flags.
  - Lifecycle cleanup: automatically purged on confirmed order completion, explicit cart clear, or customer sign-out.

- **Argentine Geographic Reference Data & Postal Strategy**:
  - Provided all 24 jurisdictions (23 provinces + CABA) with versioned official Georef v2.1 snapshots (4,000+ official localities) loaded on demand.
  - Locality combobox supports keyboard and mouse search, accent folding, and offers a retryable manual locality fallback.
  - Format-validated postal code handling: accepts legacy 4-digit CP or 8-character CPA. CPA first letter deterministically maps to all 24 provinces (ISO 3166-2:AR).
  - GeoNames-derived CP4 lookup table (`cp4-province-table.generated.ts`, CC BY 4.0): maps 1,853 single-province values; omits 123 multi-province ambiguous codes (which fall back to manual province entry without blocking checkout). CABA is recognized numerically solely via the explicit `1406` entry.
  - Postal values are treated as unverified intent and never labeled as "verificado" or claimed as exhaustive carrier coverage.

- **Delivery Service Identity, Modality Filtering & Carrier Branding**:
  - Used exact `shippingMethodId` (with matching `shippingProviderId` metadata) as unique selection identity across quoting, completion, and CRM adapters.
  - Home delivery cards strictly display services with `modality === "home_delivery"`, filtering out branch pickup services.
  - Prominent carrier branding (**Correo Argentino** / **Andreani**) displayed alongside established local logos; ETA and service descriptions are secondary.
  - Pickup remains a distinct delivery modality using quoted `pickupPoints` and `pickupPointId`.

- **Quote Lifecycle & Summary Presentation**:
  - Raw address typing does not trigger quote requests. Destination values are committed only on valid field blur or successful step continuation.
  - Non-pricing address fields (`street`, `floor`, `neighborhood`, `recipient`) do not trigger quote recalculations.
  - Dedicated shipping presentation states: unselected ("A calcular"), pending refresh ("Calculando…"), unavailable, and confirmed quoted.
  - Incomplete quotes or unselected delivery never display "Gratis"; free delivery requires an actually selected valid service or pickup point with zero quoted cost. Pre-delivery total is explicitly marked as provisional.
  - Restored selection intent is sent with the initial quote; `SHIPPING_OPTION_UNAVAILABLE` triggers a single nominal fallback to an unselected quote without infinite retry loops.
  - `CouponBox` integrates directly with the quote lifecycle using committed destination and exact service/pickup IDs. Server-confirmed coupons are carried into subsequent quotes and final completion; rejected coupons are cleanly discarded with localized Spanish error messaging (handling 409 conflict, usage limit, and expiration codes).

- **Structured Address Backend & CRM Propagation**:
  - Backend `checkoutAddressSchema` and OpenAPI DTOs accept additive optional `floor` and `neighborhood`.
  - Persisted inside the order's `shippingAddressSnapshot` JSON without requiring database migrations.
  - Projected cleanly to CRM sales detail (`SaleAddress.neighborhood`, order views) and preserved during CRM address edits.

- **Authoritative Merchant Tariffs & Database Patch**:
  - Baseline fixtures (`catalog-commerce-baseline.ts`), seeder, restorer, and CRM defaults updated so all paid shipping provider weight bands have non-round costs strictly greater than ARS 12,000.
  - Local database `127.0.0.1:5432/entrenar` updated via authorized narrow patch tool `shipping-tariff-patch.main.js --apply`, updating 10 `WeightBand.cost` rows within a single transaction after target fingerprint verification. Re-runs confirmed idempotent state. Zero general seeds, resets, or migrations were run.

### Deviations from Design

`None`. The implementation strictly followed the technical design and owner decisions of 2026-10-19. Feedback and findings identified during independent review were resolved cleanly within the approved scope:
- Retaining digits in street and neighborhood names (`sanitizeStreetInput`/`isValidStreetName`, `sanitizeNeighborhoodInput`/`isValidNeighborhood`).
- End-to-end propagation of structured `floor` and `neighborhood` fields into `shippingAddressSnapshot` JSON and CRM views without schema migrations.
- Direct quote lifecycle binding for `CouponBox` with canonical destination and exact IDs.
- Single-shot nominal fallback on unavailable restored options without retry loops.
- Localized Spanish error messaging for coupon conflict and validation failures.
- GeoNames-derived CP4 lookup table with explicit documentation of data boundaries and limitations.

### Validation

- **Independent Review**:
  - Review session `ses_ead7d5577ffe2aD4gMxbBDcZ0o` concluded with PASS WITH FINDINGS.
  - All must-fix findings were resolved and independently verified.

- **Automated Tests & Quality Checks**:
  - Root TypeScript check: `npx tsc --noEmit` passed with 0 errors.
  - Backend TypeScript check: `tsc -p backend/tsconfig.json` passed with 0 errors.
  - Frontend acceptance test harness: `npm run verify:frontend-acceptance` passed (22/22 harnesses, including checkout form, summary, quote-builder and cart-store regressions).
  - Backend checkout tests: `npm test backend/src/modules/checkout` (6 suites, 19 tests passed).
  - Backend commerce shipping tests: `npm test backend/src/modules/commerce/shipping-tariff-patch.spec.ts` (2 suites, 11 tests passed).
  - Scoped ESLint check: 0 errors across touched frontend and backend files.

- **Isolated Browser Flow Validation**:
  - Executed in session `ses_ead20753dfferMUAPuAzvPKSa0` using Playwright Chromium targeting the existing dev server on port 3000 (owner PID untouched).
  - All backend HTTP requests to port 3001 were intercepted and mocked fail-closed; zero unmocked requests reached live backend services.
  - Verified: typing without premature error alerts, blur-scoped validation displaying accessible helper text, section continuation and error focusing, draft preservation across page refresh, locality combobox keyboard and mouse interaction, postal code recognition (CP 1406 CABA), coupon 409 conflict handling and retry, pickup point and payment method error states, Bebas Neue heading typography rendering.
  - Passed cleanly. Zero orders created, zero payment charges made, zero emails sent, zero database writes executed during browser verification.
  - Scope boundaries: Browser verification did not test mobile viewports, authenticated customer sessions, manual bank transfer upload flows, or unmocked real backend integration.

### Follow-up

- **Technical Debt Tracked (`docs/exec-plans/tech-debt-tracker.md`)**:
  - Item 10: Partial Argentine postal code coverage (GeoNames CP4 / CABA postal directory gap; only 1406 CABA recognized numerically, 123 multi-province ambiguous codes omitted, manual fallback; no guessed ranges or claims of official carrier datasets).
  - Item 11: Pre-existing account saved addresses (`UserAddress`) lack structured `floor` and `neighborhood` columns; non-blocking for current inline checkout wizard, but requires schema migration before future saved-address checkout integration.

- **Operational & Runtime Guidance**:
  - Backend runtime source code has changed; running local backend environments may require a rebuild (`npm run build:backend`) or restart of the NestJS server process to reflect current code.
  - Tariff patch was executed against local database `127.0.0.1:5432/entrenar` only; safe, not claimed as deployed.
- Delivery completed through PRs #197–#205; each authored code/test diff remained within 600 lines. Remote `main` received the nine implementation/test PRs in order. The local tariff update was already applied in the authorized implementation session and was not rerun. Excluded pre-existing work (`backend/src/main.ts`, the unrelated `dotenv` hunk in `backend/package.json`, the unreviewed migration, recordings and prior session report) remains outside those PRs.
