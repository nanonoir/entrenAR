# Mercado Pago Card Payments Specification

## Purpose and authority

Define embedded card payment, payment recovery and provider-authoritative financial behavior. [PRD and owner decisions](../../references/prds/entrenar-mercadopago-payment-prd.md) define scope; the [approved design](../../design-docs/2026-10-21-mercadopago-card-payments.md) owns exact provider mappings, contracts, verification mechanics and reconciliation schedules. [Checkout complete](../checkout-complete/spec.md) owns placement invariants, [admin sales lifecycle](../admin-sales-lifecycle/spec.md) owns admin commands, and [inventory sales transactions](../inventory-sales-transactions/spec.md) owns ledger compensation.

## Requirements

### Requirement: Configured Cards-Only Availability

Mercado Pago MUST be selectable only when commerce configuration is active, the backend integration is configured and the storefront has its public key. Support Argentine credit, debit and supported prepaid cards, with Mercado Pago's offered installments and disclosures. Bank transfer remains unchanged. Wallet, Cuotas sin Tarjeta, cash tickets, manual capture and refunds initiated in EntrenAR are outside scope. Disabling new submissions MUST NOT disable recovery, notifications or reconciliation for existing attempts. Historical manual records MUST NOT be reclassified as gateway-managed solely because their method label is Mercado Pago.

#### Scenario: Active but unconfigured method
- GIVEN commerce configuration marks Mercado Pago active but integration configuration is absent
- WHEN checkout requests eligible methods
- THEN card submission MUST remain unavailable without inventing a working gateway

### Requirement: Authoritative Placement at Submission

Viewing checkout or obtaining a quote MUST NOT create an order or reserve stock. First card submission MUST require a current authoritative quote, valid identification/delivery and owner/session authorization. It MUST create one pending internal order, immutable snapshots, payment association, first attempt and stock reservation together, redeeming any coupon once. Failed pre-placement validation MUST leave no order, attempt, redemption or deduction. Only a buyer with successfully reserved stock MAY be charged.

The amount MUST equal the frozen backend order total including discounts and shipping, in ARS. Browser amounts MUST NOT influence charging. Payer identification MUST describe the card payer, not automatically the delivery recipient. Every sequential attempt MUST remain associated with the same internal order and stable external reference; retries MUST NOT reprice, change delivery/items/method or consume another coupon redemption. Provider identifiers MUST be available for support without changing original snapshots.

#### Scenario: Competing buyers for the last unit
- GIVEN two shoppers submit for the final tracked unit
- WHEN stock reservation is committed
- THEN only the winning reservation MAY proceed to payment and the other shopper receives a controlled stock conflict before charging

#### Scenario: Tampered amount
- GIVEN a valid current quote and a forged browser payment amount
- WHEN the card payment is submitted
- THEN only the backend order amount MAY be charged; unsupported request fields MUST be rejected or discarded at the documented boundary

### Requirement: Provider-Verified Attempt Lifecycle

Attempts MUST distinguish `SUBMITTING`, `UNKNOWN`, `PROCESSING`, `ACTION_REQUIRED`, `APPROVED`, `REJECTED`, `CANCELLED`, `EXPIRED`, `PARTIALLY_REFUNDED`, `REFUNDED` and `CHARGED_BACK`. Order fulfillment state remains separate from financial state. Exact provider status/detail combinations follow the design's state machine.

| Verified observation | Expected behavior |
| --- | --- |
| Submission unresolved or provider-created only | Pending order/payment; stock held; no new attempt. |
| Processing/anti-fraud review | Pending order/payment, accepted-pending presentation; stock held. |
| Action required, including 3DS | Pending order/payment; stock held; no new attempt. Unexpected action variants require admin attention, not rejection. |
| Matching order and transaction accredited for the expected amount | `PAID` payment and `CONFIRMED` order; confirmation timestamp/history once. Approval does not mean delivered. |
| Definitive issuer/challenge rejection or documented pre-charge noncreation failure | Pending order/payment; same-order retry window. |
| Definitive cancellation/expiry with no potentially payable attempt | Cancel internal unpaid order and compensate stock once; no retry on that order. |
| Unknown status, inconsistent identity/amount/currency/transactions | Reconciliation/fulfillment hold; never approve or release stock by assumption. |

Browser callbacks, query parameters and challenge completion MUST NOT constitute approval. Stale observations MUST NOT regress settled financial state. Only the active attempt controls pending/retry presentation. A contradictory late approval of a closed attempt MUST record financial truth, flag an incident and block fulfillment; it MUST NOT automatically reopen a cancelled order, re-deduct stock or initiate another charge.

### Requirement: Rejected Retry Window and Safe Release

Each newly verified rejection MUST open a 10-minute window from its first verified rejection time. Duplicate reads/notifications MUST NOT extend it. A new attempt is eligible strictly before the deadline, only when the last attempt is verified rejected and no attempt remains potentially payable. A newly rejected retry gets its own window; no total retry cap is introduced. The customer MUST use fresh tokenized card data for a genuine new attempt.

At or after the deadline, retries MUST be rejected even before expiry processing runs. An unpaid order MAY be cancelled for retry expiry only after authoritative rechecks establish all attempts are nonpayable. Provider outage MUST postpone release, not imply nonpayment. In healthy operation stock release SHOULD occur within 30 seconds after the deadline. Cancellation and ledger compensation MUST either both succeed or neither succeed.

#### Scenario: Deadline boundary
- GIVEN a rejected attempt whose first rejection was verified at 12:00 UTC
- WHEN the customer submits at or after 12:10 UTC
- THEN the new attempt MUST be denied without charging, even if expiry processing has not yet cancelled the order

### Requirement: Challenge and Review Holds

3DS MUST be completable inside checkout through a provider-validated accessible challenge surface, with status refresh/help and reload recovery. Only the authorized challenge source MAY trigger refresh; a completion message never approves payment. At the expected 40-minute challenge boundary, verify provider state; the local clock MUST NOT release inventory. Anti-fraud review has no local expiry: retain stock, expose review age, flag admin attention after 1 hour and alert operations after 24 hours. These thresholds MUST NOT be described as guaranteed payment expiry.

### Requirement: Uncertain Submission Recovery

Uncertain creation outcomes MUST become `UNKNOWN`, not rejection. A submission unresolved for more than 1 minute MUST also recover as UNKNOWN. Stock MUST remain held and new attempts MUST be blocked. Recovery MUST use authoritative provider reads, or search by external reference when identifiers are missing, with verified unique association rather than guessed matches. No later worker, reload or replay MAY create a new charge to recover uncertainty.

An unresolved missing-identifier outcome MUST raise visible admin attention and an operational alert at 30 minutes from submission start; polling MUST NOT reset this clock. Continue reconciliation thereafter. Search absence alone MUST NEVER authorize automatic release. Explicit incident cancellation requires an authorized admin, a fresh provider recheck and panel investigation establishing that no charge can still succeed, with actor, reason and verification evidence recorded. Provider unavailability or unresolved payable risk MUST block cancellation.

#### Scenario: Lost submission response
- GIVEN the order and reservation exist but charge creation has an uncertain outcome
- WHEN the customer reloads or repeats submission
- THEN the existing order/status MUST be recovered without a second dispatch, retained stock MUST remain reserved, and the screen MUST NOT advise a new payment or claim success

### Requirement: Verified Notifications and Reconciliation

Notifications MUST pass signature and timestamp verification before persisted receipt or side effects. Invalid signatures or timestamps outside the design's five-minute tolerance MUST return 401 without effects. Valid notifications MUST be durably accepted before acknowledgment; acceptance failure MUST return 503, not success. Duplicate accepted notifications MUST be safe and acknowledged. Financial transitions MUST follow authoritative provider reads and verified order/account/environment/reference/amount/currency association, never arbitrary notification-body assertions.

Return/reload checks and periodic reconciliation MUST recover lost notifications for unsettled payments. Paid and partially refunded payments MUST also receive daily financial reconciliation without an arbitrary age cutoff, so missed refunds/disputes can be reflected. Duplicate, concurrent, delayed or out-of-order observations MUST cause at most one confirmation, transition history effect and stock compensation. Technical verification, schedules and association rules remain canonical in the design.

### Requirement: Refunds, Disputes and Fraud Visibility

Refunds MUST be initiated in Mercado Pago's panel and reflected only after verification. A verified completed partial refund MUST set `PARTIALLY_REFUNDED`, show the refunded amount and an admin warning, and leave fulfillment eligible unless another hold exists. A verified full refund MUST set `REFUNDED` and block further fulfillment. Refund amounts MUST NOT decrease through stale observations. Neither refund nor chargeback alone MUST restore stock or erase historical confirmation/delivery.

Chargebacks MUST show verified case/status details and a persistent fulfillment hold; a later ordinary accredited response MUST NOT clear that hold. An authoritatively associated fraud alert MUST be recorded even when the order remains paid, block packing/shipping/delivery and instruct admins to stop shipment and inspect/refund in Mercado Pago. Already shipped/delivered goods MUST retain their real shipping state with an incident warning. Fraud alerts MUST NOT be treated as completed refunds.

Authenticated risk alerts without a verified order association MUST remain visible as unresolved admin alerts and alert operations, without changing an arbitrarily selected order. **Pending provider contract:** automatic per-order fraud/chargeback association requires the verified signed-resource lookup/fixtures identified in the design; unsigned body IDs MUST NOT substitute for that evidence.

### Requirement: Idempotent Submission and Side Effects

Repeated identical submission intent/key MUST return the same order/attempt identities and current safe status, not another charge. The same key with different intent MUST return conflict. A new key MUST NOT create a second order for a checkout session already bound to an order. At most one potentially payable attempt and at most one successful attempt MAY exist per payment; no new attempt is allowed after success. Provider retries within the originating request MUST retain the same attempt identity and charge intent under the design's validated idempotency contract.

**Pending provider contract:** the design's optional second in-request creation call cannot be enabled without evidence of the provider retention guarantee; otherwise one call followed by UNKNOWN/read recovery is required. This does not permit background replay or persisted tokens.

### Requirement: Customer Result, Cart Finalization and Ownership

Checkout MUST show processing, approved, review/pending, action required, rejection with eligible retry, and cancelled/expired states from backend truth. Only the embedded card submit is the primary pay action; transfer retains its existing final action. Submission MUST be disabled while quotes refresh or submission is in flight. Bound potentially payable orders MUST prevent checkout/method edits; retained cart edits MUST NOT mutate their snapshots.

Preserve cart/draft during SUBMITTING, UNKNOWN, challenge and rejection. Clear only the submitted cart/draft generation, once, upon verified approval or accepted PROCESSING/review, never merely on HTTP 202. New independently added items MUST survive finalization. If accepted-pending later fails, retry MUST still use its frozen order, not reconstruct a cart.

The result surface MUST recover the bound order before an empty-cart branch, show backend-safe reasons/deadlines and offer same-order eligible retry, challenge resumption or a fresh checkout after final cancellation. Recovery MUST work on same-session reload even after cart clearing/session completion. Visible unresolved results MUST refresh, pause polling while hidden/offline and refresh on return; failures MUST remain recoverable without invented success.

Access MUST require the original valid guest session proof or authenticated order owner; an order number/provider ID/URL alone is insufficient. Expired guest proof MUST produce a safe unavailable/support state. Logout/account switch MUST invalidate recovery state. Unauthenticated cross-device recovery is not promised; result URLs MUST NOT carry authentication or payment tokens. New checkout intent requires a fresh session association, not reuse of the bound session.

### Requirement: Payment Data Security

Only Mercado Pago secure fields MAY capture/tokenize card data; raw PAN/CVV MUST NOT reach EntrenAR. No card token MAY ever be persisted, even encrypted, in database, logs, tracing, queues, history, browser storage or drafts. Tokens exist only for the originating request's lifetime. Credentials MUST exist only in environment configuration, never database or admin forms; only the public key MAY reach the browser. Test and production credentials/configuration MUST remain separate, and sandbox testing MUST use test cards only. Status/admin views and diagnostics MUST expose only safe payment data, never secrets or sensitive challenge URLs.

#### Scenario: Replay after a process crash
- GIVEN placement committed and the originating process lost its in-memory token
- WHEN recovery runs
- THEN it MUST reconcile by reads and hold unresolved stock, never load a persisted token or automatically recreate the charge
