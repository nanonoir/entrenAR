# ExecPlan: Isolated CRM Showcase Simulator

## Objective

### Approved local-owner exception (2026-10-09; supersedes earlier runtime blockers)

The owner explicitly authorizes commerce configuration and one-shot scenario generation on `127.0.0.1:5432/entrenar`, public schema, not production. Existing ADMIN accounts and their tokens are legitimate preserved data, not contamination. Preserve the real imported catalog, identities, structure and images. Never delete administrators/tokens, reset rows, restore over this local source or clear a completion marker. The default CLI and all destructive tests remain isolated and fail closed, without implicit URL fallback.

Before any local write: create a new private backup, record its SHA-256 and exact credential-free identity, restore and verify it on an isolated destination. Implement an explicit trusted-owner authorization tied to the exact local fingerprint and that restoration evidence. Configure existing manual demonstration payment/shipping/pickup only, without gateways/network calls. Exercise real checkout on a restored disposable copy, then persistence/operability tests on copies with preserved ADMIN/token baselines. Capture the configured baseline digest before generation. Execute local generation once and rerun to prove no-op; an existing valid marker means no writes. Report actual tests/timings, integrity/counts, configuration changes, private backup evidence and process cleanup. Historical BLOCKED entries below describe the previous isolated-only policy and are superseded, not current blockers.

Execution order: document exception → inspect cutover preservation/tooling → private backup and isolated restore proof → authorization/configuration implementation and copy tests → authorized local configuration/generation/no-op → evidence/operator guide. No schema/migration/reset changes or commits.

Implement the [approved PRD](./crm-showcase-simulator/prd.md) using the [technical design](../../design-docs/2026-10-09-crm-showcase-simulator.md). Deliver coherent commercial data on the explicitly authorized local target, with destructive validation exclusively on restored isolated copies, and permanent storefront availability/affinity behavior. No migrations or unauthorized source writes.

## Context

The imported catalog replaces the legacy mock baseline. Existing seed/reset must not run. PostgreSQL enforces append-only inventory and immutable commercial snapshots. Checkout deducts at placement, including pending orders; statistics qualify PAID, non-cancelled orders by creation date. Follow `AGENTS.md`, `ARCHITECTURE.md` and `docs/FRONTEND.md` for touched boundaries.

## Scope & Non-Goals

Two workstreams: CLI generation and small storefront discovery/card changes. No new tables, KPIs, reset subsystem, production writes, external integrations, recommendation engine or source-catalog repairs. No commit/push/PR requested.

## Decisions & Rationale

- Approved PRD is the functional authority; technical details live in the linked design rather than duplicated here.
- One gated transaction, fixed completion marker in existing commercial history and reserved deterministic IDs. Reruns are no-op even after admin operations.
- Retain imported balances and stock modes; use existing domain calculations/inventory primitives with narrowly scoped historical context.
- Independently authorized loopback demo destination, backup restoration on a separate instance, no habitual URL fallback. Test-only fault injection must not broaden the operator CLI surface.
- Pure storefront selectors consume public catalog through existing adapter, with no new persistent cache or endpoints.

## Execution Plan

### 1. Contract and baseline (dependency for all implementation)

- [x] Refine PRD with approved decisions and verifiable acceptance.
- [x] Delegate brief repository-grounded technical design.
- [x] Create this single executable plan.
- [x] Inspect available PostgreSQL/container/process tooling and commerce prerequisites without modifying source data. Provision private backup and isolated disposable copies; record redacted identities and scheduler evidence. If unavailable, implement safe code but report runtime verification blocked, never claim acceptance. Tooling and source prerequisites inspected; source contains 38 non-example admin emails, 127 refresh tokens, and inactive commerce configuration. In accordance with safety policy, no source clone/dump or modification was executed; runtime verification reported BLOCKED.

### 2. Commercial generator

- [x] Add CLI-only `backend/src/modules/crm-showcase/` destination policy, scenario assembly, historical writer, command and focused tests. Wire independent root/backend command.
- [x] Extend inventory inputs for deterministic historical ledger IDs/times and structured receipt references, retaining ordinary-call defaults; share existing sale/purchase calculations only where needed.
- [x] Implement prerequisite/collision checks, shared mutation gate, immutable snapshot inserts, chronological stock operations, graph/balance checks and atomic completion marker.
- [x] Create customers, orders/payments/history, suppliers/purchases, coupons/redemptions, carts/sessions and flags within approved ranges.
- [x] Add isolated persistence tests: guards, rollback, competing writers, rerun after live operations, malformed/partial namespace, determinism across restored copies, domain operability and statistics/read consumers. Dedicated fixture supplied; real persistence execution remains blocked and is not accepted by this checkbox.

Target files: new CLI module and `backend/test/crm-showcase.integration-spec.ts`; narrowly scoped inventory/sales/purchase helpers/tests; root/backend manifests. Existing seed/reset/schema/migrations remain unchanged.

### 3. Storefront adjustments (independent of generation after contract)

- [x] Add pure selectors for availability and category/brand affinity, and adapt API mapping to preserve explicit false flags and real brand identity.
- [x] Use selectors in Home and product route with fresh public data; preserve error handling and exclude depleted flagged products/current product/duplicates.
- [x] Add accessible non-overlapping “Sin stock” badge to both card densities; preserve detail access.
- [x] Add focused adapter/discovery acceptance checks and browser verification including multi-variant/infinite/depletion states. Browser evidence uses a synthetic loopback API, not real persistence.

Target files: `src/lib/product-discovery.ts`, `src/lib/api/catalog/catalog-api.repository.ts`, `src/lib/data/shop-routes.ts`, `src/app/(shop)/page.tsx`, `src/components/shop/products/ProductCard.tsx`, acceptance harness and focused E2E tests.

### 4. Verification and independent review

- [x] Run focused tests while implementing and final backend build/unit, frontend acceptance/type/lint checks. Backend build passed; 88 unit suites / 522 tests passed; frontend 16 harnesses passed; typecheck passed; scoped ESLint passed with 0 warnings (global lint has 2 pre-existing errors in catalog-cutover outside scope); Playwright browser E2E passed (1 passed, isolated ports 3217/3218).
- [x] Verify real persistence and authenticated service/HTTP consumers; ensure no outbound integrations and clean up task-created processes with bounded waits. Real checkout 2 tests, persistence 9 tests and 21 real HTTP endpoints passed. Dedicated loopback API and copy container removed. New visual CRM browser validation is not claimed; earlier storefront fixture evidence remains separate.
- [x] Delegate independent review of code, PRD/design compliance, safety, ledger math, idempotence, real consumers and validation evidence. Formal review completed: PASS WITH FINDINGS (PASS for code and runtime local acceptance; nonblocking findings for manual visual CRM run and pg driver warning; see [review report](./crm-showcase-simulator/review.md)).
- [x] Delegate concrete fixes if needed and request re-review until no blocking findings. Document any unexecuted checks precisely. Fixed reviewer finding on preflight quote ordering vs early purchases with regression test in `historical-writer.spec.ts` (tested old order fail, new order pass); re-review completed with zero blocking code findings.

### 5. Closure

- [x] Record redacted execution evidence and concise operator backup/command/restoration instructions; reconcile only relevant documentation. Captured in `backend-operator-guide.md`, `backend-evidence.md`, `storefront-evidence.md`, and `review.md`.
- [x] Final independent re-review and documentation archival completed. Independent review approved with PASS WITH FINDINGS (code and runtime local accepted). Canonical documentation and tech debt tracker reconciled, and ExecPlan archived to `docs/exec-plans/completed/crm-showcase-simulator.md` per repository contract.

## Validation

Use explicit tool timeouts. Exact executed and authorized commands:

```bash
# Backend build and focused generator unit suite
npm run build:backend
npm --prefix backend run test:unit -- --runTestsByPath src/modules/crm-showcase/historical-writer.spec.ts src/modules/crm-showcase/scenario.spec.ts src/modules/crm-showcase/crm-showcase.service.spec.ts src/modules/crm-showcase/target-policy.spec.ts

# Full backend unit suite (88 suites / 522 tests pass)
npm run test:backend

# Fail-closed dedicated persistence verification (fails closed in beforeAll without authorized manifest)
npm run test:crm-showcase

# Root CLI command forwarding (fails closed without CRM_SHOWCASE_DATABASE_URL and authorization manifest)
npm run seed:crm-showcase -- --seed review-demo --reference-date 2026-10-09T15:00:00Z --authorization "<private-manifest-path>"

# Frontend acceptance harness (16 harnesses pass)
npm run verify:frontend-acceptance

# Root TypeScript compiler check
npx tsc --noEmit

# Scoped ESLint check (0 errors, 0 warnings on touched files)
npx eslint "backend/src/modules/crm-showcase/**" "src/lib/product-discovery.ts" "src/lib/api/catalog/catalog-api.repository.ts" "src/lib/data/shop-routes.ts" "src/app/(shop)/page.tsx" "src/components/shop/products/ProductCard.tsx" "tests/harnesses/**" "tests/e2e/crm-showcase.spec.ts"

# Browser E2E suite on isolated synthetic loopback fixture (ports 3217/3218)
npx playwright test --config tests/e2e/crm-showcase.config.ts
```

*Note on linting:* Global `npm run lint` fails on 2 pre-existing `@typescript-eslint/no-non-null-asserted-optional-chain` errors in `backend/src/modules/catalog-cutover/catalog-cutover.spec.ts` (lines 203, 215), which are outside the scope of this workstream. All files touched by this plan pass ESLint with zero errors and zero warnings.

Integration setup must require explicit isolated authorization before client construction; never run a destructive suite using implicit `DATABASE_URL`. Compare structural catalog and whole-state digests, stock events/balances, immutable snapshots, coupon usage, session graph, qualified metrics and rerun behavior. Browser evidence must cover actual admin routes and public cards/discovery. Production/source data are not test fixtures.

## Progress Tracking

- 2026-10-09 (urgent manual API fix completed): Detached fetch invocation in shared ADMIN request/refresh transport fixes browser Illegal invocation; receiver-sensitive harness red with exact reported error, then green, session lifecycle harness green. Restarted only owned trees (backend31012/frontend-parent12400). Isolated browser invalid login through Next proxy returned 401/INVALID_CREDENTIALS, no tokens/admin cookies; anonymous detached native admin probe reached 401. Launcher status now verifies empty-body login 400/VALIDATION_ERROR rather than treating GET200 as auth proof. All 16 frontend acceptance harnesses, root TypeScript, scoped lint, launcher syntax and diff checks passed. No seed/config/reset/account/password changes. Initial shared-context navigation caused an incidental existing-session refresh; immediately closed that owned tab, used isolated contexts thereafter and preserved auth history. Guide/evidence updated under completed delivery path; no archival reversal or new review claim.

- 2026-10-09 (urgent manual API diagnosis, before fix): Current Next proxy forwards malformed login to backend with 400/VALIDATION_ERROR; browser anonymous GET on 3228 reaches 401, while 3001 fails. Launcher already supplies 3228 and matching gate, so do not assume an env mismatch. Exact “The administrator API is unavailable” originates in shared AdminApiClient: browser reproduction shows native fetch invoked as an object method throws “Illegal invocation” before any network request. Authorized focused fix: invoke injected fetch as a detached function in request and refresh paths, add red/green receiver-sensitive harness, keep authentication/authorization contracts unchanged. Extend private launcher health with malformed empty-body proxy reachability (no credential attempt), restart only owned processes, then one deliberate invalid-credential browser POST in isolated context, expecting 401/INVALID_CREDENTIALS and no cookies. No seed/config/reset/account changes or successful agent login permitted.

- 2026-10-09 (easy manual GUI follow-up): Spanish guide now leads with live links and exact PowerShell start/status/stop commands. Private guarded launcher started compiled backend 3228 and standard Next dev frontend 3300, with matching auth gate, all real API URLs and CORS; HTTP Home/login/product and catalog649 passed, browser login form/stability/no-console-error smoke passed. No credentials entered or database writes; full-state digest unchanged. Native Next CLI replaced a private custom-server refresh-loop experiment. Backend PID9732/frontend-parent14968 retained **by explicit owner request** for manual GUI testing, with signature-checked stop instructions. No application code/env changes or new seed/configuration.

- 2026-10-09 (local operational completion): Manual options configured on copies; real shipping/pickup checkout 2/2 passed; persistence A/B 9/9 passed including final ADMIN/token preservation assertion (64.057s). Local configuration then one CLI generated 20 customers/80 orders/3 suppliers/4 purchases/6 coupons/8 abandonments; immediate rerun `already-generated` with identical full-state digest. Source ledger/catalog/auth/coupon/cart checks and 21 real HTTP endpoints passed. Fixed SQL NULL optional snapshots, original timestamp precision and reserved customer-ID contract incompatibilities without migrations or local cleanup. Final backend 89 suites/528 tests passed, build/typecheck/16 frontend harnesses/scoped lint passed. Owned API/container removed, private backup/manifests ACL restricted. [Evidence](./crm-showcase-simulator/local-owner-evidence.md); [Spanish guide](./crm-showcase-simulator/guia-operador-local.md).

- 2026-10-09 (explicit owner-authorized local continuation): Updated plan/design/PRD before implementation; added exact-fingerprint trusted-owner authorization with isolated restore evidence and linked ADMIN token preservation, keeping default isolation. New private backup SHA-256 `5c965ab3edaefcae2160decc5eee7e6a162175b103ecc5a2307234a578a0bac5` restored on dedicated loopback PostgreSQL `55439`; all rows across 40 public tables matched source. Two unit suites/41 tests passed (11.291s), backend build and scoped lint passed. No local database writes/configuration/seed executed. Real checkout/persistence and operational acceptance remain unfinished, not blocked by legitimate admin accounts. See [local-owner evidence](./crm-showcase-simulator/local-owner-evidence.md).

- 2026-10-09: User approved diagnosis and full delegated workflow. PRD refined; designer completed design without application changes. Implementation not yet started; no database writes performed by this plan.
- 2026-10-09 (commercial backend workstream): CLI, historical writer, inventory context, shared calculations and dedicated persistence fixture implemented. Backend build and full unit suite passed (87 suites / 521 tests); focused suite passed (8 suites / 90 tests). Read-only source inspection found 38 non-reserved admin emails, 127 refresh tokens and inactive/unconfigured payment/shipping/pickup, so no dump/copy or source repair was attempted. Dedicated persistence setup demonstrated fail-closed rejection without explicit isolated A/B authorization; runtime acceptance, authenticated consumers and independent review remain pending. See [backend evidence](./crm-showcase-simulator/backend-evidence.md) and [operator guide](./crm-showcase-simulator/backend-operator-guide.md).
- 2026-10-09 (backend blocking review correction): Moved quote validation after early transactional purchases/receipts so TRACKED variants with imported quantity zero remain supported. Added writer orchestration regression: 4 scoped suites / 51 tests passed; restoring old order made the regression fail as expected, then corrected-order rerun passed. Backend build and scoped lint passed with zero warnings; design/evidence clarify service read-only guards and transaction rollback. Primary warning fixes retained; no database access/provisioning or frontend changes in this correction. Real persistence acceptance remains blocked.
- 2026-10-09 (storefront workstream): Permanent discovery selectors, truthful adapter mapping, fresh Home/detail reads and both-density stock badges implemented. Frontend acceptance passed (16 harnesses), TypeScript and scoped ESLint passed. Full lint remains blocked by two unrelated backend catalog-cutover errors. Browser/isolated runtime acceptance remains unchecked; see [storefront evidence](./crm-showcase-simulator/storefront-evidence.md). Backend, source database and root manifests were not modified by this workstream.
- 2026-10-09 (storefront browser follow-up): Dedicated Next process on 3217 and synthetic HTTP fixture on 3218 verified real Home/detail/listing navigation, fresh depletion, existential multi-variant/infinite eligibility and card labels/contrast/non-overlap at 1440/390 widths. Reusable focused Playwright test passed (1 test); acceptance (16 harnesses), TypeScript and scoped lint passed again. Manual owned process tree and subsequent Playwright-managed process tree cleaned up; bounded probes confirmed both ports closed. Earlier browser limitation is superseded for storefront fixtures only, not CRM/persistence. Task-generated `recordings/` files removed; screenshots/logs remain outside the repository in the approved temp directory.
- 2026-10-09 (independent review & archiver documentation reconciliation): Independent reviewer issued PASS WITH FINDINGS (code and runtime local acceptance approved; nonblocking findings for manual visual CRM run and pg driver pool warning documented in `review.md`). ExecPlan reconciled, tech debt tracker updated, canonical documents aligned, and ExecPlan archived to `docs/exec-plans/completed/crm-showcase-simulator.md`.

## Implementation Outcome

### Implemented

- **Backend CLI & Historical Writer**: Added CLI-only `backend/src/modules/crm-showcase/` with deterministic PRNG scenario generator, single-transaction atomic writer (`MutationGate`), append-only inventory ledger integration, idempotent completion marker (`OrderHistory.id=crm-showcase:completion`), strict loopback/target policy, and fail-closed destination validation. Wired root script (`npm run seed:crm-showcase`) and backend entrypoint (`crm-showcase.main.js`) without modifying application runtime, database migrations, or legacy reset/seed scripts.
- **Trusted-Owner Local Authorization**: Supported explicit trusted-owner authorization for `127.0.0.1:5432/entrenar` (public schema) tied to backup verification on an isolated container (`55439`), preserving 42 ADMIN users and 127 legitimate refresh tokens.
- **Manual Demo Commerce Configuration**: Prepared manual demo payment (bank transfer `direct-transfer`), shipping (`andreani` home delivery), and pickup without external gateway calls or outbound network requests.
- **Single-Shot Local Generation**: Generated 80 orders, 20 customers, 3 suppliers, 4 purchase orders, 6 coupons, and 8 abandoned carts within a 60-day window. Idempotent rerun reported `already-generated` with identical full-state digest (`db01ca0da313b04ea0078e944194d7207a9fa17fed76719015abf58e5b8d31ba`).
- **Storefront Discovery & Badging**: Implemented pure read-time product discovery selectors (`src/lib/product-discovery.ts`) with category and brand affinity ranking, fresh public catalog reads excluding depleted/duplicate products, truthful flag mapping in catalog adapter, and accessible "Sin stock" badge across standard and compactMobile card densities with WCAG AA contrast (>= 4.5) and non-overlapping positioning.
- **Customer Identifier Contract**: Supported the exact reserved namespace `crm-showcase:<64 lowercase hex>` across backend schemas and frontend adapter validation alongside standard identifiers.

### Deviations from Design

1. **Preflight Quote Validation Order**: Shifted completion quote validation after early historical purchases and receipts within the single atomic transaction. This accommodates imported TRACKED variants starting at 0 stock that are legitimately funded by initial purchases before checkout deductions occur. Verified by regression test (`historical-writer.spec.ts`).
2. **Optional Snapshot Null Representation**: Restructured optional address and bank snapshots to use SQL NULL (`Prisma.DbNull`) rather than JSON null (`'null'::jsonb`), resolving the `Order_snapshot_objects_check` database constraint failure during pickup completion. Verified with unit suite `checkout-order.repository.spec.ts`.
3. **Preservation of PostgreSQL Microsecond Timestamps**: Restored catalog timestamps (`Product.updatedAt`, `ProductVariant.updatedAt`) via parameterized raw SQL with explicit `::timestamp` casting to avoid JavaScript `Date` truncation of microsecond precision, ensuring zero spurious differences in post-run catalog verification.
4. **Customer Identifier Namespace**: Extended identifier validation regex in `customers.schemas.ts` and `contracts.ts` to strictly permit `crm-showcase:<64 hex>` without opening the contract to arbitrary punctuation.

### Validation

- **Backend Unit Tests**: 89 suites / 528 tests passed (`npm run test:backend`), including 5 suites / 57 tests in `crm-showcase` and inventory/sales/checkout helpers.
- **Backend Build**: NestJS compilation clean (`npm run build:backend`).
- **Frontend Acceptance Harness**: 16 harnesses passed (`npm run verify:frontend-acceptance`), including contracts with reserved customer IDs and catalog affinity.
- **Type Checking**: Clean compiler run with zero errors (`npx tsc --noEmit`).
- **Linting**: 0 errors, 0 warnings on all touched scope files via scoped ESLint. (Global `npm run lint` exhibits 2 pre-existing errors in `catalog-cutover.spec.ts` strictly outside scope).
- **Playwright Browser E2E**: 1 test passed (`npx playwright test --config tests/e2e/crm-showcase.config.ts`) on isolated loopback ports 3217/3218 using in-memory synthetic fixture, verifying Home/detail/listing discovery, dynamic depletion re-evaluation, and card badges.
- **Fail-Closed Verification**: `npm run test:crm-showcase` and CLI executions without authorization verified to abort in preflight before database client initialization, ensuring zero writes to unauthorized databases.
- **Isolated Backup & Restore**: Consistent custom-format dump verified with SHA-256 `5c965ab3edaefcae2160decc5eee7e6a162175b103ecc5a2307234a578a0bac5`; restored into isolated container `entrenar-crm-owner-restore-20261009` (port 55439) with all 40 public tables matching source row-for-row.
- **Isolated Copy Validation**: Real checkout (2/2 passed) and persistence resilience suites (9/9 passed, 64.057s) verified on disposable restored copies prior to local execution.
- **Authorized Local Generation**: Single transaction executed in 7.14s on `127.0.0.1:5432/entrenar`. Immediate rerun returned `already-generated` in 1.13s with identical whole-state digest. All 42 ADMIN users and 127 refresh tokens preserved intact. Zero orphaned rows, 0 coupon mismatches, balanced inventory ledger (101 movements).
- **HTTP Service Verification**: 21 real public and administrative endpoints returned HTTP 200 OK via local NestJS instance (port 3228).
- **Manual GUI Runtime Smoke**: Backend localhost:3228 (PID 9732) and frontend localhost:3300 (PID 14968) active, login/home/product returned HTTP 200 with CORS 3300 enabled; browser login rendered with 0 console errors; DB digest unchanged.
- **Independent Review**: Formally approved with PASS WITH FINDINGS (code and runtime local accepted; documented in `review.md`).

### Follow-up

- **Manual Visual CRM Navigation**: Complete interactive navigation across the CRM admin panel (`/admin/*`) on live data remains to be manually verified by the operator (Finding 1 in `review.md`).
- **Port 3001 Listener**: A pre-existing indeterminate process on host port 3001 returning HTTP 404 was preserved untouched and remains for operator inspection/handling (Finding 2 in `review.md`).
- **Postgres Driver Scheduling Warning**: Deprecation warning in `node-postgres` pool during concurrent query scheduling observed without functional impact (Finding 3 in `review.md`).
- **Repository Technical Debt**: Long-term production payment gateway integrations (MercadoPago) and automated hourly reset mechanisms remain tracked in `docs/exec-plans/tech-debt-tracker.md`.
- **Private Backup Security**: The private backup `C:\Users\Nahuel\AppData\Local\Temp\opencode\crm-showcase-owner-20261009.backup` contains sensitive authentication data; it must be preserved securely outside temporary directories and never committed to the repository.
- **Local Invariance**: Do not execute legacy reset or seed scripts on `127.0.0.1:5432/entrenar`. The completion marker ensures any CLI re-run is a safe no-op.
