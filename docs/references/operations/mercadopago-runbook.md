# Mercado Pago Operations & Runbook (EntrenAR)

**Authoritative operational reference for configuring, testing, and running Mercado Pago Card Payments (Orders API).**<br>
**Date:** 2026-10-22<br>
**Context:** Chained delivery `feat/mp-1-backend-base` through `feat/mp-7-closure`.

---

## 1. Architecture & Credentials Model

The EntrenAR platform uses Mercado Pago **Checkout API via Orders API** (`processing_mode: automatic`) with the frontend **Card Payment Brick** (`@mercadopago/sdk-react@1.0.7`).

### Credentials & Account Structure

- **Backend environment variables** (`backend/.env`):
  - `MERCADOPAGO_ACCESS_TOKEN`: Private access token.
  - `MERCADOPAGO_WEBHOOK_SECRET`: HMAC secret for webhook signature verification (`x-signature`).
  - `MERCADOPAGO_ENVIRONMENT`: Either `test` or `production`.
- **Frontend environment variable** (`.env` or root environment):
  - `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`: Public key used solely by the frontend Card Payment Brick.

> ⚠️ **Security Invariant**: Never store credentials or webhook secrets in the database or expose them to the browser. Never write credential or secret values in documentation, logs, or commit messages.

### Test Credentials vs. Test Accounts (Crucial Finding)

- Test credentials provisioned for the EntrenAR application belong to an **auto-provisioned test account** in Mercado Pago.
- Live sandbox orders carry an `application_id` belonging to the auto-provisioned test user application (e.g. `7724188319599225`), **not** the parent EntrenAR application (e.g. `5700029867592088`).
- Consequently:
  - **Sandbox order notifications** are signed with the **webhook secret of the test account's own application**, not EntrenAR's main application secret.
  - **To obtain the sandbox webhook secret**: Log in to `mercadopago.com.ar/developers` using the test user credentials, open the application owned by that test account, navigate to **Webhooks → Modo productivo**, configure the webhook URL and subscribed events, and copy that application's secret into `backend/.env` as `MERCADOPAGO_WEBHOOK_SECRET`.
  - **EntrenAR's own application secret**: Validates notifications triggered manually from the EntrenAR developer panel webhook simulation tool, and is the secret to configure in production.

---

## 2. Sandbox Testing Guide

### Outcome Determinism via Payer Name

Mercado Pago sandbox drives test payment outcomes primarily based on the payer's first name sent in the order payload (mapped from the checkout "Nombres" field):

| Payer Name | Outcome | HTTP Status / Attempt Result | Notes |
|---|---|---|---|
| `APRO` | Approved | `201 Created` / `APPROVED` | Order transitions to `CONFIRMED`, payment to `PAID`. |
| `OTHE` | Rejected | `402 Payment Required` / `REJECTED` | Attempt rejected with `rejected_by_issuer`. 10-minute retry window opens. |
| `FUND` | Insufficient funds | `402 Payment Required` / `REJECTED` | Attempt rejected (`insufficient_amount`). 10-minute retry window opens. |
| `CONT` | In process | `202 Accepted` / `PROCESSING` | Pending anti-fraud review; accepted-pending presentation. |
| `CALL` | Call for authorize | `402 Payment Required` / `REJECTED` | Rejection requiring phone authorization. |

### Test Cards

Use standard Mercado Pago test card numbers documented at [Mercado Pago Developers — Test Cards](https://www.mercadopago.com.ar/developers/es/docs/checkout-api-orders/testing/test-cards). Use future expiry dates and any 3-digit CVV.

---

## 3. Local Development & Docker Configuration

- **Docker Compose default**: `docker-compose.yml` runs the backend container with `NODE_ENV=production` by default.
- **Environment override**: For local testing with test credentials, explicitly set `MERCADOPAGO_ENVIRONMENT=test` in `backend/.env` or Docker environment.
- **Container restarts**:
  - Environment changes in `backend/.env` require restarting with container recreation:
    ```bash
    docker compose up -d --force-recreate backend
    ```
  - Code changes require rebuilding the image:
    ```bash
    docker compose up -d --build backend
    ```

---

## 4. Local Webhook Tunneling (Cloudflare Tunnel)

To receive live webhook notifications from Mercado Pago during local development:

1. **Launch Cloudflare Tunnel**:
   ```bash
   cloudflared tunnel run --url http://localhost:3001 entrenar-dev-local
   ```
2. **Webhook URL**:
   `https://api-dev.entrenar.shop/api/v1/payments/mercadopago/webhooks`
3. **Subscribed Events in Developer Panel**:
   - `Order (Mercado Pago)` / `orders`
   - `Contracargos` / `chargebacks`
   - `Alertas de fraude` / `fraud_alerts`

> Note: Webhook requests must arrive with valid headers (`x-signature`, `x-request-id`). The endpoint is public, exempt from throttler rate-limiting (`@SkipThrottle()`), and enforces a 16 KB body limit.

---

## 5. Production Go-Live Checklist

Before activating Mercado Pago in production:

1. [ ] **Credentials**: Configure live production `MERCADOPAGO_ACCESS_TOKEN` and `MERCADOPAGO_WEBHOOK_SECRET` from the production EntrenAR application into production backend environment.
2. [ ] **Public Key**: Configure live production `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` in storefront environment.
3. [ ] **Environment Setting**: Set `MERCADOPAGO_ENVIRONMENT=production` in the backend environment.
4. [ ] **Webhook Endpoint**: Register the production public HTTPS URL (`https://api.entrenar.shop/api/v1/payments/mercadopago/webhooks`) in the Mercado Pago developer panel and verify subscription to Orders, Chargebacks, and Fraud Alerts.
5. [ ] **Verification**: Run an authorized low-value transaction using a real card in production to confirm end-to-end receipt, signature verification, stock deduction, and email/order confirmation.
6. [ ] **Activate Commerce Method**: In the Admin CRM panel under **Configuración → Métodos de Pago**, activate the `mercado-pago` method.
7. [ ] **Update Payment Method Copy**: The default seeded method copy may advertise cash/ticket or wallet payment options; update the method description in the CRM to accurately describe that card payments (credit, debit, prepaid) are supported.
8. [ ] **Provider Idempotency Retries**: Keep `PAYMENT_CREATE_MAX_CALLS = 1` until Mercado Pago provider retention guarantees under rapid retry are confirmed in production observability.

---

## 6. Operational Incident Handling & Administration

### Admin Payment Status & Flags

The admin sales panel (`/admin/ventas`) displays real-time payment provider details derived from `OrderPayment` and `PaymentAttempt`:

- **Payment Badges**:
  - `PAID`: Payment verified by provider.
  - `PENDING`: Awaiting confirmation, in retry window, or under review.
  - `PARTIALLY_REFUNDED`: Partial refund processed in MP panel; sale remains fulfillable.
  - `REFUNDED`: Full refund processed in MP panel; fulfillment is blocked.
  - `CHARGED_BACK`: Chargeback reported; fulfillment is blocked.
- **Attention Flags** (`paymentAttention: true`):
  - Raised when an attempt is in `UNKNOWN` status for >30 minutes, or when fulfillment holds exist (`unverified_provider_state`, `dispute`, `fraud_alert`, `full_refund`).

### Quarantined Risk Alerts Feed

- Endpoint: `GET /api/v1/admin/sales/payment-risk-alerts`
- Displays unassociated fraud alerts or chargeback notifications that were durably stored in `PaymentNotification` with reason `unverified_fraud_association`.
- Operators must inspect these alerts, cross-reference the transaction IDs in the Mercado Pago panel, and take operational fulfillment precautions.

### Resolving UNKNOWN Payment Incidents

When a card submission experiences a network disconnect or provider timeout:
1. The attempt transitions to `UNKNOWN`. Stock is **retained**; new customer attempts on that order are blocked.
2. Background reconciliation queries the provider periodically (`PaymentReconciliationService`).
3. If still unresolved after 30 minutes, `attentionRequiredAt` is flagged on the order.
4. **Resolution Procedure**:
   - The operator logs into the Mercado Pago merchant panel and searches for the order number or external reference.
   - If confirmed that no charge occurred and none can succeed, the admin opens the sale in `/admin/ventas/[id]`.
   - The admin clicks **Resolver Pago Desconocido** (`POST /api/v1/admin/sales/:id/payment/resolve-unknown`).
   - The backend performs one final live check against the Orders API. If still absent or non-payable, the attempt is marked `CANCELLED`, the sale is `CANCELLED`, and reserved stock is compensated exactly once through the inventory ledger.

---

## 7. Background Workers & Schedules

`PaymentWorkersService` registers scheduled tasks when `PAYMENT_WORKERS_ENABLED=true` (disabled in test environments):

| Worker | Schedule / Cadence | Responsibility |
|---|---|---|
| **Inbox Worker** | Every 5 seconds | Processes pending notifications in `PaymentNotification` inbox using authoritative `GET /v1/orders/{id}`. |
| **Expiry Worker** | Every 15 seconds | Sweeps orders whose 10-minute retry window expired without a successful retry; cancels order and compensates stock. |
| **Pending Reconcile** | Every 15 seconds (tick) | Queries due pending/processing attempts (cadence: 30s → 2m → 5m, then 15m for >24h reviews). |
| **Financial Fallback** | Every 60 seconds (tick) | Checks settled orders (PAID / PARTIALLY_REFUNDED) once every 24 hours to catch external panel refunds/chargebacks. |
| **Attention Sweep** | Every 60 seconds | Flags UNKNOWN attempts older than 30 minutes with `attentionRequiredAt`. |
