# Design: Checkout Inputs, Draft Recovery and Delivery Selection

Keep the existing checkout orchestration and server-authoritative quote/complete flow. Add field-scoped blur validation, a short-lived session draft, official searchable geographic reference data, and exact shipping-service selection. Geographic reference data is not shipping coverage or postal verification. Complete nationwide postal lookup remains a pending dependency, not something the two checkout fixtures can satisfy.

Status: reconciled with the updated specifications; owner decisions of 2026-10-19 resolved the postal strategy (Georef localities + manually entered, format-validated CP with province recognition) and authorized merchant tariff adjustment of all paid bands. Implementation completed, reviewed (PASS WITH FINDINGS, all resolved), and validated. Comprehensive CP/CPA discovery/verification remains an undelivered, documented gap.

## Authority and current context

- [Architecture](../../ARCHITECTURE.md) owns frontend/API/backend boundaries and monetary authority.
- [Frontend conventions](../FRONTEND.md) explicitly defer migration of legacy checkout manual state to a dedicated refactor. This focused correction does not migrate the entire wizard to RHF or add a second form-state owner.
- [Checkout UI flow](../product-specs/checkout-ui-flow/spec.md) owns presentation, validation timing, draft privacy, searchable geography and the explicit unfulfilled postal requirement. [Checkout quote](../product-specs/checkout-quote/spec.md), [complete](../product-specs/checkout-complete/spec.md), and [commerce shipping](../product-specs/commerce-shipping/spec.md) own transactional behavior and configuration, including exact service selection and the pending tariff inputs.
- [Original UI design](./2026-06-03-checkout-flow.md) describes the historical mock-only phase; its mock-only limitations do not govern the updated integrated UI spec. [Backend checkout design](./2026-09-03-backend-core-phase-5-checkout.md) continues to describe server responsibilities; this document supplements it, with current product specs authoritative for behavior.

Observed code:

| Area | Current issue |
|---|---|
| `use-checkout-form-state.ts` | Manual values/errors; no blur callback or draft; province/city eligibility depends on `checkoutPostalCodeLocations`. |
| `DeliveryAddressForm.tsx` | Unknown fixture CP produces an error while typing and hides city selection. |
| `use-checkout-quote-lifecycle.ts` | Effect depends on the whole delivery form; fingerprint includes partial postal/city values. |
| `delivery-options.utils.ts` | Service identity collapses to provider ID; provider-or-service matching can select several cards; no home-modality filter. |
| `CheckoutSummary.tsx` | A quote with no delivery selection has shipping zero and becomes “Gratis”; free-shipping preview can do the same. |
| `CheckoutDeliveryRules` | Already returns service ID, provider ID and modality, validates explicit `shippingMethodId`, and calculates weight-band prices from Commerce. No selection legitimately returns zero for an incomplete quote. |

## Validation ownership and timing

Extend the existing form-state facade with identification/delivery field blur callbacks. Reuse a single field-rule source in `checkout-form.validators.ts` for both field validation and whole-section validation; do not duplicate rules in JSX.

| Event | Behavior |
|---|---|
| Initial render or draft restoration | No touched state, red borders, completion flags or validation messages restored. |
| Change | Update the value and invalidate dependent completion. Clear the edited field's visible error without running validation or raising a global alert. |
| Blur | Validate only that field against the current values; show its localized message, red border, `aria-invalid` and linked error text. |
| Continue | Validate the entire current section, expose every relevant field error, and keep the current step on failure. |
| Finalize | Validate all required sections and delivery/payment configuration before the existing refresh/complete flow. Reveal the first failing section; do not silently submit invalid hidden fields. |

Selection/configuration errors belong to their delivery/payment group, not an unrelated postal-code or street field. Operational quote/complete errors retain the existing summary notice. Geography loading/failure is a status/retry state, not an “invalid postal code” validation message. Preserve the shared `Input` primitive's existing error styling and accessibility; wire optional fields' errors too.

## Session draft: values, not authority

Add a small client-only draft storage helper used by `useCheckoutFormState`, independent of the persisted cart. Use `sessionStorage` key `entrenar-checkout-draft:v1` and an envelope `{ version, createdAt, expiresAt, values }`. Expiry is 24 hours from creation, not extended indefinitely by edits. Storage access and JSON/schema failures must degrade to an in-memory checkout.

Explicit allowlist:

- Identification: email, first name, last name, DNI, phone.
- Address: province ID/name, locality ID/name, postal code, street, number, floor/department, neighborhood, recipient.
- Intent: home/pickup, exact shipping method ID/provider ID, pickup point ID, payment method ID only.

Never serialize arbitrary form/store objects. Exclude card data, CVV, account credentials, payment tokens, bank proof/files, authentication/checkout session tokens, idempotency keys, quotes, totals, errors, touched state, active/completed steps and order completion.

Read after mount, validate version/types/expiry/string limits, then enable draft writes. Do not overwrite a valid stored draft with initial empty values during hydration. Store only allowed changed values; a trailing short write delay is acceptable only with a synchronous flush on blur and `pagehide` so refresh preserves the last input. No server-rendered storage-dependent branches.

Restore all values as untrusted intent. Start at identification, with no completed steps, and resolve stored service/point IDs against the next authoritative quote. Do not persist provider/point display objects. Clear the draft on confirmed order success, explicit `clearCart`, and logout/account-identity switch; ensure cleanup works even when the wizard is unmounted. Do not clear on initial empty pre-hydration cart, quote reconciliation, checkout-state invalidation or a failed submission. Prevent delayed writers from recreating a cleared draft.

Why session storage: refresh recovery without adding PII to the durable shared cart/localStorage payload. It is still readable by same-origin scripts, and closing the tab is not a guaranteed privacy mechanism in browsers with session restoration; expiry and explicit cleanup remain necessary. Do not log draft payloads.

## Geographic data and postal-source boundary

### Resolved: official geography, searchable and independent of CP fixtures

Use Argentina's official Georef **v2.1**, not the retiring v1.0. Provide 24 jurisdictions (23 provinces plus CABA) and searchable localities scoped to the selected jurisdiction. Preserve stable source IDs and canonical display names; do not treat a city name as globally unique. Search may fold accents/case, but display and order payloads retain the official name. Map known CRM province aliases at the boundary rather than maintaining a competing 24-province list.

Prefer a checked-in, versioned reference snapshot, split by province and loaded on demand, over a live Georef dependency during checkout. An acquisition tool must consume every page until the reported `total` is satisfied, check unique IDs/parent jurisdiction, and retain source URL, retrieval date, record counts and checksum. Keep generated reference data separate from `src/lib/data/checkout.ts` fixtures. Expose a small location repository under `src/lib/data/locations/`; it reads static reference data, not NestJS business services. No Prisma tables, new geography microservice, Next.js proxy or live upstream request per keystroke is needed.

Province change invalidates the dependent locality choice and delivery completion. Postal-code change must not erase a valid independently selected city on each keystroke. Existing checkout builders send canonical province/city strings; source IDs are UI identity unless a separately reviewed backend contract requires them. A missing fixture entry must never assert that the merchant does not serve that address.

### Evidence and unresolved postal coverage

Sources inspected on 2026-10-19:

- [Official Georef overview](https://www.argentina.gob.ar/georef) identifies v2.1 and the v1 retirement.
- [Official API reference](https://www.argentina.gob.ar/georef/referencia-completa-de-la-api-georef-v-2) links the OpenAPI reference, although its embedded server label still says v2.0.
- Live `https://apis.datos.gob.ar/georef/api/v2.1/provincias?max=30` returned all 24 jurisdictions. Live `.../localidades?provincia=18&max=2` returned 2 of 76 Corrientes records with IDs, names and parent province; the returned locality records contained no postal codes.
- [Correo Argentino's official CPA lookup](https://www.correoargentino.com.ar/formularios/cpa) resolves **province + locality + street + height** and describes the eight-character CPA. It is evidence that one postal code per city is not a valid complete model. This investigation did not establish a documented reusable API or a licensed nationwide bulk postal dataset.

**Unresolved gap:** a legitimate comprehensive CP/CPA source. Correo Argentino states it issues no code listings and offers address normalization only as a corporate web service; the CP4 has had no official maintenance since 1974. Nationwide postal discovery/verification is therefore **not delivered**. Do not scrape undocumented form internals, infer numeric ranges, assign one CP per city, or label syntactically valid input “verified.”

**Decision (owner):** accept manual CP entry with format validation, plus province recognition:

- `src/lib/data/locations/postal-code.ts` parses a CP into `{ kind: "cp4" | "cpa", province? }`. CPA: first letter → ISO 3166-2:AR province (deterministic, documented on Wikipedia/ISO and the Correo CPA page). CP4: lookup in `verified-cp4-correspondences.ts`, an explicit table with per-entry provenance; absent entries return `unknown` (no ranges). Ambiguous entries are stored as multiple provinces and return `ambiguous`.
- Recognition output feeds province preselection and a contradiction error; it never feeds “verified” wording or delivery coverage. Unknown/ambiguous never blocks.
- Correction (post-review): CP4 → province coverage now comes from the [GeoNames Argentina postal dump](https://download.geonames.org/export/zip/AR.zip) (CC BY 4.0, credit: <https://www.geonames.org>), reduced by `scripts/generate-cp4-province-table.ts` into `cp4-province-table.generated.ts`. Measured on 2026-10-19: 20,260 rows, 1,976 distinct CP4 values; **1,853 single-province values are recognized** and **123 multi-province values are omitted** (they stay unknown and never block, so “ambiguous” is not stored as a multi-province set). The dump contains no Ciudad Autónoma de Buenos Aires entries; CABA is covered only by the explicit `1406` fixture entry, and any CP4 absent from GeoNames is unknown. This is partial, third-party, best-effort coverage: it is not an exhaustive or official postal directory, it carries no locality or street precision, and ranges are never inferred. Re-run the script on a fresh extract of `AR.zip` to refresh.

## Delivery identity, filtering and branding

Use `CheckoutShippingOption.id` as card key, radio value and sole service selection identity. Keep provider ID as metadata. Retain backend service IDs (including existing aliases) unchanged; do not rename `correo-argentino:paquetería-nacional` merely to change visible branding.

- Under home delivery, map only options with `modality === home_delivery`. Apply the same rule to explicitly selected mock mode; live API absence must not silently manufacture mock carriers or prices.
- Display the carrier name **Correo Argentino** / **Andreani** as primary label with the existing local logo. Service description/ETA is secondary, not a replacement brand.
- Carry both exact `shippingMethodId` and matching `shippingProviderId` through `buildQuoteOptions`, completion construction, config validation and mock adapter. No provider-wide selection equivalence. Restore old provider-only intent only when exactly one eligible home option resolves it; otherwise leave selection pending.
- Keep pickup as a separate supported method using `quote.pickupPoints` and `pickupPointId`. Filtering branch services out of **home** cards does not delete pickup/branch configuration, points or modalities globally, nor invent carrier branch addresses from service definitions.
- A selection missing from the latest matching quote becomes unavailable, invalidates delivery completion and requires reselection. The backend continues to reject invalid service/provider combinations.

The quote spec also requires controlled rejection of ineligible modality. Verify `deliveryType` and the exact selected service modality together at the backend boundary; frontend filtering alone is insufficient. Preserve distinct pickup validation rather than banning branch modalities globally. Provider-only compatibility must not resolve an ambiguous service on behalf of the client.

## Quote lifecycle and summary state

Create one canonical quote-input projection in the existing builders: cart line IDs/quantities, coupon/session ownership as already handled by the cart actions, committed destination values, delivery mode and exact selected service/point. Street/floor/recipient edits do not trigger quote refreshes because the current tariff uses weight/subtotal and pickup coverage uses province; the final completion still includes the current validated full address.

Keep raw edited address values separate from committed quote destination values. Commit destination on a valid field blur or successful Continue; selector changes commit immediately. Do not issue partial-CP requests on each keystroke. Pending raw destination changes invalidate delivery readiness; finalize validates and commits the latest values before refreshing. Dedupe on the canonical projection, not whole form object identity. Preserve existing stock/cart reconciliation and store request invalidation; only the latest request may update quote, notices or selected-option resolution. Coalesce simultaneous commits rather than adding a new independent request manager.

The UI needs an explicit derived shipping presentation state: **unselected**, **refreshing/stale**, **unavailable**, or **quoted**. This is not a new monetary authority or backend schema change.

- “Gratis” requires a current matching quote with an actually selected valid service/point and zero shipping. A quote with `{ type: none }` internally producing zero is not free delivery.
- Unselected delivery shows “A calcular”; pending refresh shows a neutral calculating state; stale amounts are not represented as current or used to enable completion.
- Use the accepted quote's subtotal, discount, shipping and total together. When shipping is unresolved, any shown subtotal-derived figure is explicitly provisional, not a confirmed final total.
- Cart-review/free-shipping progress may describe eligibility, but it cannot mark an unselected checkout delivery as free. Existing server thresholds/discounts still determine actual free shipping.

Use the existing `font-heading` token for checkout headings that currently reference undefined `font-title`; do not introduce a second font configuration or change global storefront typography.

## Merchant tariffs and runtime safety

Rates remain Commerce configuration consumed by `CheckoutDeliveryRules.shippingCost`, never frontend constants or claims of official carrier quotations. The owner authorized adjusting every paid band of every provider to non-round amounts above ARS 12,000, keeping existing weight bands. Amounts live in `catalog-commerce-baseline.ts` (`SHIPPING_PROVIDERS` band costs) as the canonical fixture and are applied to the existing database only by the narrow patch tool. Free-shipping thresholds, discounts and genuine pickup pricing remain distinct rules.

Runtime inspection (read-only, 2026-10-19): `DATABASE_URL` targets a local Docker PostgreSQL (`127.0.0.1:5432`, database `entrenar`, 82 existing orders). Andreani bands were uniformly 100; Correo Argentino bands were 7500/10500/15000/22000/30000, with a 75000 free-shipping threshold. Order snapshots are historical and unaffected by band changes.

Changing fixtures or seeds alone does not change existing runtime rates. If runtime adjustment is needed, use a narrowly scoped configuration patch tool: default dry-run; explicit destination identity and provider/band allowlist; expected current-value fingerprint; proposed before/after report; validation through existing Commerce range/cost rules; explicit apply mode; transactional failure with no partial update. Preserve schedules, statuses, modalities, thresholds, origins, unrelated providers/bands and historical order snapshots. Reject changed preconditions rather than overwrite concurrent admin edits. Never run a general seed/reset or bulk replacement as the correction mechanism.

**Risk gate:** the owner authorized the tariff change after the runtime destination was inspected (local development database). The patch touches only `WeightBand.cost` for the allow-listed IDs, inside one transaction, after a fingerprint match of the current values; a mismatch aborts. Dry-run output omits secrets and customer data.

## Remaining open items

- Comprehensive, legitimate postal-source access contract (undelivered; see the postal section). CP4 recognition is partial (GeoNames-derived, 1,853 values, no CABA beyond 1406); see the postal section.
- Quote lifecycle (post-review): the restored/kept selection intent is sent with the first quote; only a `SHIPPING_OPTION_UNAVAILABLE` refusal triggers one deliberate fallback to the plain listing (the refused location + selection is not re-sent, so there is no retry loop) and the unavailable selection is then surfaced. Coupon requests go through the same lifecycle with the committed destination and exact service/pickup ids (never inferred from cost); the server-confirmed coupon is carried into later quotes and completion, a rejected one is not. The cart (no destination) validates the coupon against the cart alone.
- Address text (post-review): `street` keeps digits (“9 de Julio”, “Ruta 2”; ≤200 chars, at least one letter), optional `floor` is validated (≤80 chars, letters/digits/`. , / # - °`) with accessible error on blur. `floor` (≤80) and `neighborhood` (≤120, alphanumeric: “Barrio 31”, “1-11-14”) are additive optional fields of the checkout address contract (frontend Zod, backend Zod/OpenAPI), stored as separate keys inside the existing `shippingAddressSnapshot` JSON (no DB migration) and shown in the CRM sale/order detail; they are never concatenated into `street`. Saved-address (`addressId`) snapshots do not carry them because the account address model has no such fields.
- The tariff amounts are owner-delegated merchant values and can be re-edited from the CRM.

All other items in this design are implemented as described above.

## Validation evidence required from implementation

| Layer | Focus |
|---|---|
| Frontend pure-rule/acceptance harness | Blur targets only one field; typing clears its error; section/final validation share rules; draft allowlist/TTL/corrupt data/storage failure/cleanup; service-ID identity and home-only filtering; selected-zero versus unselected-zero shipping. |
| Backend focused tests | Exact service/provider mismatch rejection; both providers' home modalities; pickup remains supported; authoritative weight bands, thresholds and order snapshots unchanged. |
| Browser flow | No errors while typing, red invalid field on blur, Continue/finalize reveal hidden failures; refresh retains safe values and no proof/payment secrets; fresh quote after restore; editing non-price address fields does not cause loading per key; request races cannot overwrite new selection; keyboard locality search and mobile summary. |
| Geographic acquisition | 24 jurisdictions, pagination/count/checksum consistency, province-scoped duplicate city names, CABA, accented names, and no fabricated postal mapping. No nationwide postal-success claim without source coverage evidence. |
| Tariff tool | Dry-run performs zero writes; destination/allowlist/fingerprint checks; unrelated config remains byte-for-byte unchanged; stale preconditions and invalid ranges roll back. |

Implementation completed and verified across all required layers: root/backend TypeScript clean, 21 frontend acceptance harnesses passed, 6 backend checkout suites (19 tests) and 2 shipping suites (11 tests) passed, scoped ESLint clean, and isolated browser flow verified on Chromium with fail-closed mock interception (no unmocked requests escaped, zero orders/charges/writes). Existing dirty backend startup/package files, the untracked migration and recordings remain preserved.
