# ExecPlan — Mercado Pago Card Payments (Orders API)

**Status:** Active  
**Started:** 2026-10-21

## 1. Objective

Deliver embedded Mercado Pago card payments in `/checkout` (Card Payment Brick + Orders API, `processing_mode: automatic`) with server-authoritative amounts, verified webhooks, reconciliation, payment-safe stock handling and admin visibility, as defined by the PRD, design and specs below.

## 2. Context

- PRD and owner decisions D-1..D-6: [`docs/references/prds/entrenar-mercadopago-payment-prd.md`](../../references/prds/entrenar-mercadopago-payment-prd.md)
- Technical design (authoritative for mechanics): [`docs/design-docs/2026-10-21-mercadopago-card-payments.md`](../../design-docs/2026-10-21-mercadopago-card-payments.md)
- Behavior: [`mercadopago-card-payments`](../../product-specs/mercadopago-card-payments/spec.md) plus updated `checkout-complete`, `checkout-ui-flow`, `checkout-quote`, `commerce-payments`, `admin-sales-lifecycle`, `admin-sales-flow`, `admin-sales-frontend-adapters`, `admin-payment-methods`, `inventory-sales-transactions`.
- Main code areas: `backend/src/modules/checkout`, new `backend/src/modules/payments`, `backend/src/modules/sales`, `backend/src/modules/inventory`, `backend/prisma`, `backend/src/config/app.config.ts`, `src/lib/api`, `src/components/checkout`, `src/app/(checkout)`, admin sales UI.
- Sandbox: Mercado Pago application "entrenAR" (test credentials in env), webhook test URL `https://api-dev.entrenar.shop/api/v1/payments/mercadopago/webhooks` through the local Cloudflare tunnel.

## 3. Scope & Non-Goals

**In scope:** cards only; submission-time order placement and stock deduction; sequential attempts on the same order with a 10-minute rejected-retry window; 3DS and review holds; UNKNOWN outcome handling without token persistence; signed webhooks with durable inbox; scheduled expiry and reconciliation; refund/chargeback/fraud reflection; admin guards and visibility; result and recovery UI.

**Non-goals:** Rapipago/Pago Fácil, wallet/Cuotas sin Tarjeta, Checkout Pro, `/v1/payments`, admin-initiated refunds, enforced CSP, changes to the bank-transfer flow, fixing the pre-existing account `CONFIRMED → "entregado"` mapping, production deployment.

## 4. Execution Plan

Each stage is a chained branch off the previous one, with conventional commits and its own validation. No push or PR until the owner requests it.

| # | Branch | Work |
|---|---|---|
| 0 | `docs/mercadopago-payment-prd` | PRD, design, specs, this ExecPlan. |
| 1 | `feat/mp-1-backend-base` | Zod env config (`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_ENVIRONMENT`; all-or-nothing), env examples, `MercadoPagoOrdersPort` + thin HTTP adapter with fixtures, additive Prisma migration (payment provider fields, `PaymentAttempt`, `PaymentNotification`, enum additions, partial unique indexes), exhaustive enum consumers. No behavior change. |
| 2 | `feat/mp-2-payment-flow` | Transactional placement for cards, in-request create with idempotency key, reducer, retry endpoint, owner status and active-order endpoints, quote card availability. Kept disabled until stage 4 workers exist. |
| 3 | `feat/mp-3-webhooks` | Public throttle-exempt webhook, HMAC verification, durable inbox, inbox worker with authoritative GET, chargeback/fraud signal recording. |
| 4 | `feat/mp-4-expiry-reconciliation` | `@nestjs/schedule`, leases/fences with `SKIP LOCKED`, retry-window expiry with exactly-once compensation, pending/UNKNOWN reconciliation, financial fallback, attention flags. |
| 5 | `feat/mp-5-admin` | Sales guards (manual confirm/bypass paths rejected, fulfillment guards, paid cancel after full refund), admin DTOs/adapters and UI for provider state. |
| 6 | `feat/mp-6-frontend` | `@mercadopago/sdk-react` CardPayment boundary, single pay action, 3DS iframe, result route, polling, cart-generation cleanup, recovery. |
| 7 | `feat/mp-7-closure` | Sandbox E2E through the tunnel, operational docs, final independent review, archival. |

## 5. Decisions & Rationale

- Design decisions are recorded in the design doc; owner decisions in PRD §7.
- 2026-10-21 owner: partial refund keeps the order fulfillable with a warning; full refund blocks fulfillment; paid MP orders can be cancelled only after a full refund, with optional stock return.
- 2026-10-21 owner: no card token persistence (no encrypted outbox); uncertain creation outcomes stay UNKNOWN with stock held and admin attention after 30 minutes.
- Design must precede specs; specs derive from design.

## 6. Progress Tracking

- [x] Stage 0 — PRD, design, specs, ExecPlan
- [x] Stage 1 — Backend base
- [x] Stage 2 — Payment flow (reviewed; findings fixed in `8e37b50`)
- [x] Stage 3 — Webhooks
- [x] Stage 4 — Expiry and reconciliation (implemented; independent review pending)
- [ ] Stage 5 — Admin
- [ ] Stage 6 — Frontend
- [ ] Stage 7 — Sandbox E2E, docs, review, archive

## 7. Validation

Per stage, as applicable: `npm run build:backend`, `npm run test:backend`, `npm run test:backend:integration`, `npm run test:backend:e2e`, `npx tsc --noEmit`, `npm run lint`, `npm run verify:frontend-acceptance`, `npm run build`. Independent review after stages 2, 3, 4 and 7. Manual sandbox evidence (APRO, OTHE/FUND, CONT, 3DS challenge, retry, duplicate notifications, refunds) recorded in stage 7 with ledger/total checks.

Evidence log:

- Stage 0: documentation link checks and `git diff --check` passed.
- Pre-existing: 5 integration suites (`showcase-reset`, `checkout-quote`, `checkout-completion`, `commerce`, `catalog-persistence`) fail on the local dev DB with `Product p-whey-pro must have at least one ProductVariant`, independent of this work.
- Stage 1: migration `20261021180000_mercadopago_payments_foundation` applied with `prisma migrate deploy`; build, `tsc`, unit (610) pass; `migrate status` up to date.
- Stage 2: build, `tsc`, unit (665), e2e (15 suites) and `payments-card.integration-spec.ts` pass. Independent review PASS WITH FINDINGS; fixed: active endpoint scoped to session, provider AUTH → order cancelled without charge + 5-min circuit breaker, cart trimmed by purchased quantity, no redundant GET on challenge, CREATE limited to 1 call until Stage 7 verifies idempotency retention.
- Stage 3: build, `tsc`, unit (707), e2e (16 suites incl. webhook) pass. Independent review PASS WITH FINDINGS; fixed in `a0bcd5f`: fraud alerts always quarantined (`unverified_fraud_association`, topic is unsigned), dedup key bound to signed request id + ts, topic read only from query. Note: the local test webhook secret was printed once in a debug terminal session (never committed); owner advised to rotate it.
- Stage 4: `@nestjs/schedule` 6.1.3; workers enabled unless `NODE_ENV=test` or `PAYMENT_WORKERS_ENABLED=false` (timers registered only when enabled). Cadences: inbox 5 s, expiry 15 s, pending reconcile 15 s tick with per-attempt due cadence (30 s → 2 min → 5 min, 15 min for reviews > 24 h), financial fallback 60 s tick over attempts due every 24 h, attention sweep 60 s. No migration (lease owner is represented by the fence). Build, `tsc`, unit (727), e2e (16 suites) and `payments-reconciliation` + `payments-card` integration specs pass. Test fixtures leave the unique-per-run product, variants and append-only ledger rows (the ledger forbids deletion).
- Stage 4: `@nestjs/schedule` 6.1.3; build, `tsc`, unit (738), payments integration (`payments-reconciliation` 6, `payments-card` 3) and payments e2e pass. Independent review PASS WITH FINDINGS; fixed in `4364bf3..6743a97`: hidden reconciliation fixture products (4 leftover dev-DB rows set HIDDEN, none deleted), attention-sweep unit tests, empty-attempts guard, shutdown deletes only payment intervals.
- Deferred (tech debt): shared `createCheckoutFixtures` creates VISIBLE `checkout-api-product-*` products that are never deleted (pre-existing pattern, also used by card specs).
- Deferred (tech debt): guest cart items added during payment become unreachable after the guest session completes; `cancelUncreated` and cart trim lack DB-level integration tests.

## 8. Final Implementation Outcome

_Pending._
