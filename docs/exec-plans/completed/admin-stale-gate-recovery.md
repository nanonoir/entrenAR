# Objective
Break the stale-session loop where an `active` `entrenar_admin_gate` survives a rejected admin refresh, so `/admin/login` redirects to `/admin`, bootstrap fails and returns to `/admin/login?expired=true` (loop / 404).

## Context
- `src/proxy.ts`: redirected `/admin/login` to `/admin` whenever the gate was `active`, even with `?expired=true`.
- `src/app/api/admin-session/login/route.ts` (`forwardAdminSession`, reused by refresh): upstream 401/403 returned an error without clearing `entrenar_admin_refresh` (path `/api/admin-session`) or `entrenar_admin_gate` (path `/admin`).
- `AdminBootstrapBoundary` / `admin-auth-store.refresh` send the user to `/admin/login?expired=true` after a failed refresh.
- Specs/design: `docs/product-specs/admin-auth-gateway/spec.md` (Expiration termination: "credentials clear"), `docs/product-specs/admin-route-cloaking/spec.md`, `docs/design-docs/2026-09-22-admin-auth-isolation-route-protection-branded-error-system.md`. The behavior is consistent with them; no spec text change was required.

## Scope & Non-Goals
In scope: clearing admin cookies on rejected refresh; proxy handling of `/admin/login` (`expired=true`, trailing slash); regression harness.
Out of scope: checkout client/guards, customer/cart state, backend, secrets/env/DB, restarts, client-side store changes, commit/push.

## Execution Plan
1. Refresh route: on upstream 401/403 from `/auth/admin/refresh` only, expire both admin cookies with their original path/HttpOnly/SameSite/Secure attributes. Login failures, 5xx and network errors leave cookies untouched.
2. Proxy: normalize trailing slashes; `/admin/login?expired=true` is always served (public page only); plain `/admin/login` with an active gate still redirects to `/admin`. Internal routes ignore the flag and keep 404 cloaking (HTML rewrite, RSC/non-HTML plain 404) and expired-gate redirect.
3. Harness `tests/harnesses/admin-stale-gate-recovery.harness.ts` with mocked upstream `fetch`.

## Decisions & Rationale
- Clear only on the refresh endpoint: a wrong-password login must not kill a valid session open in another tab.
- 403 treated like 401 because the backend admin refresh uses it for authorization/revocation semantics; confirm with the reviewer if the backend never emits 403 there (harmless either way).
- `expired=true` is a UX hint only; access to internal routes still requires a valid active gate. Server-side cookie clearing is the root fix; the proxy exemption is defense in depth.
- No Origin/CSRF guard exists on these routes today, so none was changed.

## Progress Tracking
- [x] Refresh cookie clearing (`clearAdminCookies` on 401/403 upstream refresh responses)
- [x] Proxy login handling (trailing slash normalization + `/admin/login?expired=true` public exemption)
- [x] Regression harness (`tests/harnesses/admin-stale-gate-recovery.harness.ts`)
- [x] tsc, scoped eslint, and focused harness execution
- [x] Independent engineering review (PASS)
- [x] Browser smoke evaluation: Browser E2E con sesión stale real NO realizado (límite operacional explícito; no se afirma end-to-end; usuario confirmó que modo incógnito funcionaba antes del fix; secretos y cookies de usuario intactos)

## Validation
- `npx tsx tests/harnesses/admin-stale-gate-recovery.harness.ts`: PASS (401/403 clear both cookies with correct paths, HttpOnly, SameSite=lax, Secure only on https; 500/502/503/network keep cookies; failed login keeps cookies; malformed token cleared and not echoed; customer/cart cookies untouched; active `/admin/login` and `/admin/login/` redirect; `expired=true` accessible with and without gate; anonymous `/admin/ventas?expired=true` 404 including RSC).
- `npx tsx tests/harnesses/admin-route-cloaking.harness.ts`: PASS (6 scenarios).
- `npx tsc --noEmit`: PASS (clean, zero errors).
- `npx eslint src/proxy.ts src/app/api/admin-session/login/route.ts tests/harnesses/admin-stale-gate-recovery.harness.ts`: PASS (clean, zero errors).
- Acceptance Harness Scope: El nuevo harness no se añadió a `frontend-acceptance.harness.ts` para mantener la suite de aceptación alineada con los arneses de auth standalone preexistentes (`admin-route-cloaking.harness.ts`).

## Implementation Outcome

### Implemented
- **Admin Cookie Clearance on Rejected Refresh**: In `src/app/api/admin-session/login/route.ts` (`forwardAdminSession`), handled upstream 401 and 403 responses specifically on `/auth/admin/refresh` by invoking `clearAdminCookies`, which explicitly expires both HttpOnly administrator cookies (`entrenar_admin_refresh` scoped to `/api/admin-session` and `entrenar_admin_gate` scoped to `/admin`) with matching `SameSite=lax` and `Secure` attributes. Upstream 5xx outages, network errors, and failed `/auth/admin/login` attempts preserve existing cookies. Customer sessions and cart cookies remain strictly untouched.
- **Proxy Loop Breaker & Route Cloaking Preservation**: In `src/proxy.ts`, normalized route pathnames to eliminate trailing slash divergence (`/admin/login/`). Requests to `/admin/login` with `?expired=true` are exempted from the active-gate redirect, allowing the public login page to mount and clear stale client state. Non-login operational admin routes (`/admin/:path*`) strictly preserve route cloaking (returning branded 404 on documents and plain 404 on RSC/data requests) even when `?expired=true` is supplied, preventing unauthorized access or route disclosure.
- **Standalone Focused Regression Harness**: Implemented `tests/harnesses/admin-stale-gate-recovery.harness.ts`, asserting cookie clearance upon 401/403 refresh failure, cookie retention during outages/5xx/network faults, cookie retention on wrong-password logins, malformed token sanitization without body echo, customer session isolation, trailing slash redirect consistency, and robust route cloaking on operational paths.

### Deviations from Design
None. The implementation directly resolves the issue within existing architectural and specification boundaries (`docs/product-specs/admin-auth-gateway/spec.md`, `docs/product-specs/admin-route-cloaking/spec.md`, `docs/design-docs/2026-09-22-admin-auth-isolation-route-protection-branded-error-system.md`).

### Validation
- Independent Review: PASS.
- Focused stale gate harness (`tests/harnesses/admin-stale-gate-recovery.harness.ts`): PASS.
- Admin route cloaking harness (`tests/harnesses/admin-route-cloaking.harness.ts`, 6 scenarios): PASS.
- Root TypeScript typecheck (`npx tsc --noEmit`): PASS (clean).
- Scoped ESLint on touched files (`src/proxy.ts`, `src/app/api/admin-session/login/route.ts`, `tests/harnesses/admin-stale-gate-recovery.harness.ts`): PASS (clean).
- **Operational Boundary & Limitation**: Browser E2E con sesión stale real NO realizado. Se declara explícitamente este límite sin afirmar ejecución end-to-end automatizada en navegador, dado que la forja de un gate stale activo en navegador requeriraría manipular el secreto server-only `ADMIN_GATE_SIGNING_SECRET` o alterar cookies reales del entorno. Los secretos y cookies de usuario se mantuvieron estrictamente intactos. Como evidencia empírica complementaria, el usuario confirmó previamente que la navegación en modo incógnito (sin cookies previas en el storage del navegador) funcionaba correctamente antes del fix, corroborando que el loop dependía exclusivamente del estado de las cookies de sesión residuales.
- Scope note: No se añadió el nuevo harness al runner general `frontend-acceptance.harness.ts` para preservar el alcance de suites standalone existente en autenticación admin.

### Follow-up
None. Work is complete, verified, and safely contained.
