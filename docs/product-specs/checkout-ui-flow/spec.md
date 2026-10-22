# Checkout UI Flow Specification

## Purpose and authority

Define the cart and checkout presentation, input validation, draft recovery, destination selection and delivery interaction. [Checkout quote](../checkout-quote/spec.md) owns authoritative quoting; [checkout complete](../checkout-complete/spec.md) owns order placement. [Mercado Pago card payments](../mercadopago-card-payments/spec.md) owns embedded real card payment and result recovery; bank transfer retains manual completion. [Commerce shipping](../commerce-shipping/spec.md) owns provider tariffs and pickup configuration. This UI is not a mock-only order flow.

## Checkout shell and cart

- `/carrito` and `/checkout` MUST use a distraction-free shell without shop promo bars, category navigation, drawers or shop footer. The checkout header, background surface and black storefront-style footer remain visible and primary actions remain reachable on small screens.
- Cart and checkout headings MUST use the established Bebas heading typography consistently; this does not change typography elsewhere in the storefront.
- `/carrito` MUST show “Mi Carrito”, cart items, free-shipping progress, suggestions, continue-shopping action, coupon entry, summary and `Iniciar Pago` navigation to `/checkout`.
- An empty cart MUST show a continue-shopping path and MUST NOT expose new payment progression as ready. Direct `/checkout` access with an empty cart MUST show the empty state instead of the form unless an authorized bound Mercado Pago order is being recovered; active-order/result recovery MUST run before the empty-cart branch.
- Free-shipping progress expresses eligibility, not a confirmed shipping price; summary rules below apply even when a threshold is reached.

## Steps and validation

Checkout MUST provide collapsible Identificación, Entrega and Pago sections. Selecting an accessible step expands it and collapses or summarizes the others. Continuing requires valid current-section values; finalizing requires valid values and eligible selections across all required sections.

| Event | Required behavior |
| --- | --- |
| Initial display or draft restoration | No validation errors, red borders or completed-step claims solely because values are present. |
| Typing | Update the value, clear that field's visible error and invalidate dependent completion. Do not validate on each keystroke or raise a global validation alert. |
| Field blur | Validate only the blurred field using current values. If invalid, only that field gains a red error border and a specific accessible helper message; do not newly mark unrelated fields invalid. |
| Continue | Validate the entire current section, expose all relevant field errors and remain on the section on failure. A section-level validation notice may appear at this point. |
| Finalize | Validate all required sections and delivery/payment configuration, reveal the first failing section and do not submit invalid hidden values. A global validation notice may appear at this point. |

Field rules MUST agree across blur, Continue and Finalize. Labels remain available; invalid fields MUST expose `aria-invalid` and an association with their specific helper message. Optional fields MUST also show their errors when a supplied value is invalid. Existing errors on other fields need not disappear when a different field blurs. Street and neighborhood inputs MUST preserve numeric and alphanumeric designations (e.g. "9 de Julio", "Ruta 2", "Barrio 31", "1-11-14") rather than stripping digits, enforcing length boundaries (street ≤ 200 with at least one letter, neighborhood ≤ 120, optional floor ≤ 80).

Delivery/payment selection failures MUST be associated with their group, not mislabeled as street or postal-code failures. Geographic data loading/failure MUST be shown as a status with recovery, not an invalid-CP error. Operational quote/completion errors MAY appear in the summary independently of the global form-validation timing above.

## Refresh recovery and privacy

Checkout MUST recover an in-progress draft on refresh in the same browser session, independently of the persisted cart. The draft expires 24 hours after creation; editing MUST NOT indefinitely extend its lifetime.

Only these values MAY be retained:

- Identification: email, first name, last name, DNI and phone.
- Address: province and locality IDs/names, postal code, street, number, floor/department, neighborhood and recipient.
- Selection intent: home/pickup mode, exact shipping-service ID and provider ID, pickup-point ID and payment-method ID only.

Card details, CVV, credentials, payment tokens, transfer proofs/files, authentication/checkout session tokens, idempotency keys, quotes, totals, errors, touched state, active/completed steps and order completion MUST NOT be retained in the draft. Non-payment personal data MUST NOT be added to durable cart storage or logs by this feature.

Restoration MUST preserve the latest input before refresh, MUST NOT overwrite a valid draft with initial empty values, and MUST treat restored values as untrusted intent. Start at Identificación with no completed steps; obtain a fresh authoritative quote and recheck service/point availability before completion. Stored display objects or totals MUST NOT substitute for current configuration.

Expired, malformed or incompatible drafts MUST NOT restore. Unavailable browser storage MUST leave checkout usable in memory. Closing a tab MUST NOT be described as a guaranteed privacy cleanup mechanism.

Clear the draft on successful manual order completion, explicit cart clearing, logout or account-identity switch, including when checkout is not open. For Mercado Pago, clear only the submitted generation upon verified approval or accepted processing/review; preserve it through submission uncertainty, challenge and rejection, following the payment specification. Pending saves MUST NOT recreate a cleared draft. Failed submission, quote reconciliation, checkout invalidation or a temporarily empty cart during initial restoration MUST NOT clear a valid draft.

## Argentine destination selection

- Provide all 24 jurisdictions: 23 provinces and CABA. Province and locality selection MUST be searchable and keyboard-accessible, with localities scoped to the selected jurisdiction.
- Locality coverage MUST use complete, versioned official Georef provincial reference snapshots, not a small checkout fixture or the first page of results. Completeness MUST be demonstrable through source/version, retrieval date, per-province counts and integrity evidence. Partial or failed loading MUST NOT be presented as a complete list.
- Preserve source IDs and official display names. Search MAY ignore case/accents; selected values and order addresses retain official names. Same-named localities MUST NOT be treated as globally identical.
- Changing province invalidates the previous locality and delivery completion. Editing postal code MUST NOT erase an independently valid locality on each keystroke. A missing fixture match MUST NOT be represented as lack of merchant coverage.
- Geographic reference coverage, postal verification and merchant delivery coverage are distinct. No geographic result alone proves a CP/CPA valid or deliverable.
- If the official snapshot cannot be loaded, the UI MUST show a retryable status and an explicit manual locality entry fallback; the manual entry is labelled as not taken from the official list.

### Approved postal strategy and documented coverage gap

**Decision (owner, 2026-10-19):** Georef province/locality selection plus a manually entered, format-validated postal code is the accepted interim approach. Correo Argentino publishes no reusable code listing (its corporate normalization web service is the only sanctioned CPA source), and Georef locality records carry no postal data, so a comprehensive CP/CPA directory is **not delivered** and MUST NOT be claimed.

- The postal field accepts a legacy 4-digit CP or an 8-character CPA (province letter, four digits, three letters). Other shapes are invalid on blur/Continue/Finalize.
- The province is recognized from the postal code when it is deterministic: the CPA first letter follows ISO 3166-2:AR. A 4-digit CP is recognized only through an explicit table of verified correspondences; ranges are never inferred. Unknown or ambiguous CP4 values MUST NOT block checkout; the shopper selects the province manually.
- A recognized province preselects the province; a manual selection that contradicts a deterministic CPA letter (or verified CP4) is a postal-code field error. A recognized-province hint is never described as postal verification or delivery coverage.
- Postal codes remain unverified intent: the UI MUST NOT label them “verificado”. Postal values are preserved in drafts. A missing recognition MUST NOT be shown as lack of merchant coverage.
- The recognition table is expandable data with provenance; the remaining coverage gap (CP4 to province/locality, address-specific CPA) is a documented risk, not a requirement satisfied.

## Delivery selection and branding

- Home-delivery cards MUST include only eligible `home_delivery` services, never branch-delivery services. This applies equally to explicit mock mode; an API failure MUST NOT manufacture mock carriers or prices.
- Keep pickup as a separate supported method with current quoted pickup points and exact `pickupPointId`. Filtering home cards MUST NOT remove pickup/branch configuration globally or invent branch addresses from carrier-service definitions.
- Use the exact quoted shipping-option/service `id` as the selection identity. Carry its matching provider ID as metadata through quoting and completion. Provider identity alone MUST NOT select every service for that provider.
- Where two eligible services share a provider, selecting one MUST select only that service. An old provider-only selection MAY resolve only if exactly one eligible home service matches; otherwise selection remains pending.
- If the current matching quote no longer contains a selected service/point, mark it unavailable, invalidate delivery completion and require reselection. Server validation of service/provider compatibility remains mandatory.
- Carrier cards MUST prominently identify **Correo Argentino** or **Andreani** with the established logo; description and ETA are secondary. Preserve Andreani, and do not change exact service IDs merely to change Correo Argentino's visible branding.

## Quote interaction and summary

Quote eligibility and server calculations follow [checkout quote](../checkout-quote/spec.md). The following rules govern when the UI requests and presents them:

- Raw address typing MUST NOT cause a quote request on every keystroke. Commit a valid destination field on blur or successful Continue; a valid selector change may commit immediately. Finalize MUST validate and commit the latest destination before refreshing/completing.
- Changes to street, floor, recipient and other fields that do not affect the current tariff/coverage MUST NOT refresh the quote. Completion still uses the latest validated full address.
- Cart, ownership/coupon, committed destination, delivery mode and exact service/point changes that affect quoting MUST obtain a matching quote. Equivalent input MUST NOT cause redundant requests; simultaneous changes MUST be coalesced. Only the latest applicable response may update totals, notices or selection availability.
- Uncommitted destination edits and pending refreshes invalidate delivery readiness. Stale amounts MUST NOT enable completion.

The summary MUST distinguish:

| Delivery state | Presentation |
| --- | --- |
| No selection | “A calcular”, never “Gratis”, even when an incomplete quote has zero shipping. |
| Refreshing/stale | Neutral calculating/pending status; previous amounts are not current final totals. |
| Unavailable | Explain that selection is unavailable and require an eligible selection. |
| Quoted | Use shipping from the current matching authoritative quote. “Gratis” requires an actually selected valid service/point with zero quoted shipping. |

Subtotal, discounts, shipping and total MUST come from the same accepted quote. With unresolved shipping, any subtotal-derived amount shown MUST be explicitly provisional, not a confirmed final total. Free-shipping eligibility alone MUST NOT turn pending delivery into “Gratis.”

The summary MUST retain scrollable items, coupon area, totals, final action and secure-purchase copy, usable on mobile as well as desktop. In Mercado Pago card mode, suppress the summary final action so the embedded card submit is the only primary pay action; retain totals/help. Transfer keeps its existing CTA.

## Payment and scope boundaries

Payment choices and bank instructions MUST reflect eligible current configuration, not a fixed promise of mock providers. Real card behavior follows [Mercado Pago card payments](../mercadopago-card-payments/spec.md); transfer-proof persistence remains outside scope. Order creation and failure handling follow [checkout complete](../checkout-complete/spec.md); the final action is not a static no-order preview.

Merchant tariff amounts are owned by [commerce shipping](../commerce-shipping/spec.md). This specification does not itself authorize runtime data changes.
