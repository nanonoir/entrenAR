import assert from "node:assert/strict";

import { payCheckoutWithCard, fetchActivePayment } from "@/lib/api/checkout/checkout-card-payment";
import { CheckoutApiError, type CheckoutApiClient, type CheckoutApiMethodOptions } from "@/lib/api/checkout/client";
import { readDeviceId, toPaymentCardPayload } from "@/lib/api/payments/card-payload";
import { isAllowedChallengeOrigin, isTrustedChallengeMessage, sanitizeChallengeUrl } from "@/lib/api/payments/challenge-url";
import { getResultLoadErrorMessage, isStaleQuotePaymentError, isUncertainPaymentError } from "@/lib/api/payments/payment-errors";
import {
  BOUND_ORDER_MODE,
  cardBrickKey,
  nextPollDelayMs,
  PAYMENT_RESULT_KIND,
  resolveBoundOrderMode,
  resolvePaymentResult,
  retryBrickScope,
  retrySecondsRemaining,
  shouldClearSubmittedCart,
} from "@/lib/api/payments/payment-result";
import { fetchPaymentStatus, retryPayment } from "@/lib/api/payments/payments.api";
import { mapActivePaymentResponse, mapPaymentView, type PaymentView } from "@/lib/api/payments/payments.mappers";
import { resolveSubmissionKey } from "@/lib/api/payments/submission-key";
import { captureCartGeneration, removeSubmittedGeneration } from "@/lib/cart-generation";
import { resolveOrderSessionToken, sanitizeBinding } from "@/lib/checkout-payment-binding";
import { useCartStore } from "@/stores/cart-store";
import { useCheckoutPaymentStore } from "@/stores/checkout-payment-store";

const CHALLENGE_URL = "https://www.mercadopago.com.ar/3ds/challenge?id=1";

function viewDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    acceptedPending: false,
    amount: 15000,
    attempt: { id: "att-1", number: 1, status: "submitting" },
    cartFinalized: false,
    challenge: null,
    currency: "ARS",
    nextPollSeconds: null,
    ok: true,
    orderId: "ord-1",
    orderNumber: "EA-1",
    orderStatus: "pending",
    paymentStatus: "pending",
    reasonCode: null,
    reconciling: false,
    refundedAmount: 0,
    retry: { eligible: false, until: null },
    status: "pending",
    version: 1,
    ...overrides,
  };
}

const view = (overrides: Record<string, unknown> = {}): PaymentView => mapPaymentView(viewDto(overrides));

interface Call { body?: unknown; options?: CheckoutApiMethodOptions; path: string; verb: "get" | "post" }

function fakeClient(responses: unknown[]): { calls: Call[]; client: CheckoutApiClient } {
  const calls: Call[] = [];
  const next = async <T>(): Promise<T> => {
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return response as T;
  };
  const client = {
    delete: () => { throw new Error("unexpected delete"); },
    get: (path: string, options?: CheckoutApiMethodOptions) => { calls.push({ options, path, verb: "get" }); return next(); },
    post: (path: string, body?: unknown, options?: CheckoutApiMethodOptions) => { calls.push({ body, options, path, verb: "post" }); return next(); },
    put: () => { throw new Error("unexpected put"); },
    request: () => { throw new Error("unexpected request"); },
  } as unknown as CheckoutApiClient;
  return { calls, client };
}

function cardForm(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    installments: 3,
    issuer_id: "310",
    payer: { email: "Buyer@Example.com", identification: { number: "12345678", type: "DNI" } },
    payment_method_id: "visa",
    token: "tok_12345678",
    transaction_amount: 1,
    ...extra,
  };
}

function testCardPayload(): void {
  const card = toPaymentCardPayload(cardForm());
  assert.deepEqual(Object.keys(card).sort(), ["installments", "payerEmail", "payerIdentification", "paymentMethodId", "token"]);
  assert.equal(card.payerEmail, "buyer@example.com");
  assert.equal(JSON.stringify(card).includes("transaction_amount"), false, "transaction_amount must be discarded");
  assert.equal(toPaymentCardPayload(cardForm({ installments: "6" })).installments, 6);
  assert.equal(toPaymentCardPayload(cardForm({ payer: { identification: { number: "12345678", type: "DNI" } } }), "x@y.com").payerEmail, "x@y.com");
  assert.throws(() => toPaymentCardPayload(cardForm({ token: "bad token!" })), (error) => error instanceof CheckoutApiError && error.code === "VALIDATION_ERROR");
  assert.throws(() => toPaymentCardPayload({}), CheckoutApiError);
  assert.equal(readDeviceId({ MP_DEVICE_SESSION_ID: "dev-123" }), "dev-123");
  assert.equal(readDeviceId({ MP_DEVICE_SESSION_ID: "<script>" }), undefined);
  assert.equal(readDeviceId({}), undefined);
}

async function testAdapters(): Promise<void> {
  const pay = fakeClient([viewDto({ challenge: null })]);
  const placed = await payCheckoutWithCard({
    card: toPaymentCardPayload(cardForm()),
    customer: { email: "buyer@example.com", firstName: "Ana", lastName: "Paz" },
    idempotencyKey: "card-key-12345",
    items: [{ productId: "p1", quantity: 1 }],
    quoteId: "quote-token-0123456789",
  }, pay.client);
  assert.equal(placed.orderId, "ord-1");
  assert.equal(pay.calls[0]?.path, "/checkout/payments/mercadopago");
  const body = pay.calls[0]?.body as Record<string, unknown>;
  assert.equal(body.quoteId, "quote-token-0123456789");
  assert.equal("transaction_amount" in body, false);
  assert.equal("amount" in body, false);

  const active = fakeClient([{ active: viewDto(), ok: true }, { active: null, ok: true }]);
  assert.equal((await fetchActivePayment({ sessionToken: "guest-token-0123456789" }, active.client))?.orderId, "ord-1");
  assert.deepEqual(active.calls[0]?.options?.headers, { "x-checkout-session": "guest-token-0123456789" });
  assert.equal(await fetchActivePayment({}, active.client), null);
  assert.equal(active.calls[1]?.options?.headers, undefined);

  const status = fakeClient([viewDto()]);
  await fetchPaymentStatus("ord/1", { sessionToken: "guest-token-0123456789" }, status.client);
  assert.equal(status.calls[0]?.path, "/payments/orders/ord%2F1");

  const retry = fakeClient([viewDto()]);
  await retryPayment("ord-1", { card: toPaymentCardPayload(cardForm()), idempotencyKey: "retry-key-12345" }, retry.client);
  assert.equal(retry.calls[0]?.path, "/payments/orders/ord-1/attempts");
  await assert.rejects(
    retryPayment("ord-1", { card: toPaymentCardPayload(cardForm()), idempotencyKey: "x" }, fakeClient([]).client),
    (error) => error instanceof CheckoutApiError && error.code === "VALIDATION_ERROR",
  );

  const failing = fakeClient([new CheckoutApiError({ code: "PAYMENT_ATTEMPT_ACTIVE", message: "active", status: 409 })]);
  await assert.rejects(fetchPaymentStatus("ord-1", {}, failing.client), (error) => error instanceof CheckoutApiError && error.code === "PAYMENT_ATTEMPT_ACTIVE");

  assert.throws(() => mapPaymentView({ ok: true }), (error) => error instanceof CheckoutApiError && error.code === "CHECKOUT_API_INVALID_RESPONSE");
  assert.throws(() => mapPaymentView(viewDto({ extra: 1 })), CheckoutApiError, "strict schema rejects unknown fields");
  assert.equal(mapActivePaymentResponse({ active: null, ok: true }), null);
}

function testErrorMapping(): void {
  assert.equal(isUncertainPaymentError({ code: "CHECKOUT_API_UNAVAILABLE", status: 503 }), true);
  assert.equal(isUncertainPaymentError({ code: "CHECKOUT_API_INVALID_RESPONSE", status: 502 }), true);
  assert.equal(isUncertainPaymentError({ code: "OUT_OF_STOCK", status: 409 }), false);
  assert.equal(isStaleQuotePaymentError({ code: "PRICE_CHANGED" }), true);
  assert.equal(isStaleQuotePaymentError({ code: "PAYMENT_METHOD_UNAVAILABLE" }), false);
}

function testChallenge(): void {
  assert.equal(sanitizeChallengeUrl(CHALLENGE_URL), CHALLENGE_URL);
  for (const bad of ["http://www.mercadopago.com/x", "https://evil.com/x", "https://mercadopago.com.evil.com/x", "https://user:pw@www.mercadopago.com/x", "https://www.mercadopago.com:8443/x", "javascript:alert(1)", "not a url", "", null]) {
    assert.equal(sanitizeChallengeUrl(bad), null, `must reject ${String(bad)}`);
  }
  assert.equal(view({ challenge: { createdAt: "2026-01-01T00:00:00.000Z", expectedExpiresAt: "2026-01-01T00:10:00.000Z", pollAfterSeconds: 3, url: "https://evil.com/x" } }).challenge, null);

  const frame = {};
  assert.equal(isAllowedChallengeOrigin("https://www.mercadopago.com.ar"), true);
  assert.equal(isAllowedChallengeOrigin("http://www.mercadopago.com.ar"), false);
  assert.equal(isTrustedChallengeMessage({ origin: "https://www.mercadopago.com.ar", source: frame }, frame), true);
  assert.equal(isTrustedChallengeMessage({ origin: "https://evil.com", source: frame }, frame), false);
  assert.equal(isTrustedChallengeMessage({ origin: "https://www.mercadopago.com.ar", source: {} }, frame), false);
  assert.equal(isTrustedChallengeMessage({ origin: "https://www.mercadopago.com.ar", source: frame }, null), false);
}

function testResultMapping(): void {
  const challenge = { createdAt: "2026-01-01T00:00:00.000Z", expectedExpiresAt: "2026-01-01T00:10:00.000Z", pollAfterSeconds: 3, url: CHALLENGE_URL };
  const kind = (overrides: Record<string, unknown>) => resolvePaymentResult(view(overrides));

  assert.equal(kind({ paymentStatus: "paid", status: "paid" }), PAYMENT_RESULT_KIND.APPROVED);
  assert.equal(kind({ paymentStatus: "partially_refunded" }), PAYMENT_RESULT_KIND.APPROVED);
  assert.equal(kind({ paymentStatus: "refunded" }), PAYMENT_RESULT_KIND.ATTENTION);
  assert.equal(kind({ attempt: { id: "a", number: 1, status: "action_required" }, challenge }), PAYMENT_RESULT_KIND.ACTION_REQUIRED);
  assert.equal(kind({ attempt: { id: "a", number: 1, status: "action_required" } }), PAYMENT_RESULT_KIND.VERIFYING);
  assert.equal(kind({ attempt: { id: "a", number: 1, status: "processing" } }), PAYMENT_RESULT_KIND.PROCESSING);
  assert.equal(kind({ attempt: { id: "a", number: 1, status: "rejected" } }), PAYMENT_RESULT_KIND.REJECTED);
  assert.equal(kind({ status: "expired" }), PAYMENT_RESULT_KIND.ENDED);
  assert.equal(kind({ orderStatus: "cancelled" }), PAYMENT_RESULT_KIND.ENDED);
  assert.equal(kind({ attempt: { id: "a", number: 1, status: "unknown" } }), PAYMENT_RESULT_KIND.VERIFYING);
  assert.equal(kind({ attempt: null }), PAYMENT_RESULT_KIND.VERIFYING);
  assert.equal(kind({ attempt: { id: "a", number: 1, status: "approved" }, paymentStatus: "pending" }), PAYMENT_RESULT_KIND.VERIFYING, "an attempt status alone never means success");

  assert.equal(shouldClearSubmittedCart(view({ paymentStatus: "paid" })), true);
  assert.equal(shouldClearSubmittedCart(view({ acceptedPending: true, attempt: { id: "a", number: 1, status: "processing" } })), true);
  assert.equal(shouldClearSubmittedCart(view({ attempt: { id: "a", number: 1, status: "processing" } })), false);
  assert.equal(shouldClearSubmittedCart(view({ attempt: { id: "a", number: 1, status: "rejected" } })), false);
  assert.equal(shouldClearSubmittedCart(view({})), false);

  assert.equal(nextPollDelayMs(view({}), 0), 3_000);
  assert.equal(nextPollDelayMs(view({}), 61_000), 10_000);
  assert.equal(nextPollDelayMs(view({ nextPollSeconds: 5 }), 90_000), 5_000);
  assert.equal(nextPollDelayMs(view({ paymentStatus: "paid" }), 0), null);

  assert.equal(resolveBoundOrderMode(view({ attempt: { id: "a", number: 1, status: "action_required" }, challenge })), BOUND_ORDER_MODE.CHALLENGE);
  assert.equal(resolveBoundOrderMode(view({ attempt: { id: "a", number: 1, status: "rejected" }, retry: { eligible: true, until: "2026-01-01T00:10:00.000Z" } })), BOUND_ORDER_MODE.RETRY);
  assert.equal(resolveBoundOrderMode(view({ attempt: { id: "a", number: 1, status: "rejected" } })), BOUND_ORDER_MODE.RESULT);

  const until = "2026-01-01T00:01:00.000Z";
  assert.equal(retrySecondsRemaining(until, Date.parse("2026-01-01T00:00:30.000Z")), 30);
  assert.equal(retrySecondsRemaining(until, Date.parse("2026-01-01T00:02:00.000Z")), 0);
  assert.equal(retrySecondsRemaining(null, 0), 0);

  const rejected = { attempt: { id: "a1", number: 1, status: "rejected" }, retry: { eligible: true, until } };
  assert.equal(
    cardBrickKey(retryBrickScope(view({ ...rejected, version: 3 })), 650.99),
    cardBrickKey(retryBrickScope(view({ ...rejected, version: 9, nextPollSeconds: 5 })), 650.99),
    "polling a rejected order keeps the Brick key",
  );
  assert.notEqual(retryBrickScope(view(rejected)), retryBrickScope(view({ ...rejected, attempt: { id: "a2", number: 2, status: "rejected" } })));
  assert.notEqual(cardBrickKey("quote", 100), cardBrickKey("quote", 101));
}

function testCartGeneration(): void {
  const generation = captureCartGeneration([
    { productId: "p1", quantity: 1, variantId: "v1" },
    { productId: "p1", quantity: 1, variantId: "v1" },
    { productId: "p2", quantity: 3 },
  ]);
  assert.equal(generation.length, 2);

  const cart = [
    { productId: "p1", quantity: 5, variantId: "v1" },
    { productId: "p2", quantity: 3, variantId: "" },
    { productId: "p3", quantity: 1, variantId: "v9" },
  ];
  const after = removeSubmittedGeneration(cart, generation);
  assert.deepEqual(after, [{ productId: "p1", quantity: 3, variantId: "v1" }, { productId: "p3", quantity: 1, variantId: "v9" }]);
  assert.equal(cart[0]?.quantity, 5, "the input cart is not mutated");
  assert.deepEqual(removeSubmittedGeneration(cart, []), cart);

  const binding = sanitizeBinding({
    card: { token: "secret" },
    createdAt: 1,
    finalized: false,
    generation: [{ productId: "p1", quantity: 1, variantId: "" }],
    orderId: null,
    sessionToken: "t",
    token: "secret",
  });
  assert.ok(binding);
  assert.equal(JSON.stringify(binding).includes("secret"), false, "unknown keys are dropped");
  assert.equal(sanitizeBinding({ createdAt: "1" }), null);
  assert.equal(sanitizeBinding(null), null);
}

async function testResultSessionToken(): Promise<void> {
  const binding = { createdAt: Date.now(), finalized: false, generation: [], orderId: "ord-1", sessionToken: "guest-token-0123456789" };

  assert.equal(resolveOrderSessionToken("ord-1", binding, null), "guest-token-0123456789", "binding token is used when the cart session was cleared");
  assert.equal(resolveOrderSessionToken("ord-1", binding, "cart-token"), "guest-token-0123456789", "binding wins over the cart session");
  assert.equal(resolveOrderSessionToken("ord-2", binding, "cart-token"), "cart-token", "a binding for another order is ignored");

  // Verified approval cleans the cart session but must keep the credential in the binding.
  useCartStore.setState({ checkoutSessionToken: "guest-token-0123456789" });
  useCheckoutPaymentStore.setState({ binding: { ...binding, sessionToken: null } });
  useCheckoutPaymentStore.getState().acceptView(view({ orderId: "ord-1", paymentStatus: "paid", status: "paid" }));
  const after = useCheckoutPaymentStore.getState();
  assert.equal(useCartStore.getState().checkoutSessionToken, null, "cart cleanup cleared the cart session");
  assert.equal(after.binding?.finalized, true);
  assert.equal(after.binding?.sessionToken, "guest-token-0123456789", "binding token survives cleanup");
  assert.equal(
    resolveOrderSessionToken("ord-1", after.binding, useCartStore.getState().checkoutSessionToken),
    "guest-token-0123456789",
    "result page sends the credential after cleanup",
  );

  // The status request carries the credential and a later success replaces the shown error.
  const status = fakeClient([viewDto({ paymentStatus: "paid", status: "paid" })]);
  await fetchPaymentStatus("ord-1", { sessionToken: after.binding?.sessionToken ?? null }, status.client);
  assert.deepEqual(status.calls[0]?.options?.headers, { "x-checkout-session": "guest-token-0123456789" }, "no credential-less request");
  useCheckoutPaymentStore.getState().acceptView(view({ orderId: "ord-1", paymentStatus: "paid", status: "paid" }));
  assert.equal(resolvePaymentResult(useCheckoutPaymentStore.getState().view!), PAYMENT_RESULT_KIND.APPROVED);

  const unauthorized = getResultLoadErrorMessage({ code: "CHECKOUT_SESSION_INVALID", status: 401 });
  assert.match(unauthorized, /No pudimos verificar tu pedido en esta pestaña/);
  assert.equal(unauthorized.includes("cotización"), false, "result copy never uses checkout quote wording");
  useCheckoutPaymentStore.getState().reset();
}

function testSubmissionKey(): void {
  let counter = 0;
  const create = () => `key-${++counter}`;
  const first = resolveSubmissionKey(null, "tok-a", create);
  assert.equal(resolveSubmissionKey(first, "tok-a", create).key, first.key, "a network retry reuses the key");
  assert.notEqual(resolveSubmissionKey(first, "tok-b", create).key, first.key, "a new card token is a new submission");
  assert.match(resolveSubmissionKey(null, "tok-c").key, /^card-[A-Za-z0-9-]+$/);
}

async function run(): Promise<void> {
  testCardPayload();
  await testAdapters();
  testErrorMapping();
  testChallenge();
  testResultMapping();
  testCartGeneration();
  testSubmissionKey();
  await testResultSessionToken();
  console.log("payments harness: card allowlist, adapters, error mapping, challenge guard, result mapping, polling, cart generation and submission key passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
