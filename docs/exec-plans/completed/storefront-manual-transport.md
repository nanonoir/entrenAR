# Objective
Restore catalog images and customer account browser transport in the owned manual runtime.

## Context
Manual frontend runs on 3300 and backend on 3228. Account client invokes native fetch as an instance method. The isolated launcher omits ASSETS_BASE_URL, causing relative catalog media URLs.

## Scope & Non-Goals
Fix account fetch invocation and the private launcher public media environment. Preserve user changes, sessions, catalog, storage credentials, and database contents. No signup or storage mutations.

## Execution Plan
1. Add receiver-sensitive account transport regression and demonstrate failure.
2. Invoke fetch without the client receiver; forward only the public assets URL.
3. Restart only signature-matched launcher processes and verify browser images and invalid registration transport.

## Decisions & Rationale
Use a local fetch reference rather than binding injected implementations to a browser global. Public assets configuration is not a storage credential; retain credential isolation.

## Progress Tracking
- [x] Diagnose transport and missing media prefix.
- [x] Regression and corrections.
- [x] Runtime and scoped checks.

## Validation
Account adapter harness, scoped ESLint, TypeScript, isolated browser evidence with invalid registration payloads and loaded catalog media.

## Implementation Outcome

### Implemented
- Fixed native `fetch` invocation receiver bug in `FetchAccountApiClient` (`src/lib/api/account/client.ts`): decouple `fetchImplementation` from `this` receiver in both general requests and token refresh calls (`const fetchImplementation = this.fetchImplementation; await fetchImplementation(...)`), eliminating browser `TypeError: Illegal invocation` when calling native `fetch`.
- Added receiver-sensitive transport regression test in `src/lib/api/account/account-adapter.harness.ts` (`runReceiverSensitiveTransportScenario`) demonstrating red/green verification for `/auth/register` and `/auth/refresh`.
- Updated temporary private manual launcher to forward public `ASSETS_BASE_URL` (`https://assets.entrenar.shop`) to resolve public catalog media URLs without forwarding Cloudflare R2 credentials or storage secrets. Domain APIs remain routed to backend on port 3228 and frontend on port 3300.
- Restarted only signature-matched owned runtime processes, keeping both backend (3228) and frontend (3300) active and available.

### Deviations from Design
None.

### Validation
- **Account Adapter Harness**: Regression test failed before the fix with `ACCOUNT_API_UNAVAILABLE` due to illegal invocation, and passed cleanly after decoupling the receiver.
- **Static Quality Checks**: Scoped ESLint and `npx tsc --noEmit` passed with zero errors.
- **Browser Runtime Evidence (Isolated)**:
  - Product detail images loaded successfully with HTTP 200 OK and natural widths 914 and 928 (no Next.js image configuration changes needed since catalog media uses standard `img` elements).
  - Customer registration UI submitted via the real account client transport to `http://localhost:3228/api/v1/auth/register`. Intercepted outgoing request body replaced with `{}` safely produced HTTP 400 `VALIDATION_ERROR` from backend validation, confirming actual browser-to-backend transport without displaying the offline fallback banner.
  - No user accounts were created, no database/auth mutations occurred, and no successful signup was tested or claimed.

### Follow-up
None.
