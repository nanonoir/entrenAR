# Design: Mercado Pago Card Payments with Orders API

**Status:** Implemented and Delivered (2026-10-22)<br>
**Authority:** [Refined PRD](../references/prds/entrenar-mercadopago-payment-prd.md), including D-1–D-6. This document defines technical rules for subsequent product specs; it does not reopen those decisions.<br>
**Date:** 2026-10-21 (Delivered: 2026-10-22).

Use Card Payment Brick and automatic Orders API processing. Create the internal order, SUBMITTING attempt and stock deduction in one database transaction **at card submission**, then immediately call Mercado Pago in the same request outside that transaction. Card tokens exist only in memory and are never persisted, even encrypted; uncertain outcomes are recovered by provider reads, never background CREATE replay. A single backend payment reducer handles creation responses, verified webhooks, return/reload checks and scheduled reconciliation. One internal order can have several sequential attempts, but never two potentially payable attempts. Transfer checkout remains unchanged.

## Context and boundaries

This is an independent addition to [backend checkout](./2026-09-03-backend-core-phase-5-checkout.md), [sales CRM](./2026-09-04-backend-core-phase-6-sales-crm.md) and [checkout recovery](./2026-10-19-checkout-inputs-drafts-delivery.md), not a replacement of those designs. For Mercado Pago only, it supersedes immediate cart clearing and manual payment confirmation. [Architecture](../../ARCHITECTURE.md) and [frontend conventions](../FRONTEND.md) continue to govern dependency direction.

Current code evidence:

- `CheckoutCompletionService.complete` already owns quote continuity, request-hash idempotency, snapshots, coupon redemption, stock deduction, cart clearing and session completion. Its unconditional last two effects cannot be used unchanged for cards.
- `Order.checkoutSessionId` is unique. Reuse that association to prevent a second order on the same payment checkout; retry does not rerun checkout pricing or redeem a coupon again.
- `OrderPayment` is the immutable method/amount snapshot and mutable payment summary, not a provider-attempt history. Its snapshot trigger must remain effective.
- `SalesService.executeLifecycle` can confirm, cancel/restore, reopen/re-deduct; `convertOrderToSale` can transfer inventory ownership. All are bypass risks unless gateway-specific backend guards are added.
- `CheckoutWizard` renders payment separately from the sidebar CTA and currently assumes an empty cart ends checkout. The result/recovery surface must work independently of cart contents.

Proposed responsibilities:

| Area | Responsibility |
|---|---|
| `modules/checkout` | Owner/session authorization, mandatory fresh quote continuity, immutable order construction, coupon handling, first deduction and checkout-to-order association. Export a narrow transactional placement operation, with explicit transfer/card finalization policies. |
| New `modules/payments` | Attempts, provider port/client, in-request submission, durable inbox, normalized reducer, reconciliation, gateway fulfillment eligibility and public webhook controller. No catalog price calculations. |
| `modules/orders` / shared order persistence | Transactional confirmation/history projection; preserve existing snapshot protections. |
| `modules/inventory` | All deduction and compensation through existing ledger APIs. |
| `modules/sales` | Admin lifecycle and read DTOs; check payment eligibility under the same order lock. Never call the provider to manufacture approval. |
| `src/lib/api/checkout` and new `src/lib/api/payments` | Strict typed transport, localized errors, no Next.js proxy. |
| Checkout client components | Brick lifecycle, safe submission, recovery and result presentation; never gateway truth. |

Dependency direction: checkout imports the payment application port to prepare an attempt within its placement transaction; payments does not import `CheckoutModule`. Extract only the existing narrowly reusable order/cart finalization persistence operations to a lower shared boundary if needed. Sales uses the payment eligibility/read port; payments does not import `SalesService`. No circular module imports or duplicate money/stock engines.

## Persistence: snapshots, attempts and durable work

Keep `OrderStatus = PENDING | CONFIRMED | CANCELLED`. Shipping states remain independent; approval does not mean delivered. Extend `PaymentStatus` additively with `PARTIALLY_REFUNDED` and `CHARGED_BACK`; keep `PENDING`, `PAID`, `REFUNDED`. Pending subtypes belong to attempts, not to the fulfillment enum.

| Record | Required data/invariants |
|---|---|
| `OrderPayment` | Existing immutable method, amount, currency and snapshots unchanged. Add nullable provider discriminator (`MERCADOPAGO` for newly integrated payments only), `activeAttemptId`, aggregate refunded amount, retry deadline, fulfillment hold reason(s), review-start/attention timestamps and row version. Provider discriminator and snapshot association are write-once. |
| New `PaymentAttempt` | FK to `OrderPayment`, sequential attempt number, client idempotency key and canonical request hash, server UUID provider idempotency key, expected amount/currency, normalized status, provider order/transaction IDs, provider reference IDs when supplied, raw **allowlisted status fields**, provider version/update time, local version, submission-start/outcome timestamps, next reconciliation time, reconciliation lease/fence, retry count and last sanitized error. Unique `(paymentId, attemptNumber)`, `(paymentId, clientKey)`, provider order ID, provider transaction ID and provider idempotency key. No card token or serialized CREATE body is persisted. |
| New `PaymentNotification` | Durable inbox: verified receipt time, normalized signed query resource ID, topic, event ID when present, request ID, timestamp, digest/dedup key, bounded allowlisted metadata, processing state, association or quarantine reason, next-run/lease fields. Never store arbitrary complete provider responses. |

Attempt states: `SUBMITTING`, `UNKNOWN`, `PROCESSING`, `ACTION_REQUIRED`, `APPROVED`, `REJECTED`, `CANCELLED`, `EXPIRED`, `PARTIALLY_REFUNDED`, `REFUNDED`, `CHARGED_BACK`. An attempt is created as SUBMITTING; there is no queued CREATE command or outbox table. `UNKNOWN` means an uncertain transport outcome, **not** rejection. Store raw order and transaction status/detail separately for diagnostics. An append-only transition audit (or uniquely keyed payment transition record) gives each applied change a unique history effect key; use existing `OrderHistory` for the admin projection.

Use SQL partial unique indexes to allow at most one unsettled attempt (`SUBMITTING/UNKNOWN/PROCESSING/ACTION_REQUIRED`) per payment and at most one successful attempt per payment (including refund/dispute descendants). Application guards additionally disallow any attempt after success. Add nonnegative/bounded money checks and indexes on due work/retry deadlines, provider references and unresolved notifications. Provider reference IDs are strings even when numeric; do not confuse `PAY…` transaction IDs with legacy numeric payment IDs.

`external_reference` is the stable internal order ID, identical across retries. Each attempt creates a **new Mercado Pago order with one payment transaction** and a new provider UUID key. Do not append transactions to a failed provider order: separate orders simplify retry idempotency, 3DS expiry and audit history. Provider IDs live in attempts linked to the internal order; admin DTOs expose this relationship without copying IDs into immutable snapshots.

Migration is additive: nullable provider metadata, new tables/indexes, additive enum values and payment-history event types. Do not rewrite existing payment snapshots, disable the immutable snapshot trigger or classify historical `mercado-pago` selections as real gateway charges. Existing rows without a provider discriminator remain legacy/manual, including transfer. Update exhaustive Zod enums, DTO mappers, lifecycle rules, statistics/refund consumers and mocks for new payment values; do not silently count refunded/disputed money as ordinary paid revenue. Inspect snapshot-trigger column allowlists in the migration; protect new immutable identity columns separately. No destructive backfill or general reseed.

## API contracts and identity

All routes use `/api/v1`, existing response/error conventions, strict Zod request schemas and OpenAPI DTOs. Existing checkout authorization accepts guests via the opaque checkout session and customers via the storefront JWT; admins cannot buy. A URL/order number or provider ID is never authorization.

| Route | Contract |
|---|---|
| Existing `POST /checkout/quote` | No stock reservation/order creation. Expose card availability only if commerce method is active and backend integration is configured; frontend also requires the public key. Return server amount/ARS and quote ID. |
| `POST /checkout/payments/mercadopago` | First card submit: current checkout customer/items/delivery/coupon/session fields, **required quoteId**, client `idempotencyKey`, allowlisted `card: { token, paymentMethodId, installments, payerIdentification, payerEmail }`, optional supported device-session identifier. No caller-selected provider/type/reference/processing mode. Discard Brick `transaction_amount` in the adapter; it is never used in the backend amount calculation. Strict API rejects unexpected fields rather than accepting arbitrary Brick objects. |
| `POST /payments/orders/:orderId/attempts` | Retry: owner proof, new client key and new tokenized card fields only. No items, delivery, coupon, total or payment-method switching. Server charges the frozen order amount. Only a verified rejected last attempt within its window is eligible. |
| `GET /payments/orders/:orderId` | Owner-scoped status, `Cache-Control: no-store`. Return amount/currency, order/payment/attempt state, version, safe reason/message code, retry eligibility/deadline, pending acceptance/cart-finalization flag, next poll delay, and sanitized challenge descriptor if required. Triggers/coalesces a due authoritative reconciliation on return/reload; may return cached state with `reconciling: true`, never invented success. |
| `GET /checkout/payments/active` | Resolve the current owner/session's bound order and status after a lost submit response or reload, without needing card tokens or a stored client key. Returns no unrelated customer orders. |
| `POST /payments/mercadopago/webhooks` | Explicit public and throttle-exempt route; signature validation replaces JWT. Bounded body/header lengths and ingress resource limits still apply. |

First submit returns 201 once order/attempt exist and submission has a known outcome, or 202 while submission is unresolved; repeats return the same IDs and current safe status without issuing another CREATE. Before DB commit, validation/stock/price conflicts leave **no** order, attempt, redemption or deduction. Different request with the same client key returns 409. After commit, transport uncertainty returns recoverable 202/status, not a generic “try another payment” failure. Retry after deadline or while potentially payable returns 409 with current state. Ownership failures reveal no existence details.

Use existing `CheckoutIdempotencyKey` for first placement, with a namespaced operation hash and the bound order/status locator rather than a frozen final payment status. Store no token in response snapshots. Canonical hash includes the token digest and normalized checkout/card intent, not a client amount. Replayed placement resolves the bound order even if its session is now completed. New client keys cannot circumvent the unique session/order association. Retry idempotency is scoped to payment plus key and serialized with expiry. A client key is generated once per explicit submission and reused on uncertain network retries; a different key is permitted only for a genuine new eligible attempt.

Guest result access reuses the existing securely handled session proof and its hash-to-session association, including COMPLETED sessions bound to this order. Do not add tokens to result URLs, query strings, draft or localStorage. Existing session proof transport remains authoritative; customer access checks `Order.userId`. Account switching/logout invalidates recovery state. If the original guest session expires, show a safe unavailable/support state rather than exposing an order by number. This delivery guarantees same-session reload, not unauthenticated cross-device recovery.

A new checkout after final cancellation or accepted-pending cart finalization needs a fresh checkout-session generation: never remove the unique old session/order association or reuse it for another order. Preserve the old session's authorized result lookup while valid. Cart edits during a bound payment create independent intent; they cannot cause a second placement against the bound session. Coupon consumption follows existing placement semantics (once per internal order); retries do not consume another redemption, and this change does not introduce a new coupon-restoration policy.

## Placement and provider dispatch: no network transaction

1. In the existing checkout transaction, claim placement idempotency and lock the session; validate all required sections, method availability and current quote continuity; build immutable snapshots, create pending order/payment and SUBMITTING attempt with a server UUID provider idempotency key, deduct stock (`CHECKOUT_DEDUCTION`) and redeem coupon once. Bind session/order, but **do not clear backend cart or mark session complete yet**. Persist only non-sensitive submission metadata/hash, never the token or CREATE body. The last unit is won by the first committed deduction; losing buyers never reach Mercado Pago.
2. Immediately after commit, the original request handler calls CREATE with the token and exact body held only in memory and the attempt's `X-Idempotency-Key`. Only this handler may perform bounded in-request retries; duplicate client requests resolve the existing attempt/status, not a second dispatch. There is no outbox/dispatch worker and no CREATE recovery after request completion or process crash.
3. Store provider IDs and apply a validated creation response through the reducer. Fetch `GET /v1/orders/{id}` before confirmation; synchronous success is not a browser assertion. An early webhook may attach an unbound attempt only after authenticated GET validates reference, amount, account and its unique unresolved candidate.
4. In a second short DB transaction, update attempt/payment/order/history together. Finalization clears only the submitted checkout cart generation and marks its session complete once the backend has verified approval or accepted processing/review. Do not clear a newer independently edited cart.

Do not hold Prisma transactions or row locks over HTTP. Reject both “call provider first” (can charge without stock) and “rollback after timeout” (can sell reserved stock while the charge succeeds). No distributed transaction is claimed.

No card token is persisted in DB, history, logs, browser persistence or a queue, even encrypted. No encryption env key is required. The token and serialized provider request exist only for the originating request's lifetime and must not be captured by request tracing/error serialization. A process crash after placement may therefore leave a reservation even if CREATE never started; absence of a stored token deliberately prevents automatic resubmission.

The HTTP client uses a 10-second overall abort timeout per call and fixed `https://api.mercadopago.com` origin; no arbitrary callback/resource URL fetch. Allow at most two CREATE calls within a 25-second originating-request budget, with 500–1000ms jitter before the second call, identical bytes/key and the token still in memory. Retry only transient failures and only within the provider's verified idempotency guarantee; do not exceed a longer Retry-After or request deadline to force a retry. The short budget limits customer/proxy waits while allowing one transient recovery. A 409 with mismatched provider body is an invariant incident, not permission to generate another key. Do not infer noncreation from timeout, 5xx, malformed response or a single GET/search miss.

After exhausted retries/uncertain outcome, mark UNKNOWN and hold stock; a SUBMITTING attempt still unresolved after 1 minute is also moved to UNKNOWN by reconciliation to recover handler crashes. Known provider order ID always uses GET. Missing-ID recovery searches `GET /v1/orders` by external reference and bounded creation range, paginates within bounded work batches and verifies each candidate. Exclude provider IDs already bound to earlier attempts; attach only a unique verified candidate consistent with the unresolved attempt's submission time, amount and account. Ambiguity is an attention incident, not a guessed association. No worker or later client replay may issue CREATE, even with the original key.

At 30 minutes from the attempt's submission-start timestamp, an unresolved missing-ID outcome raises a visible admin attention flag and operational alert; duplicates/polls do not reset this clock. Thirty minutes allows repeated provider searches and the normal initial webhook retry interval without silently holding a crash-only reservation indefinitely unnoticed. It is an escalation threshold, **not** evidence of nonpayment or an expiry. Continue bounded read reconciliation after escalation. Search absence alone never triggers release. An authorized admin may resolve the incident through the payment cancellation path only after a fresh provider re-check and panel investigation establish that no charge can still succeed; record actor, reason and verification evidence. Provider unavailability or an unresolved potentially payable charge blocks cancellation. If cancellation is authorized, mark the attempt/order cancelled and restore stock atomically through the ledger exactly once. Late contradictory approval remains an incident under the monotonic rules below.

Definitive pre-charge validation failure with documented noncreation closes the attempt as REJECTED and opens the same retry window; authorization/configuration failures additionally disable new submits and alert operations. Unknown outcomes block a new attempt. Compensation is never “best effort”: cancellation and `restoreUncompensatedDeductions` commit together or neither commits.

## Mercado Pago port and request shape

Choose a thin injectable HTTP adapter implementing `MercadoPagoOrdersPort` (`createOrder`, `getOrder`, bounded `searchOrders`, and only necessary read-only reference resolution). Node fetch, existing Zod and Node crypto suffice. The official Node `mercadopago` Order client is supported, but adds little for this small surface while obscuring exact transport retry/timeout policy. It is rejected for this delivery, not for correctness. The port returns validated normalized data and categorized errors; services/tests never depend on raw fetch or SDK types.

Provider creation projection, confirmed against [cards][mp-cards], [migration][mp-migration] and [3DS][mp-3ds]:

```json
{
  "type": "online",
  "processing_mode": "automatic",
  "capture_mode": "automatic",
  "external_reference": "<internal-order-id>",
  "total_amount": "12345.67",
  "payer": {
    "email": "<validated payer email>",
    "first_name": "<name>", "last_name": "<surname>",
    "identification": { "type": "DNI", "number": "<document>" }
  },
  "config": { "online": { "transaction_security": {
    "validation": "on_fraud_risk", "liability_shift": "required"
  } } },
  "transactions": { "payments": [{
    "amount": "12345.67",
    "payment_method": {
      "id": "<validated card method>", "type": "credit_card",
      "token": "<Brick token>", "installments": 1,
      "statement_descriptor": "ENTRENAR"
    }
  }] }
}
```

Amounts are decimal strings from server money helpers; total and the single transaction amount must match exactly. Currency returned must be ARS. Resolve card type (`credit_card`, `debit_card`, supported prepaid representation) from provider method metadata, never trust a browser-supplied type. Validate installments and method eligibility; prepaid cards may be represented by provider card method types, not a fabricated `prepaid_card` literal. Payer identification is the card payer's validated input, not necessarily the shipping recipient; merchant item data comes exclusively from snapshots. Include documented root `items` (ID/SKU, title/description/category where supported, quantity and unit price), payer/address/phone where supported and device data; no invented Payments-API `additional_info` payload. Final adapter schema/fixtures must validate the current Orders reference for optional item fields and totals with discount/shipping. Never distribute unrounded discounts in the browser to make items reconcile.

No `notification_url`, wallet, cash ticket, manual capture, auto-charge retry configuration or `/v1/payments` creation. Test/production use the same API origin with different application credentials/configuration, not a fabricated sandbox hostname. Add explicit backend `MERCADOPAGO_ENVIRONMENT=test|production`; validate expected seller/application and provider live/test indicators where available. Do not infer mode from token prefix: current documentation shows APP_USR-style test access tokens too. All integration env absent means unavailable; partial configuration fails validation. Commerce activation alone never enables an unconfigured integration. Disabling new submissions does not disable existing webhooks, reconciliation or accepted-attempt recovery.

## State machine and stock clock

The reducer validates provider identity, seller/application, environment, external reference, expected total/ARS, transaction identity and amount. Unexpected extra payable transactions, incompatible order/transaction statuses or mismatched totals enter a reconciliation/fulfillment hold, not approval. Unknown future statuses remain nonpayable to fulfillment and potentially payable for stock safety.

| Authoritative provider observation | Attempt | Payment summary / order | Inventory/retry effect |
|---|---|---|---|
| `created/created`, transport unresolved | SUBMITTING/UNKNOWN | PENDING / PENDING | Held; no retry. |
| `processing/in_process`, transaction processing or review details | PROCESSING | PENDING / PENDING | Held without a local expiry; accepted pending. |
| `action_required/pending_challenge` | ACTION_REQUIRED | PENDING / PENDING | Held; expose challenge; no new attempt. |
| Other `action_required`, including `waiting_retry`, `waiting_capture` | ACTION_REQUIRED | PENDING / PENDING | Held; unknown/unexpected cards-only variants get attention flag; never treated as rejected. |
| Order `processed/accredited` **and** matching payment transaction accredited, correct paid amount | APPROVED | PAID / CONFIRMED | Deduction final; set `confirmedAt` and payment-received history once. |
| `failed` with final issuer rejection/failed detail, including failed challenge | REJECTED | PENDING / PENDING | Open 10-minute retry window. |
| `canceled/canceled`, `canceled/expired`, `failed/expired`, documented `expired` final equivalent | CANCELLED / EXPIRED | PENDING / CANCELLED | If all attempts are definitively nonpayable: immediate ledger compensation, no retry on cancelled internal order. A failed issuer/challenge rejection uses the preceding row, not this row. |
| `processed/partially_refunded`, verified completed refund total between zero and original paid amount | PARTIALLY_REFUNDED | PARTIALLY_REFUNDED / retain lifecycle | Remains fulfillable with visible refunded-amount warning; no hold from partial refund alone and no automatic restock. |
| `refunded/refunded`, verified completed refund total equals original paid amount | REFUNDED | REFUNDED / retain lifecycle | Block further fulfillment; no automatic stock restoration. |
| `charged_back` (`in_process`, `settled`, `reimbursed`) | CHARGED_BACK | CHARGED_BACK / retain lifecycle | Persistent dispute/fulfillment hold; record case/status, no automatic restock. |

Refund/dispute changes do not reverse delivered goods or erase historical confirmation. **Owner policy resolved 2026-10-21:** verified partial refunds leave the order fulfillable with a visible admin warning and refunded amount; they do not create a fulfillment hold. Independent fraud/dispute/unknown holds still apply. A full refund blocks further fulfillment. A refund is a money event, not evidence that stock physically returned: no automatic RESTOCK on a refund/chargeback. After a full refund is verified/reflected, admin cancellation may optionally restore stock using existing cancel/restoreStock semantics and ledger compensation exactly once; cancellation never clears the REFUNDED financial state.

**Monotonic rules:** unsettled states can move between processing/action-required but cannot regress a settled observation. Final nonpayment attempts cannot become payable through stale callbacks. APPROVED can evolve only to partial/full refund or dispute; partial refund amount cannot decrease, REFUNDED cannot regress to PAID, and dispute holds are not cleared by an ordinary accredited response. Provider version is preferred; otherwise use `last_updated_date` and serialize observations with a local reconciliation fence. Do not apply an earlier fetched response after a later fetch has been applied. Equal version with incompatible data is quarantined. Refunds/disputes are legitimate financial successors, not violations of terminal payment collection.

Only the active attempt changes pending/retry presentation; a late failed observation for an older attempt never cancels a newer one. A contradictory late success on a definitively closed attempt, particularly after compensation or another success, is an incident: record gateway money truth, set fulfillment hold and alert; do not silently reconfirm a cancelled order, re-deduct stock, or charge again. Terminal CANCELLED internal orders never reopen automatically.

**Rejected retry clock:** set `retryUntil = firstVerifiedRejectionAt + 10 minutes` using database UTC time for each newly rejected attempt. Duplicate reads/events do not extend it. A valid new attempt admitted strictly before the deadline clears/suspends that deadline; if that new attempt is rejected, it receives its own 10-minute window. This follows D-2 per rejection, not a sliding clock extended by polling. At or after the deadline no new attempt is admitted, even if the worker has not run. No total retry cap is introduced; existing customer throttles remain.

**3DS clock:** record challenge creation time from provider metadata and expected 40-minute boundary for display/reconciliation only. At 40 minutes fetch authoritative state; do **not** release stock based on the local clock. Mercado Pago may update expiry later. Review has no local expiry: keep stock held, review start/age visible, attention flag after 1 hour and operational alert after 24 hours. These are attention thresholds, not payment expiry promises.

**Cancellation authority:** retry expiry may cancel only an unpaid order with no potentially payable attempt or unresolved submission. Re-fetch known provider orders before release; network failure postpones release and flags overdue work. Every transition that restores stock locks the internal order, checks its current inventory ownership and calls `restoreUncompensatedDeductions` with the original `inventoryEffectId`. Use a dedicated payment-expiry inventory origin for expiry (and compatible restoration movement kind), while admin cancellation retains the existing cancel/restoration origin; both use stable effect keys and compensates-movement uniqueness. Competing expiry/admin/webhook paths cannot compensate twice. Fully refunded admin cancellation with `restoreStock=false` performs no compensation.

## Webhooks: durable acceptance, authoritative reduction

Verify the signature **before any persisted receipt, lookup with side effects, or queue work**. Require unambiguous scalar `data.id` query and `x-request-id`, one valid `ts`, valid hex `v1`, and bounded allowed topic metadata. Lowercase query `data.id` for manifest only; preserve the original provider ID for API lookup. Use `id:[lowercase-id];request-id:[request-id];ts:[original-ts];` and timing-safe HMAC-SHA256 comparison with `MERCADOPAGO_WEBHOOK_SECRET`. Normalize 10-digit seconds or 13-digit milliseconds **only for freshness**, not HMAC input. Accept absolute clock skew up to 5 minutes. Reject invalid/stale requests with 401 and no effects. Do not require raw-body middleware.

The signed manifest does **not authenticate arbitrary body fields**. Body IDs/reference/status/topic alone cannot approve, cancel, release stock or associate an unrelated order. For order notifications compare resource IDs where available and always GET the signed resource from the fixed provider API. If provider format/body disagrees, quarantine after authenticated receipt rather than trusting its reference. This is important for optional fraud topics below.

After verification, commit a bounded inbox row and return 200 quickly (target <2s, provider deadline 22s); duplicate verified receipts also return 200. DB acceptance failure returns 503, never acknowledges volatile in-memory work. Dedup by provider/environment/topic/event ID when trustworthy plus resource identity; absent IDs use a digest of signed resource/request/timestamp and bounded event metadata. **Do not** dedup forever by resource ID: the same order emits multiple states. Durable transition idempotency remains mandatory even if a notification appears new.

An inbox worker fetches authoritative state outside DB transactions, then under the order/payment lock checks reconciliation fence and provider version, applies the reducer, appends uniquely keyed history and marks processed atomically. Unknown associations remain queued/quarantined with alert and bounded backoff; a webhook can arrive before create response persistence. Workers never blindly download body `resource` URLs. Expiry, retry, admin lifecycle and webhook reducer all lock order then payment in that order; stock locks follow existing deterministic item order. Network I/O uses leases/fences, not database row locks.

[Optional notification docs][mp-optional] confirm that fraud alerts are **not retried**, whereas normal notifications retry (initially every 15 minutes, progressively longer). The durable inbox is therefore essential but cannot guarantee receipt during an ingress/DB outage. Alert on ingress/inbox failure and compare application-panel delivery monitoring operationally. Freshness checks apply to delivery `ts`, not event creation time; old signed delivery retries can be rejected and must be recovered by reconciliation, not by weakening HMAC checks.

Chargeback notifications normalize both order-style and documented topic variants to the matching provider order. Record chargeback/case IDs and details from authoritative reads and set fulfillment hold. Fraud alerts are a durable risk signal even if the financial order remains accredited: record receipt, resolve the signed resource to an existing provider order using verified provider references, fetch that order and block packing/shipping/delivery. Show urgent instruction to stop shipment and inspect/refund in the MP panel (D-4). Already shipped/delivered orders keep their real shipping state and show an incident; no fictional undelivery. Never treat a fraud alert as proof of a completed refund.

**Provider-contract gate:** official optional-event examples use a numeric query `data.id`, a body without `data.id` for fraud, numeric `payment_id`/`merchant_order`, and `ORD…`/`PAY…` IDs for Orders; one chargeback example also disagrees between query and body. The generic HMAC recipe alone does not establish a trustworthy Orders association. Do not invent one from unsigned body IDs. Persist authenticated unmatched alerts, expose an unresolved-alert admin warning and alert operations; automatic per-order handling remains blocked until a verified provider lookup/fixture establishes association. See pending decisions.

## Scheduling and multi-instance safety

Add `@nestjs/schedule` compatible with NestJS 11 for an application-managed periodic wake-up; PostgreSQL remains the durable job store. No Redis/BullMQ or independent cron service is justified for this traffic/surface. Existing showcase reset mechanisms are not the payment scheduler or a reconciliation source.

| Work | Cadence/policy |
|---|---|
| Inbox wake-up | Every 5 seconds; small bounded batches, HTTP concurrency cap 4 per instance, backoff on 429 and provider outage. No CREATE dispatch worker. |
| Retry-window expiry | Every 15 seconds; deadline eligibility checked synchronously too. Healthy release target within 30 seconds after deadline; outages defer safely. |
| Pending reconciliation | First due after 15 seconds; 30-second cadence for first 5 minutes, then 2 minutes through challenge window, then 5 minutes. Reviews older than 24h poll every 15 minutes indefinitely. |
| Post-approval financial fallback | Reconcile paid/partially refunded orders daily, in bounded cursor batches with no arbitrary age cutoff, so lost refund/chargeback notifications remain recoverable. Fully refunded/disputed records remain eligible when an unresolved case/signal exists. |
| Stuck work / attention | Every minute; expired read/inbox leases, SUBMITTING >1m → UNKNOWN, overdue expiry, missing-ID outcome still unresolved at 30m → admin attention/alert, challenge >40m still unsettled, unmatched risk alerts and review age thresholds. |

Due-work claiming uses short transactions with `FOR UPDATE SKIP LOCKED`, DB clock, `lockedUntil`, unique owner and incrementing fencing token; 30-second lease exceeds one 10-second HTTP call. Expired leases can be reclaimed, but the old worker cannot commit results without its matching fence. These leases cover inbox/read reconciliation and expiry, not permission to replay CREATE. Concurrent reconciliation and delayed submission responses use version/fence checks and the shared order/payment lock. Claim rows in small batches to avoid leases expiring in a long in-memory queue. On shutdown stop claiming; leave durable inbox/read work recoverable, and unresolved submissions recover through UNKNOWN/provider reads only. Scheduler startup and status requests cannot each create unbounded duplicate GETs: coalesce via one due-work slot per attempt.

## Frontend: one action and recoverable result

Choose `@mercadopago/sdk-react` **1.0.7**, whose published peer dependencies include React and React DOM `^19.0.0` ([npm manifest][mp-react-npm]). Use its `<CardPayment />` in a small client-only integration boundary under `src/components/checkout/`, initialized once with the public key and `es-AR`. The official [SDK JS Card Payment contract][mp-js] provides the underlying secure fields/callbacks. React Compiler compatibility is not explicitly certified by that peer range: treat imperative mount/unmount/updated-amount behavior as a validation gate; isolate this boundary from compilation if the integration tests demonstrate a compiler interaction. Plain JS SDK is the rejected initial choice because it requires more lifecycle/controller management; it remains the fallback if the wrapper fails the React 19 lifecycle gate, without changing API or product behavior.

- Mount at the payment step only for Mercado Pago with valid identification/delivery and a current authoritative quote. Remount/update amount on accepted quote revision; invalidate submission while amount is refreshing. Never combine a stale amount Brick with a new quote ID.
- The Brick submit is the **only primary pay action**. Suppress the sidebar finalize button for card mode (retain totals and help text); transfer keeps its current CTA. Earlier-step navigation is not a second pay action. Do not build a second imperative external submit button.
- `onSubmit` validates all sections/current quote, sends only tokenized allowlisted card data through the adapter, disables concurrent submissions and resolves to the current backend state. Prevent checkout edits/payment-method switching once the order is bound and potentially payable. Retry uses that order snapshot, not a new checkout. Editing a retained cart never mutates a bound order.
- Card fields/tokens/issuer details never enter Zustand persist, draft, analytics or logs. Keep the existing manual checkout form owner; do not opportunistically migrate the wizard to RHF or wrap secure fields in local card inputs.
- For challenge, render a titled accessible iframe from the backend-validated HTTPS `transactions.payments[0].payment_method.transaction_security.url` **inside checkout**. Allow only documented MP challenge origin/path, reject credentials/unexpected schemes/hosts, and never fetch it server-side. The Orders 3DS flow uses this URL, not legacy `creq`/Status Screen Brick. Check `message` event origin **and** `source === iframe.contentWindow`; COMPLETE only triggers a status refresh, never approval. Preserve focus, offer status refresh/help, remove listener/frame on final state/unmount. Reload fetches a fresh descriptor via the owner status API.
- Custom `/checkout/resultado/[orderId]` uses backend normalized status, never query `status=approved` or Status Screen Brick payment IDs. Initial submit/active-order recovery happens before empty-cart rendering. For ACTION_REQUIRED keep/show challenge in checkout; result route links to resume it. Rejected result offers same-order retry in checkout with deadline/countdown from server time; expired result offers a fresh checkout, not an expired-order retry.
- Poll visible unresolved result every 3 seconds initially, then 10 seconds after 1 minute; pause when hidden/offline, abort on unmount, refresh on visibility/return. Backend coalesces actual provider checks to its due policy. No success wording on 202/UNKNOWN or iframe completion.

Cart/draft semantics are explicit: preserve both on SUBMITTING/UNKNOWN, challenge and rejection. Clear submitted cart and draft only on verified APPROVED or accepted PROCESSING/review (not mere HTTP 202). Backend and frontend perform their respective cleanup idempotently. Clear the **submitted generation**, not items added later; capture a cart version/fingerprint at placement and conditionally remove only that snapshot, with a finalized flag preventing repeated removal. Keep the bound order locator/owner association outside the draft. If a pending-accepted order later fails, retry still uses its frozen order; do not silently reconstruct a different cart. Draft allowlist/24h policy from the previous design stays intact; result recovery uses the server session association rather than persisting new keys/tokens in the draft.

No enforced CSP currently exists. Do not add a speculative global wildcard CSP in this feature. Record actual SDK/API/image/secure-field/challenge origins in sandbox browser evidence; any CSP rollout must allow `sdk.mercadopago.com`, needed provider API/asset origins and exact challenge frames, and must not block iframe form execution or installment disclosure. Start report-only if adding one separately; do not blanket-enable arbitrary scripts/frames or deploy a restrictive untested policy. Existing Helmet backend headers do not substitute for storefront CSP.

## Admin and operational safety

Extend sale detail/list adapters and UI with payment provider, normalized/raw status/detail, attempt count, MP order/transaction/reference IDs, attempt timeline, retry deadline, held-stock/review age, last verified time, refunded amount, fraud/dispute flags and unresolved reconciliation warning. Partial refunds show a visible warning with the refunded amount, not a fulfillment block. Missing-ID outcomes unresolved after 30 minutes expose the attention flag and provider-investigation/payment-cancellation action. Expose supported provider-panel links constructed from validated IDs; no access token, signature secret, card token or credentials UI.

Disable manual confirm in the UI **and reject it in SalesService** for provider-managed payments. Also reject legacy status setters/conversion-to-manual-sale/reopen paths that could bypass gateway truth or transfer a live gateway order's ledger ownership. Pack/ship/deliver accept verified PAID or PARTIALLY_REFUNDED, require no active fraud/dispute/full-refund/unknown hold and a legal order lifecycle. Partial refund alone never blocks fulfillment. Check these under the shared order lock; an already committed shipment cannot be retroactively stopped by a later alert, which becomes a visible incident.

Admin cancel cannot restore stock while any attempt can succeed, cannot imply refund, and cannot release via arbitrary `restoreStock=true`. Unpaid conclusively closed gateway orders and investigated UNKNOWN incidents use the payment cancellation path described above. **Owner policy resolved 2026-10-21:** a previously paid Mercado Pago order can be cancelled only after its full refund is verified and reflected internally. Before that (including partial refund), reject cancellation with instructions to refund in the MP panel and wait for verification. After full refund, reuse the existing legal cancel transition and admin `restoreStock` choice: true restores only uncompensated deductions through the original inventory ledger ownership; false cancels without a stock movement. Lock and commit cancellation, optional restoration and history together exactly once; preserve REFUNDED and refund amounts, and never issue a refund from EntrenAR. Existing shipping/lifecycle restrictions still apply. Transfer and legacy manual records keep existing rules. Customer account's pre-existing CONFIRMED→“entregado” mapping is not changed; the new result screen must not reuse that incorrect mapping.

Observability: structured order/attempt/notification correlation IDs, provider IDs, sanitized error category, status transition, in-request retry count and latency. Metrics: approval/rejection/pending distribution, UNKNOWN age, missing-ID outcomes unresolved after 30 minutes, inbox oldest age, expired retries awaiting release, stock compensation count, review age, invalid/stale signatures, unmatched risk alerts and provider 429/5xx. Redact authorization, signatures, card tokens, challenge URLs (contain guest tokens), DNI/email and request bodies in application/proxy/APM logs. No raw PAN/CVV ever reaches EntrenAR. Alert on stalled work even if new card checkout has been disabled.

## Validation and release constraints

| Layer | Required evidence |
|---|---|
| Pure/unit | Every state/detail mapping including partial refund, review, waiting_retry and challenge expiry; money/ARS/method whitelist; HMAC lowercase/seconds/ms/original timestamp/future/stale/malformed headers; exact request hashing; deadline boundary and no duplicate extension; unknown never becomes rejection. |
| Adapter contract | Official Orders creation/GET/search fixtures, one-payment invariant, optional item/payer/descriptor shape, malformed response, 409/429/5xx/abort, at most two in-request CREATE calls within 25s with identical body/key, no CREATE after request completion/crash, safe challenge URL, provider environment/account checks; no `/v1/payments` writes. |
| PostgreSQL integration | Snapshot trigger unchanged; additive enum consumers; last-unit concurrent buyers; same/different client keys; same-session different keys; retry versus expiry and webhook versus submission; SKIP LOCKED/read-lease takeover/stale-fence refusal; crash after DB commit before CREATE and after provider acceptance → UNKNOWN/read recovery only; no persisted token/body/outbox; missing-ID candidate association, 30-minute escalation without auto-release; ledger restoration and confirmation/history exactly once; no network call inside transaction. |
| Backend HTTP/e2e | Guest/customer ownership, completed-session recovery, invalid webhook no DB effects, public/throttle-exempt webhook only, durable receipt before 200, authorization of admin read/actions, all manual-confirm/conversion bypasses denied for gateway rows; partial-refund warning without fulfillment hold, full-refund fulfillment block, paid/partial-refund cancel rejection with panel instructions, verified-full-refund cancel with restoreStock true/false and duplicate/race safety; investigated UNKNOWN cancellation requires fresh provider re-check/evidence, not search absence alone; transfer regressions. |
| Frontend acceptance/Playwright | One pay CTA; stale quote blocks Brick; token/amount allowlist; rejection preserves state; pending/approval cleanup once without deleting newer cart; lost response/reload recovery before empty-cart branch; same-order retry; visible/offline polling; malicious iframe messages ignored; mobile focus/errors; React 19 development Strict Mode mount/unmount and production Compiler build. Mock provider iframe/HTTP for deterministic CI; never charge live cards in CI. |
| Manual sandbox | Dedicated test credentials, HTTPS tunnel `https://api-dev.entrenar.shop/api/v1/payments/mercadopago/webhooks`; APRO approval, OTHE/FUND rejection, CONT review, APRO-CHOK/OTHE-CHNO challenge, 40-minute expiry verification, same-order retry, lost/duplicate notifications, panel partial/full refund and chargeback/fraud fixtures/delivery association. Use test cards only. Verify backend totals and ledger before/after, not screenshots alone. |

Production enablement is gated on signed Orders webhook fixtures, optional risk-event association, request/idempotency tests, React lifecycle proof and all money/stock invariants. Deploy additive backend/schema first with card availability off; configure application secrets/HTTPS panel endpoint, then enable commerce card method only after sandbox evidence. Rollback disables **new** attempts while keeping readers, inbox and read reconciliation running and allowing bounded in-flight submissions to finish; do not revert schema or stop workers with outstanding charges. No API-version fallback to Payments API.

### Architectural delivery slices (not an execution plan)

| Slice | Technical boundary |
|---|---|
| 1. Backend base | Env/readiness, provider port, additive migration and immutable snapshots. |
| 2. Payment flow | Transactional placement/SUBMITTING attempts, memory-only in-request CREATE/retries, reducer and owner status/recovery contracts. |
| 3. Webhooks | Signature verification, durable inbox, authoritative association and risk signals. |
| 4. Expiry/reconciliation | Scheduler, inbox/read leases/fences, retry release, missing-ID search/30-minute escalation and financial fallback. Slice 2 must not be enabled without UNKNOWN/read recovery from this slice; no background CREATE replay. |
| 5. Admin | Visibility and backend lifecycle/fulfillment guards. Guards are enablement prerequisites, not optional later polish. |
| 6. Frontend | CardPayment boundary, single action, challenge/results and safe cart recovery. |
| 7. Sandbox/docs closure | Contract gates, automated/manual evidence, derived product specs and operational handoff. |

## Pending decisions and risks

- **Resolved technical contract — optional events:** Fraud alerts are quarantined with reason `unverified_fraud_association` and surfaced in the admin risk-alerts feed (`GET /api/v1/admin/sales/payment-risk-alerts`) because the fraud alert topic is unsigned and does not authenticate an internal Orders association.
- **Resolved technical contract — in-request idempotency:** `PAYMENT_CREATE_MAX_CALLS = 1` was adopted for the delivery. The provider idempotency retention guarantee under rapid retry could not be proven; uncertain outcomes transition to UNKNOWN and reconcile by authoritative reads.
- **RISK — commit-to-CREATE crash gap:** without token persistence or an outbox, a crash can hold stock for an order never submitted to Mercado Pago. Provider reads cannot prove noncreation from search absence alone; unresolved missing-ID outcomes escalate at 30 minutes and may require admin/provider-panel investigation and explicit payment cancellation. They never automatically release stock or restart CREATE. Delayed provider visibility can prolong the hold, and incorrect manual resolution can be contradicted by a late approval; evidence/audit and incident handling remain necessary.
- **RISK — no review time limit:** held inventory can remain unavailable indefinitely by binding D-2; attention thresholds/admin visibility do not release it. Fraud alerts can also be lost during ingress outages because Mercado Pago does not retry them.
- **RISK — current official documentation differs from the earlier exploration:** the current migration guide now lists account money/credit as supported in Argentina, and optional-event examples have inconsistent query/body identities. Cards-only D-1 remains binding; no scope expansion is inferred. React 19 peer support is verified, Compiler behavior still needs runtime evidence.

## Official references inspected

Retrieved 2026-10-21 through official developer pages, Mercado Pago documentation search and official SDK/npm metadata. Provider docs are moving references; preserve sanitized request/response fixtures when implementing.

- [Cards and Card Payment Brick][mp-cards].
- [Orders creation reference][mp-create] and [GET order reference][mp-get].
- [Order statuses][mp-status] and [transaction statuses][mp-transactions].
- [Orders 3DS, challenge URL, 40-minute window and sandbox challenge names][mp-3ds].
- [Orders notifications and HMAC manifest][mp-notifications].
- [Optional events, fraud format/no retries and acknowledgment deadline][mp-optional]; same behavior appears in the [shared Checkout Pro Orders optional-events page](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/optional-notifications).
- [Payments-to-Orders field/API/status mapping][mp-migration].
- [React SDK package metadata][mp-react-npm] and [official React repository](https://github.com/mercadopago/sdk-react).
- [Official SDK JS Card Payment callback contract][mp-js].

[mp-cards]: https://www.mercadopago.com.ar/developers/es/docs/checkout-api-orders/payment-integration/websites/cards
[mp-create]: https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-api/create-order/post
[mp-get]: https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-api/get-order/get
[mp-status]: https://www.mercadopago.com.ar/developers/es/docs/checkout-api-orders/payment-management/status/order-status
[mp-transactions]: https://www.mercadopago.com.ar/developers/es/docs/checkout-api-orders/payment-management/status/transaction-status
[mp-3ds]: https://www.mercadopago.com.ar/developers/es/docs/checkout-api-orders/payment-management/integrate-3ds
[mp-notifications]: https://www.mercadopago.com.ar/developers/es/docs/checkout-api-orders/notifications
[mp-optional]: https://www.mercadopago.com.ar/developers/es/docs/checkout-api-orders/optional-notifications
[mp-migration]: https://www.mercadopago.com.ar/developers/es/docs/checkout-api-orders/resources/migrate-payments-to-orders
[mp-react-npm]: https://registry.npmjs.org/@mercadopago/sdk-react/1.0.7
[mp-js]: https://github.com/mercadopago/sdk-js/blob/main/docs/bricks/card-payment.md
