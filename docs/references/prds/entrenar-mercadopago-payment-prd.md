# PRD — Mercado Pago Payment Integration (EntrenAR)

**Status:** Refined — Owner decisions resolved (§7), ready for design/ExecPlan  
**Refined:** 2026-10-21  
**Scope:** Embedded Mercado Pago payment in the existing checkout, server-side payment processing, verified notifications, and order/payment/stock reconciliation.  
**Boundary:** Exploration and refinement only. No ExecPlan, design, or implementation has started.

## 1. Objective

Let customers pay inside EntrenAR's existing `/checkout` with Mercado Pago, without leaving the site for card payments, while the backend remains the only authority for amounts, payment status, order confirmation, and stock.

## 2. Integration Verdict

**The original preference — Payment Brick + Orders API — is not an officially documented pairing.** It needs adjustment:

| Combination | Official status | Methods |
|---|---|---|
| **Card Payment Brick + Orders API** | Documented and recommended for cards in *Checkout API (vía Orders API)* | Credit, debit, prepaid cards |
| Orders API + custom UI (no Brick) | Documented | Rapipago, Pago Fácil |
| Payment Brick (multi-method) + Payments API | Documented, but Payments API is labelled **legacy** | Cards, Rapipago/Pago Fácil, MP account money, Cuotas sin Tarjeta |
| Checkout Pro (vía Orders API) | Documented, redirect to Mercado Pago | MP account money, Cuotas sin Tarjeta, everything else |

**Recommendation:** **Card Payment Brick + Orders API** (`processing_mode: automatic`) for the first delivery, cards only. It is the current, non-legacy, officially recommended path, keeps the buyer on-site, and handles Argentine installment disclosure (TEA/CFT) inside the Brick. Cash tickets and Mercado Pago wallet/credit are deferred to later increments (§7, D-1). Bank transfer keeps its current flow unchanged.

Rejected alternative: Payment Brick + `/v1/payments` gives every method in one widget, but builds new work on a legacy API and on wallet flows that redirect anyway.

## 3. Functional Requirements

- **FR-01 — Embedded card payment:** When the customer selects Mercado Pago in the existing payment step, the checkout renders Card Payment Brick within EntrenAR's layout, responsive and accessible. There is exactly one clear primary action to pay; the existing sidebar "Finalizar Compra" action must not compete with the Brick's submit.
- **FR-02 — Payment methods:** First delivery supports credit, debit, and prepaid cards available for Argentina through Card Payment Brick, with installments as offered by Mercado Pago. Other methods follow §7, D-1. The Mercado Pago method stays selectable only when it is active in commerce configuration **and** the integration is configured.
- **FR-03 — Server-authoritative amount:** The amount charged equals the backend-calculated total of the internal order (products, variants, quantities, prices, discounts, shipping). The Brick is initialized from that server amount; any client-sent amount is ignored. Currency is ARS.
- **FR-04 — Order association:** Every Mercado Pago order is linked to exactly one internal order via a stable external reference, and the provider identifiers (order and transaction) are recorded on the internal order for support and reconciliation. Original order snapshots remain immutable.
- **FR-05 — Payment lifecycle:** The system represents at least: awaiting payment, approved, in review/processing, action required (3DS challenge), rejected, cancelled/expired, refunded (total and partial), and charged back. Only a **verified approved** state confirms the internal order. A rejected attempt does not cancel the internal order immediately; the customer may retry with a new attempt on the same order within the retry window (§7, D-2).
- **FR-06 — 3DS:** When Mercado Pago requires a 3DS challenge, the customer completes it inside the checkout, and the final status is taken from Mercado Pago, not from the browser.
- **FR-07 — Verified notifications:** The backend accepts Mercado Pago webhooks only when the `x-signature` HMAC is valid and the timestamp is within tolerance, then fetches the authoritative order state from Mercado Pago before changing anything. Signature failures are rejected without side effects.
- **FR-08 — Idempotency and ordering:** Payment creation uses a stable idempotency key per attempt. Duplicate, delayed, concurrent, or out-of-order notifications, browser returns, and retries produce at most one charge and one set of side effects (confirmation, history entry, stock movement). A stale event never moves an order backward from a terminal state.
- **FR-09 — Reconciliation fallback:** Pending payments are also verified when the customer returns or reloads the result screen, and periodically for stale pending orders, so a lost webhook does not leave an order stuck.
- **FR-10 — Stock consistency:** For Mercado Pago, the internal order is created and stock is deducted only when the customer submits a payment, so abandoning checkout before paying holds no stock. Stock stays reserved while a payment can still succeed and is restored exactly once, through the existing inventory ledger, when the order is cancelled or expires unpaid (§7, D-2). Whoever submits payment first gets the last unit; later buyers see it as unavailable before paying.
- **FR-11 — Customer feedback:** The checkout shows processing, approved, pending/in review, rejected (with retry), and expired states. Cart and checkout draft are kept until the payment is approved or accepted as pending; a rejection never wipes them. No screen claims success before the backend confirms it.
- **FR-12 — Admin consistency:** Admins see the provider status and identifiers of a Mercado Pago sale. Manual "Marcar como recibido" must not override gateway truth for Mercado Pago orders (§7, D-3). Refunds and chargebacks made in Mercado Pago are reflected on the internal order.
- **FR-13 — Fraud and dispute signals:** Fraud alerts and chargebacks received from Mercado Pago are recorded on the order and surfaced to the admin so fulfillment can be stopped. Fraud alerts are not retried by Mercado Pago, so their receipt must be acknowledged reliably.

## 4. Non-Functional Requirements

- **Security:** Card data is captured and tokenized only by Mercado Pago (Brick secure fields); raw PAN/CVV never reach EntrenAR. The access token and webhook secret exist only in backend environment configuration; only the public key reaches the browser. Credentials are never stored in the database or admin UI.
- **Consistency:** Payment, order, and inventory transitions happen in backend transactions, reuse the existing ledger and idempotency patterns, and are safe under concurrent webhook and customer activity.
- **Environments:** Test and production credentials, webhook URLs, and secrets are separated. Test payments use Mercado Pago test credentials and test cards only.
- **Quality:** Requests include the payer and item data Mercado Pago evaluates for approval and integration quality (payer email/name/DNI, item details, external reference, statement descriptor).
- **Observability:** Every payment attempt and notification is traceable by internal order number and provider id without logging secrets or card data.
- **Repository fit:** Follow existing module, contract (Zod), adapter (`src/lib/api`), and testing conventions; Prisma remains backend-only.

## 5. Acceptance Criteria

1. A sandbox customer completes checkout with a test card (`APRO`) and the internal order becomes confirmed only after verified approval.
2. The amount sent to Mercado Pago equals the internal order total; a tampered client amount has no effect.
3. Rejected (`OTHE`/`FUND`), pending (`CONT`), and 3DS-challenged payments end in accurate internal states, and the customer can retry a rejected payment without losing cart or checkout data.
4. Replayed submissions and duplicate/delayed/out-of-order webhooks create no duplicate charges, confirmations, history entries, or stock movements.
5. Abandoning checkout before paying reserves no stock; an order whose last attempt was rejected and not retried within 10 minutes is cancelled and its stock is restored exactly once; an order in 3DS or review is not released before Mercado Pago's final state.
6. A webhook with an invalid signature or stale timestamp is rejected with no side effects.
7. A refund or chargeback performed in Mercado Pago is reflected on the internal order.
8. The payment step is usable on mobile, and errors are understandable and recoverable.
9. Automated tests cover amount authority, status mapping, signature verification, idempotency, and stock compensation; configuration and webhook setup are documented.

## 6. Exploration Summary (evidence)

**Confirmed — repository**

- No Mercado Pago integration exists. `mercado-pago` is a seeded, `INACTIVE` `PaymentMethodConfig` holding only settlement-term options (`backend/src/modules/commerce/commerce.constants.ts`, `backend/prisma/seed.ts`); no credentials in DB or env examples.
- `POST /checkout/complete` creates `Order` + `OrderPayment` as `PENDING`, **deducts stock immediately** (`CHECKOUT_DEDUCTION`), and the frontend then **clears cart and draft** (`backend/src/modules/checkout/checkout-completion.service.ts`, `src/stores/cart-checkout.actions.ts`).
- Payment confirmation is manual only (`POST /admin/sales/:id/confirm`, `backend/src/modules/sales/sales.service.ts`); no scheduled jobs exist, so unpaid orders hold stock forever.
- `PaymentStatus` is `PENDING | PAID | REFUNDED`; `OrderPayment` is 1:1 with `Order`, has no provider identifiers, and its method snapshot is DB-trigger immutable (`backend/prisma/schema.prisma`, migration `20260831000000_checkout_core`).
- Reusable foundations: checkout idempotency keys with request hashing (`CheckoutIdempotencyKey`), append-only inventory ledger with compensation (`restoreUncompensatedDeductions`), server-side money engine and quote continuity checks.
- Backend guards are global (JWT, roles, throttler); a webhook route must be explicitly public and exempt from throttling. Env config is Zod-validated in `backend/src/config/app.config.ts`.
- Frontend: single `/checkout` wizard, Mercado Pago renders only a radio today, primary CTA lives in `CheckoutSummary`; no result routes; `checkoutCompleteRequestSchema` is strict; no CSP is configured (`next.config.ts`); no Playwright checkout E2E.
- Customer account hides payment state and maps `CONFIRMED` to "entregado" (`backend/src/modules/account/account.mapper.ts`) — a pre-existing inaccuracy outside this scope.

**Confirmed — Mercado Pago docs**

- Orders API card guide recommends Card Payment Brick: <https://www.mercadopago.com.ar/developers/es/docs/checkout-api-orders/payment-integration/websites/cards>
- Payment Brick card submission targets `/v1/payments`: <https://www.mercadopago.com.ar/developers/es/docs/checkout-bricks/payment-brick/payment-submission/cards>
- Orders API web methods are Cards and Rapipago/Pago Fácil; wallet/credit go through Checkout Pro: <https://www.mercadopago.com.ar/developers/es/docs/checkout-api-orders/resources/migrate-payments-to-orders>
- `X-Idempotency-Key` is mandatory on Orders API writes; same key with a different body returns 409.
- Orders webhooks are configured only in the developer panel (no per-order `notification_url`); signature manifest `id:[data.id];request-id:[x-request-id];ts:[ts];` with lowercase `data.id`, HMAC-SHA256: <https://www.mercadopago.com.ar/developers/es/docs/checkout-api-orders/notifications>
- Order statuses include `processed`, `processing`, `action_required` (incl. `pending_challenge` for 3DS), `failed`, `canceled`, `expired`, `refunded`, `charged_back`: <https://www.mercadopago.com.ar/developers/es/docs/checkout-api-orders/payment-management/status/order-status>
- Official SDKs: `mercadopago` (Node, `Order` client) and `@mercadopago/sdk-react` (`<CardPayment />`).

**Assumptions / unverified**

- `x-signature` `ts` appears in seconds in older docs/SDK and in milliseconds in newer Orders examples; verification must tolerate both.
- Status Screen Brick is documented only with `/v1/payments` ids; a custom result screen is assumed.
- `@mercadopago/sdk-react` compatibility with React 19 + React Compiler is unverified; the plain JS SDK is the fallback.
- Webhook retry schedule and fraud-alert no-retry behavior are taken from official pages cited by research and should be re-checked during design.

## 7. Owner Decisions (resolved 2026-10-21)

| Id | Decision |
|---|---|
| **D-1** | **Cards only** in the first delivery. Rapipago/Pago Fácil later (multi-day pending and expiry). Wallet/Cuotas sin Tarjeta only via Checkout Pro if demanded later. |
| **D-2** | **Reservation at payment submission.** The order is created and stock deducted when the customer submits payment, not before. Approved → deduction is final. Rejected → stock is held **10 minutes** for a retry on the same order, then the order is cancelled and stock restored. 3DS challenge or anti-fraud review → stock is held until Mercado Pago reports a final state, following Mercado Pago's own limits (3DS: 40 minutes). |
| **D-3** | Manual "Marcar como recibido" is **disabled** for Mercado Pago orders; status comes only from verified provider state. |
| **D-4** | Refunds are made in the Mercado Pago panel and reflected in EntrenAR; refunding from the EntrenAR admin is a later increment. |
| **D-5** | A dedicated Mercado Pago application named **"entrenAR"** exists, with its own credentials, webhook URLs, and secret. |
| **D-6** | Webhooks use a tunnel for local sandbox testing and the deployed API URL in production. |

Remaining unknowns for design: Mercado Pago does not document a fixed duration for anti-fraud review; design must handle an indefinitely pending review safely (held stock, admin visibility).

## 8. Dependencies and Setup

- Environment (names to confirm during design): `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` (root `.env`), `MERCADOPAGO_ACCESS_TOKEN` and `MERCADOPAGO_WEBHOOK_SECRET` (`backend/.env` only).
- Webhook events to enable once the endpoint exists: **Order (Mercado Pago)**, **Contracargos**, **Alertas de fraude**; *Reclamos* optional; *Pagos (legacy)* not needed with Orders API.
- If a CSP is introduced later, it must allow Mercado Pago SDK, API, frame, and image domains.
