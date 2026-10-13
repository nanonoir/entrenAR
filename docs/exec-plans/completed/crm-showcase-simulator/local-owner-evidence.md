# Local-owner continuation evidence — 2026-10-09

**Current outcome: local seed generated successfully, second invocation already-generated with identical whole-state digest; real checkout, persistence and authenticated HTTP checks passed.** The preparation-only sections below are historical; the completion record at the end supersedes their unfinished-work statements.

## Policy correction and implementation

The owner authorizes only `127.0.0.1:5432/entrenar/public` (fingerprint `83356d0e3af5e1161197c6962b763172d389fde5682cd686b5cef0facd5d5d3a`), not production. The final cutover verification confirms preservation of the original authentication rows and legitimate login-created refresh tokens; they are not commercial mock contamination. Plan, design and PRD were updated before implementation.

The CLI now supports an explicit trusted-owner local authorization and restored-copy administrator preservation with backup restoration attestation. Default isolation, forbidden URL overrides, production rejection and absent-URL rejection remain unchanged. Baseline checks permit ADMIN users and tokens linked only to those users; other commercial data remains forbidden. No administrators, tokens, catalog rows, history, schema or migrations were changed.

## Fresh private backup and restore proof

- Backup path: `C:\Users\Nahuel\AppData\Local\Temp\opencode\crm-showcase-owner-20261009.backup` (outside repository; contains preserved private authentication data, do not publish).
- SHA-256: `5c965ab3edaefcae2160decc5eee7e6a162175b103ecc5a2307234a578a0bac5`.
- Source container: existing `entrenar-postgres-1`, PostgreSQL 16.
- New isolated restore container: `entrenar-crm-owner-restore-20261009`, PostgreSQL 16, bound only to `127.0.0.1:55439`, database `entrenar_crm_demo_owner_restore`, dedicated randomly generated destination password (not printed).
- Consistent custom-format `pg_dump --format=custom --no-owner --no-privileges` completed against `entrenar`.
- `pg_restore --exit-on-error --no-owner --no-privileges` completed successfully in the isolated instance. Initial MSYS path translation failed before restoration; retry with `MSYS_NO_PATHCONV=1` succeeded.
- Read-only source/restore comparison verified **all rows of all 40 public tables**, sorting each table's `row_to_json` text and comparing count + MD5 of aggregate row text. All equal.
- SHA-256 of this table comparison receipt: `94cf229ebfb947249f2b8df3137b203d74ac7ed8739d1e237b7c507a78ea0388`. This is **not** the CLI canonical `baselineDigest` and must not be used as one.
- No local database writes occurred; only the fresh isolated restore was populated. No credentials or row exports were printed/committed.

## Executed code validation

```bash
npm --prefix backend run test:unit -- --runTestsByPath src/modules/crm-showcase/target-policy.spec.ts src/modules/crm-showcase/crm-showcase.service.spec.ts
npm run build:backend
npx eslint backend/src/modules/crm-showcase/target-policy.ts backend/src/modules/crm-showcase/target-policy.spec.ts backend/src/modules/crm-showcase/crm-showcase.service.ts
```

- Unit tests: 2 suites, 41 tests passed; Jest time 11.291 seconds.
- Backend build: passed.
- Scoped lint: passed, no warnings/errors.

## Not executed / remaining operational work

Real checkout, persistence suite on copies, scheduler inspection, manual commerce configuration, post-configuration canonical authorization digest, source seed/no-op, graph/stock/statistics/coupon/cart real-service validation and authenticated browser checks are **not executed**. No claim of complete operational acceptance. No configuration changes were made. No app/frontend/background jobs were started. The task-owned temporary restore container was removed with `docker rm --force entrenar-crm-owner-restore-20261009`; final `docker ps` showed only the two original operator containers. The isolated restore is disposed, port 55439 is no longer published, and the private backup is preserved. Existing source containers were not stopped.

## Completion record (supersedes preparation-only status)

### Preparation and scheduler

Reused the existing private backup; no second backup was taken. Restored disposable A/B and checkout copies into task-owned PostgreSQL 16 container `entrenar-crm-owner-validation`, loopback port 55439, dedicated random credentials. Canonical `readBaseline` digest before configuration matched the preserved pre-seed source exactly: `bb65c97694803679d718eef4b4f1b02dc63e8c41d97c5ed0dd183054bc3aabb3`.

Windows `Get-ScheduledTask` filtered for EntrenAR/showcase returned no tasks. Docker listed only the existing app/database plus our validation container. Existing backend process inspection showed node/sh/ps, no cron/reset process. There is no systemd on the Windows host; repository systemd reset files are deployment assets, not an installed timer. No reset command was invoked. `crontab -l` was unavailable due to its container privilege restriction; process inspection and the Windows/container inventory are the scheduler evidence, not a claim of successful crontab enumeration.

Configuration was first exercised on copies, then applied locally only after checkout and persistence success. Changed existing bank-transfer name/description/status/selected option/fictitious bank fields, existing andreani name/status/domicile modality/fictitious sender fields/threshold, its five weight-band costs to 100, and the existing pickup point's fictitious address/contact/name/active/free/all-coverage fields. Configuration timestamps explicitly use `2026-10-09T12:00:00Z` so all copies and the authorized local baseline are identical. No other gateway was activated; no schedules or configuration rows were added. Configured canonical baseline digest: `dca8eb678cc96e65dc84107331ddc2bb43aa9ee346ba4d2c4c52799d675bd5b7`.

### Real failures reproduced and fixed

- Checkout fixture initially supplied fields not accepted by the quote contract. Removed customer/payment fields from quote only; completion still supplies them. Failed copies were replaced with newly named disposable restores, never local cleanup.
- Real pickup completion violated `Order_snapshot_objects_check`: optional address JSON null is not SQL NULL. Fixed checkout repository and historical writer to use `Prisma.DbNull`; added focused unit regression. No migration or constraint weakening.
- Real generation rejected catalog preservation because JS Date truncated PostgreSQL product timestamp precision. Preserve exact raw baseline timestamp text with parameterized SQL updates for flags/timestamp restoration. Full catalog comparison now passes.
- Customer detail HTTP returned 400 because the existing identifier regex rejected reserved `crm-showcase:<64 hex>` IDs. Backend and frontend customer contracts now accept only this exact namespace in addition to the unchanged ordinary identifier alphabet. Added persistence/adapter regression assertions. No local records were rewritten; existing completion marker remains intact.

### Tests and timings

| Check | Result |
|---|---|
| Real guest checkout: shipping/pickup, manual payment, placement deduction, completed session/cart, replay/no auth mutation | 2/2 passed; Jest 13.214s, bounded wrapper 13.842s |
| Real PostgreSQL persistence: collision, two rollback faults, bounded gate wait, competing CLIs, immutable triggers, A/B deterministic graph, read consumers, confirm/cancel/receive and no-op | 9/9 passed; initial successful Jest 54.18s; rerun after customer-ID correction 52.59s (wrapper 53.335s) |
| Focused generator/snapshot units | 5 suites / 57 tests passed, 13.192s |
| New optional-null repository regression + authorization units | 2 suites / 39 tests passed, 11.639s |
| Backend build | Passed after runtime fixes |
| Root `npx tsc --noEmit` | Passed |
| Frontend acceptance | API default + all 16 harnesses passed |
| Scoped ESLint | Passed with no warnings/errors |

Final regression run after adding explicit preserved-auth assertion: persistence 9/9 passed in **64.057s** (wrapper 64.872s) on fresh A/B copies. Full backend units: **89 suites / 528 tests passed**, 52.015s. Scoped lint, root typecheck and all 16 frontend harnesses passed again after customer-adapter regression checks. Both dedicated showcase tests are excluded from the legacy integration config.

Exact machine-specific commands executed are in the Spanish operator guide. Persistence copies intentionally retain test operations until disposal; tests never delete generated data.

### Authorized local CLI outputs

```json
{"status":"generated","destinationFingerprint":"83356d0e3af5e1161197c6962b763172d389fde5682cd686b5cef0facd5d5d3a","counts":{"customers":20,"orders":80,"suppliers":3,"purchases":4,"coupons":6,"abandonments":8},"manifestDigest":"406e8b7584c70c817fa67344d06aeffdb152821ead8e31c98a98be355bfd584b"}
{"status":"already-generated","destinationFingerprint":"83356d0e3af5e1161197c6962b763172d389fde5682cd686b5cef0facd5d5d3a"}
```

First invocation wrapper: 7.141s; second: 1.131s. Second invocation before/after canonical whole-state digest identical: `db01ca0da313b04ea0078e944194d7207a9fa17fed76719015abf58e5b8d31ba`. The same digest remained after authenticated read verification. Source writes were configuration plus one atomic scenario; no reset, admin/token deletion, source restoration, schema/migration changes or commits.

### Source SQL/service integrity

- Preserved authentication byte-equivalent canonical rows: 42 ADMIN users, 127 refresh tokens, 0 password-reset tokens.
- Preserved structural catalog: 649 products, 1,119 variants, 3,790 images, 60 categories, 2,105 membership links. Actual baseline follows later taxonomy alignment; do not substitute the older cutover's category/link counts.
- 80 orders/items/payments; 20 customers/addresses; 3 suppliers; 4 purchases/48 purchase items; 6 coupons/20 redemptions; 68 carts/sessions (60 complete, 8 abandoned), 8 live abandoned items; 204 order-history rows; 101 inventory movements.
- Ledger: 24 receipt movements +240; 52 checkout deductions −52; 18 manual deductions −18; 7 compensations +7. All intermediate/final affected balances verified on 14 variants (12 tracked, 2 infinite); no infinite numeric ledger entries.
- SQL checks: 0 orphan variant/product lines, 0 coupon count mismatches, 0 completed cart items, 0 infinite quantity violations. Generator independently validated graph, totals, chronological stock and references before committing.
- 10 bestseller and 8 featured flags. Required order/payment/logistics states present in valid combinations.
- Real statistics custom 2026-08-10–2026-10-09: revenue 2,769,385.18 ARS; 50 qualifying paid noncancelled orders; average ticket 55,387.70; conversion 73.53%; 14 top products, 20 top customers, 5 ranked coupons. Six coupons have redemptions; ranking excludes nonqualifying cancelled orders.

### Authenticated HTTP and disposition

Started task-owned compiled Nest application on **127.0.0.1:3228**, pointed explicitly at the authorized source, with new ephemeral JWT/gate secrets, no `.env` loading or external integration credentials. Signed a short-lived ADMIN test access token in memory for an existing ADMIN; no login/refresh tokens were added to the source. Requests were read-only. All **21** real public/admin endpoints returned 200, including catalog, auth probe, sales/customer/purchase/abandonment lists and details, inventory history, suppliers, payment/shipping/pickup/coupons and four statistics reports. Private redacted HTTP evidence: `C:\Users\Nahuel\AppData\Local\Temp\opencode\crm-owner-http-evidence.json`; SQL/service evidence: `crm-owner-final-evidence.json` in the same directory.

Existing host port 3001 returned HTML/404 for the API route; its process was not changed. No new visual CRM browser validation was claimed. Task-owned runtime and validation container are removed after final checks; original operator processes/containers remain untouched. No outbound payment/email/storage calls were made. A pg driver deprecation warning about concurrent query scheduling was observed in copy/runtime reads; tests and assertions passed. The original independent review predates these continuation fixes; no new independent review or archival is claimed.

Cleanup executed: task-owned node PID 23028 stopped (tree only), `docker rm --force entrenar-crm-owner-validation` succeeded; Docker now lists only the original app/database. Bounded Windows listener inspection returned no listeners on 3228 or 55439. Backup, private state and four manifests had inherited ACLs removed and access restricted to the current Windows owner; six files verified by successful `icacls` results. Private state contains credentials/baseline rows and must never be published. Operational-script startup was recovered after a temporary state-file read/write race; corrected runner writes credentials before spawn and PID to a separate file, with hidden detached process and bounded readiness/deadline. No persistent task-created processes remain.

## Manual GUI follow-up — intentionally retained by owner request

**Urgent transport correction:** the current processes after the shared native-fetch fix are backend PID **31012**, frontend parent PID **12400**. The following prior PID/startup record is historical; see the correction evidence at the end.

The previous cleanup remains the record for the operational test runtime. A **new** dedicated manual runtime was explicitly requested and is now running, without any new configuration, generation or source mutation:

- Private launcher: `C:\Users\Nahuel\AppData\Local\Temp\opencode\crm-owner-manual.cjs`; modes `serve-manual`, `status-manual`, `stop-manual`.
- Backend compiled main, PID **9732**, `http://localhost:3228/api/v1`; frontend standard Next CLI dev parent PID **14968**, `http://localhost:3300`. Processes are hidden/detached with private logs and creation signatures; retained solely for the user's manual GUI session.
- Loaded existing `backend/.env` auth/gate and explicitly fingerprint-checked local database privately, passed whitelisted backend values before bootstrap, matched frontend gate secret, configured localhost:3300 CORS and all domain-specific API URLs/mocks explicitly. No env/app source files were changed and no secrets were printed.
- HTTP readiness passed: real catalog **649**, Home 200, `/admin/login` 200 with login HTML, `/productos/adelgafit-colagenfit-limon-360-gs` 200. Actual repository detail route is plural `/productos/<slug>`.
- CORS probe returned 200 and `Access-Control-Allow-Origin: http://localhost:3300`.
- Browser smoke: heading “Acceso administrativo”, email/password inputs and “Ingresar” visible; **0 additional login GETs during a bounded 5-second stability observation**, 0 console errors/warnings. No credentials entered and no login form submitted; this is startup/login render acceptance, not a full authenticated CRM visual tour.
- An initial private custom-server/Webpack experiment produced repeated Fast Refresh and one transient empty-manifest error. Its owned processes were stopped; replacing it with the standard Next CLI/Turbopack resolved the behavior without application edits. Two early startup failures also cleaned up only their owned processes; readiness now uses absolute finite deadlines instead of too-few connection-refused attempts.
- Final read-only database verification still returned `db01ca0da313b04ea0078e944194d7207a9fa17fed76719015abf58e5b8d31ba`, 42 ADMIN/127 refresh tokens and unchanged graph/catalog checks. No source data changed.
- `node --check` for the private launcher and `git diff --check` passed. Task-generated Playwright text recordings were removed; no screenshot was claimed (the browser tool denied the external temp output path).

Exact PowerShell startup/status/stop commands, live URLs, logs and manual navigation are at the top of [the Spanish guide](./guia-operador-local.md). The helper refuses occupied ports or a competing repository dev lock; stop uses PID **and** creation signature, not broad node-process termination. Original processes on 3000/3001 and Docker were not modified. These two new manual server trees are intentionally **not** cleaned up until the user finishes.

## Urgent “administrator API unavailable” correction

Diagnosis distinguished the user-visible transport failure from proxy reachability:

- Exact error maps to `src/lib/api/admin/client.ts`'s fetch catch, not necessarily the Next login proxy's unavailable response.
- Existing launcher supplied `NEXT_PUBLIC_API_BASE_URL` and all specific API variables as `http://localhost:3228/api/v1`, with the same existing `ADMIN_GATE_SIGNING_SECRET` for both processes. A malformed `{}` POST through `/api/admin-session/login` already reached the backend and returned 400/VALIDATION_ERROR. Thus a 3001/3228 proxy mismatch was not reproduced.
- Isolated browser native GET to 3228 returned 401; 3001 failed. Calling native `window.fetch` as `holder.transport(...)` reproduced `TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation` before a request. This was exactly how shared AdminApiClient invoked its injected native function; constructor callers in statistics/customers/etc supplied the native fetch too.
- Focused plan entry preceded the fix. Both normal request and refresh now use a detached local function reference. Auth roles, cookie handling, retry limits, prices, stock and all database paths are unchanged.
- Receiver-sensitive transport harness was red with exact “The administrator API is unavailable”; after correction it passed initial 401 → one refresh → replay, along with controlled 403/no-refresh isolation. Existing session lifecycle harness and scoped lint passed.
- Restarted **only** signature-matching own backend/frontend trees, hidden/detached with finite readiness. Updated private launcher's startup/status checks POST an empty JSON body, expecting 400/VALIDATION_ERROR and no cookies before reporting auth proxy reachable. This is DTO validation, not a credential attempt or successful login.
- One completed deliberate invalid-credential browser request in an isolated context returned **401 `INVALID_CREDENTIALS`** through `http://localhost:3300/api/admin-session/login`, with no access/refresh token fields and no ADMIN cookies. Native detached fetch then reached anonymous admin probe 401. No successful agent login, account mutation, seeding/config/reset or token deletion was performed.
- An earlier UI-click probe timed out without observing its expected login response; it was not treated as successful auth-path evidence or repeated with real credentials. The reliable completed proof was the single isolated browser POST above.
- Safety disclosure: the initial newly opened tab unexpectedly shared the already authenticated user browser context and redirected to `/admin`, automatically making an existing-session refresh (200). That own tab was closed immediately; subsequent probes used new isolated contexts with no user cookies. No credentials or token values were printed, and no rows were deleted to undo legitimate refresh history. This incidental refresh is distinguished from the invalid-auth checks, which issue no tokens.

Active URLs remain frontend `http://localhost:3300`, login `/admin/login`, API `http://localhost:3228/api/v1`. Refresh the user's tab with Ctrl+F5 to reload the corrected transport. Logs/PID file remain private. This correction does not claim a new comprehensive authenticated GUI tour.

Final correction checks: all 16 frontend acceptance harnesses passed, `npx tsc --noEmit` passed, focused transport/lifecycle harnesses passed, scoped ESLint passed, private launcher `node --check` passed and `git diff --check` passed (line-ending notices only). Final status returned API/catalog649, login and example product 200 plus authProxy 400/VALIDATION_ERROR/reachable=true/cookiesIssued=false. Removed only the new own shared-context snapshot/log artifacts; preserved the primary/user's existing browser tab and its recording. No secret values were printed. Documentation had already been archived by the primary workflow, so this follow-up updated the existing completed plan/guide rather than recreating an active plan.
