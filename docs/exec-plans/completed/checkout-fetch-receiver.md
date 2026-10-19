# Objective
Restore checkout browser transport: `FetchCheckoutApiClient` must call the injected/native `fetch` without the client as receiver.

## Context
`src/lib/api/checkout/client.ts` invokes `this.fetchImplementation(...)` in `execute` and `performRefresh`. Native `window.fetch` called with the client as `this` throws `TypeError: Illegal invocation`, which is swallowed into `CHECKOUT_API_UNAVAILABLE` and no request is sent. `src/lib/api/account/client.ts` already uses the correct pattern (`const fetchImplementation = this.fetchImplementation`). Prior art: `docs/exec-plans/completed/storefront-manual-transport.md`.

## Scope & Non-Goals
In scope: decouple both fetch calls; preserve the original failure as `cause` on `CheckoutApiError` (UI `code`/`message` contract unchanged, no body/token logging); receiver-sensitive regression in `checkout-adapter.harness.ts`; browser smoke without creating orders/payments.
Out of scope: `lastQuoteInput` retry redesign, optional `variantId` alignment, backend/CORS/env, admin auth 404, any prior unrelated work.

## Execution Plan
1. Add receiver-sensitive harness (strict non-arrow function rejecting the client receiver, accepting a detached call) covering `execute`, 401 refresh + retry, and cause preservation. Show it failing.
2. Apply the local-reference fix in `execute` and `performRefresh`; add `cause` to `CheckoutApiError`.
3. Run tsc, scoped lint, checkout harness, frontend acceptance; browser smoke in a dedicated tab.

## Decisions & Rationale
Same pattern as the account client (local reference, no `.bind`). The harness rejects only the client receiver rather than requiring `window`, since a detached `this === undefined` call is valid. `cause` is the raw thrown error and is not serialized into `message`.

## Progress Tracking
- [x] Failing regression (harness failed with `The checkout API is unavailable.` before the fix)
- [x] Fix and cause
- [x] Static and harness checks (tsc, scoped eslint, checkout harness, frontend acceptance: 18 harnesses)
- [x] Browser smoke (validated in isolated browser: live quote 200 total $38.840, real coupon invalid 409 handled without crash, pickup quote 200, simulated network failure and Reintentar 200 clears error, 0 order/payment requests)

## Validation
`npx tsc --noEmit`, scoped `npx eslint`, `npx tsx src/lib/api/checkout/checkout-adapter.harness.ts`, `npm run verify:frontend-acceptance`, browser smoke.

## Implementation Outcome

### Implemented
- Detached `this.fetchImplementation` calls in `FetchCheckoutApiClient` (`src/lib/api/checkout/client.ts`) for both `execute` and `performRefresh` (`const fetchImplementation = this.fetchImplementation; await fetchImplementation(...)`), resolving the browser `TypeError: Illegal invocation` when calling native `window.fetch`.
- Preserved underlying thrown error as `cause` in `CheckoutApiError` across `execute`, `performRefresh`, and `unavailableError(cause)` without altering the public UI `code` or `message` error contract and without leaking sensitive tokens or payload bodies in error logs.
- Added strict receiver-sensitive regression test in `src/lib/api/checkout/checkout-adapter.harness.ts` (`runReceiverSensitiveTransportScenario`) verifying detached invocation for standard requests, 401 refresh + retry flow, and raw `cause` error retention.
- Preserved existing session management, headers, credentials (`include`), and token retry mechanics without modifications to wire contracts.

### Deviations from Design
None.

### Validation
- **Independent Review**: PASS (`ses_ec18b59d9ffeoHR18hdyLUIONh`).
- **Static Quality & Type Check**:
  - `npx tsc --noEmit`: 0 errors.
  - Scoped ESLint: clean (0 warnings / errors).
- **Automated Harnesses**:
  - `npx tsx src/lib/api/checkout/checkout-adapter.harness.ts`: PASSED (receiver-sensitive harness covering execute, 401 token refresh + retry, and cause preservation).
  - `npm run verify:frontend-acceptance`: 18 harnesses passed.
- **Isolated Browser Smoke Testing**:
  - Live delivery quote calculation returned HTTP 200 OK (total $38.840 rendered correctly in the UI).
  - Real coupon invalid check returned HTTP 409 Conflict with backend code `COUPON_NOT_VALID`, cleanly handled and displayed in the UI without crashing.
  - Store pickup quote returned HTTP 200 OK.
  - Simulated network failure followed by clicking "Reintentar" succeeded with HTTP 200 OK and cleared the error state.
  - Zero complete/order/payment creation requests were sent; customer sessions remained untouched.
  - 401 refresh + retry flow was validated via the isolated adapter test harness (explicitly no claim of live authenticated browser refresh).

### Follow-up
- Redesigning `lastQuoteInput` module-scoped retry state in `src/stores/cart-checkout.actions.ts` to a store-managed lifecycle was deliberately excluded and tracked as technical debt.
- Aligning `variantId` optionality in frontend checkout schemas (`checkout-api.schemas.ts`) with backend strict request schemas (`checkout-request.schemas.ts`) was deliberately excluded and tracked as technical debt.
