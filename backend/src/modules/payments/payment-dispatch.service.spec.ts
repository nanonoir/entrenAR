import { Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";

import type { AppConfig } from "../../config/app.config";
import { PaymentAttemptStatus } from "../../generated/prisma/enums";
import {
  cardRejected402Body,
  failedOrder,
  pendingChallengeOrder,
  processedAccreditedOrder,
  processingOrder,
} from "./mercadopago/__fixtures__/orders.fixtures";
import {
  MERCADOPAGO_ERROR_CATEGORY,
  MercadoPagoOrdersError,
  type MercadoPagoErrorCategory,
  type MercadoPagoOrdersPort,
} from "./mercadopago/mercadopago-orders.port";
import { MercadoPagoHttpOrdersAdapter } from "./mercadopago/mercadopago-orders.http-adapter";
import { toMercadoPagoOrder } from "./mercadopago/mercadopago-orders.schemas";
import { normalizeProviderStatus } from "./payment-status.normalizer";
import { sanitizeChallengeUrl } from "./payment-card";
import { PaymentCircuitService } from "./payment-circuit.service";
import { PAYMENT_CREATE_MAX_CALLS, PaymentDispatchService } from "./payment-dispatch.service";
import type { PaymentReducerService } from "./payment-reducer.service";
import type { PaymentsRepository } from "./payments.repository";

const card = {
  installments: 1,
  payerEmail: "payer@example.test",
  payerIdentification: { number: "12345678", type: "DNI" },
  paymentMethodId: "master",
  token: "tok_123456789",
};

function harness(status: PaymentAttemptStatus = PaymentAttemptStatus.SUBMITTING) {
  const port = { createOrder: jest.fn(), getOrder: jest.fn(), searchOrders: jest.fn() } satisfies jest.Mocked<MercadoPagoOrdersPort>;
  const reducer = {
    applyObservation: jest.fn().mockResolvedValue({ decision: "apply" }),
    markUnknown: jest.fn().mockResolvedValue({ decision: "apply" }),
    cancelUncreated: jest.fn().mockResolvedValue({ decision: "apply" }),
    rejectWithoutCharge: jest.fn().mockResolvedValue({ decision: "apply" }),
  };
  const repository = {
    dispatchContext: jest.fn().mockResolvedValue({
      expectedAmount: { toString: () => "12345.67" },
      id: "attempt-1",
      payment: {
        order: {
          customerEmail: "customer@example.test",
          customerFirstName: "Ana",
          customerLastName: "Gomez",
          id: "order_internal_1",
          items: [{ productName: "Whey", quantity: 1, sku: "SKU-1", unitPrice: { toString: () => "12345.67" }, variantName: null }],
        },
      },
      providerIdempotencyKey: "provider-key-1",
      status,
    }),
  };
  const sleep = jest.fn().mockResolvedValue(undefined);
  const circuit = new PaymentCircuitService();
  const service = new PaymentDispatchService(
    port,
    reducer as unknown as PaymentReducerService,
    repository as unknown as PaymentsRepository,
    circuit,
    sleep,
  );

  return { circuit, port, reducer, repository, service, sleep };
}

const transientError = (category: MercadoPagoErrorCategory = MERCADOPAGO_ERROR_CATEGORY.TRANSIENT, uncertain = true) =>
  new MercadoPagoOrdersError("boom", { category, outcomeUncertain: uncertain });

describe("PaymentDispatchService", () => {
  it("does nothing when the attempt is no longer waiting to be submitted", async () => {
    const { port, service } = harness(PaymentAttemptStatus.UNKNOWN);

    await expect(service.dispatch({ attemptId: "attempt-1", card })).resolves.toBeNull();
    expect(port.createOrder).not.toHaveBeenCalled();
  });

  it("builds the request from server snapshots and the server idempotency key", async () => {
    const { port, service } = harness();
    port.createOrder.mockResolvedValue(toMercadoPagoOrder(processingOrder));

    await service.dispatch({ attemptId: "attempt-1", card, deviceId: "device-1" });

    expect(port.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: "device-1",
        externalReference: "order_internal_1",
        payment: expect.objectContaining({ amount: "12345.67", paymentMethodType: "credit_card", token: "tok_123456789" }),
        totalAmount: "12345.67",
      }),
      "provider-key-1",
    );
  });

  it.each([
    ["accepted processing", processingOrder],
    ["pending 3DS challenge", pendingChallengeOrder],
  ])("applies %s directly without an extra GET", async (_label, fixture) => {
    const { port, reducer, service } = harness();
    const created = toMercadoPagoOrder(fixture);
    port.createOrder.mockResolvedValue(created);

    await service.dispatch({ attemptId: "attempt-1", card });

    expect(port.getOrder).not.toHaveBeenCalled();
    expect(reducer.applyObservation).toHaveBeenCalledWith("attempt-1", created);
  });

  it.each([
    ["approved", processedAccreditedOrder],
    ["rejected", failedOrder],
  ])("verifies a %s create response with an authoritative GET and applies the GET result", async (_label, fixture) => {
    const { port, reducer, service } = harness();
    const verified = toMercadoPagoOrder(fixture);
    port.createOrder.mockResolvedValue(toMercadoPagoOrder(fixture));
    port.getOrder.mockResolvedValue(verified);

    await service.dispatch({ attemptId: "attempt-1", card });

    expect(port.getOrder).toHaveBeenCalledWith(verified.id);
    expect(reducer.applyObservation).toHaveBeenCalledWith("attempt-1", verified);
  });

  it("marks the outcome unknown, never approved, when verification fails", async () => {
    const { port, reducer, service } = harness();
    const created = toMercadoPagoOrder(processedAccreditedOrder);
    port.createOrder.mockResolvedValue(created);
    port.getOrder.mockRejectedValue(transientError());

    await service.dispatch({ attemptId: "attempt-1", card });

    expect(reducer.applyObservation).not.toHaveBeenCalled();
    expect(reducer.markUnknown).toHaveBeenCalledWith("attempt-1", expect.objectContaining({
      lastError: "verification_failed",
      providerOrderId: created.id,
      providerTransactionId: created.transactions[0]?.id,
    }));
  });

  it("does not retry a transient failure while the in-request CREATE limit is 1", async () => {
    const { port, reducer, service, sleep } = harness();
    port.createOrder.mockRejectedValue(transientError());

    await service.dispatch({ attemptId: "attempt-1", card });

    expect(PAYMENT_CREATE_MAX_CALLS).toBe(1);
    expect(port.createOrder).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(reducer.markUnknown).toHaveBeenCalledWith("attempt-1", { lastError: "provider_transient" });
  });

  it("marks the outcome unknown, holding stock, when transient failures persist", async () => {
    const { port, reducer, service } = harness();
    port.createOrder.mockRejectedValue(transientError());

    await service.dispatch({ attemptId: "attempt-1", card });

    expect(port.createOrder).toHaveBeenCalledTimes(PAYMENT_CREATE_MAX_CALLS);
    expect(reducer.markUnknown).toHaveBeenCalledWith("attempt-1", { lastError: "provider_transient" });
    expect(reducer.rejectWithoutCharge).not.toHaveBeenCalled();
  });

  it("does not wait beyond the in-request budget when the provider asks for a long Retry-After", async () => {
    const { port, reducer, service, sleep } = harness();
    port.createOrder.mockRejectedValue(
      new MercadoPagoOrdersError("slow", { category: MERCADOPAGO_ERROR_CATEGORY.RATE_LIMIT, retryAfterSeconds: 120 }),
    );

    await service.dispatch({ attemptId: "attempt-1", card });

    expect(sleep).not.toHaveBeenCalled();
    expect(port.createOrder).toHaveBeenCalledTimes(1);
    expect(reducer.rejectWithoutCharge).toHaveBeenCalledWith("attempt-1", "rate_limited");
  });

  it("treats a 402 card rejection as a rejected outcome verified by GET, never UNKNOWN", async () => {
    const { reducer, repository, circuit, sleep } = harness();
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(cardRejected402Body), { status: 402 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(cardRejected402Body.data), { status: 200 }));
    const adapter = new MercadoPagoHttpOrdersAdapter(
      { get: () => ({ accessToken: "TEST-token", environment: "test", webhookSecret: "s" }) } as unknown as ConfigService<AppConfig, true>,
      fetchMock as unknown as typeof fetch,
    );
    const service = new PaymentDispatchService(
      adapter,
      reducer as unknown as PaymentReducerService,
      repository as unknown as PaymentsRepository,
      circuit,
      sleep,
    );

    await service.dispatch({ attemptId: "attempt-1", card });

    expect(normalizeProviderStatus({ order: toMercadoPagoOrder(cardRejected402Body.data), paidAmount: "12345.67" })).toMatchObject({ attemptStatus: PaymentAttemptStatus.REJECTED, opensRetryWindow: true });
    expect(reducer.markUnknown).not.toHaveBeenCalled();
    expect(reducer.applyObservation).toHaveBeenCalledWith("attempt-1", expect.objectContaining({ status: "failed" }));
  });

  it.each(["cc_rejected_other_reason", "rejected_by_issuer", "cc_rejected_insufficient_amount"])(
    "normalizes a failed order with transaction detail %s to REJECTED",
    (detail) => {
      const order = toMercadoPagoOrder({ ...failedOrder, transactions: { payments: [{ ...failedOrder.transactions.payments[0], status_detail: detail }] } });

      expect(normalizeProviderStatus({ order, paidAmount: "12345.67" }).attemptStatus).toBe(PaymentAttemptStatus.REJECTED);
    },
  );

  it("opens a retry window without retrying on VALIDATION failures", async () => {
    const { circuit, port, reducer, service } = harness();
    port.createOrder.mockRejectedValue(transientError(MERCADOPAGO_ERROR_CATEGORY.VALIDATION, false));

    await service.dispatch({ attemptId: "attempt-1", card });

    expect(port.createOrder).toHaveBeenCalledTimes(1);
    expect(reducer.rejectWithoutCharge).toHaveBeenCalledWith("attempt-1", "provider_validation");
    expect(circuit.isOpen()).toBe(false);
  });

  it("treats AUTH failures as unavailability: no retry window, order cancelled, circuit open, safe log", async () => {
    const { circuit, port, reducer, service } = harness();
    const logged = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    port.createOrder.mockRejectedValue(
      new MercadoPagoOrdersError("Bearer secret-token", { category: MERCADOPAGO_ERROR_CATEGORY.AUTH, httpStatus: 401 }),
    );

    await service.dispatch({ attemptId: "attempt-1", card });

    expect(port.createOrder).toHaveBeenCalledTimes(1);
    expect(reducer.rejectWithoutCharge).not.toHaveBeenCalled();
    expect(reducer.cancelUncreated).toHaveBeenCalledWith("attempt-1", "provider_auth");
    expect(circuit.isOpen()).toBe(true);
    expect(logged).toHaveBeenCalledTimes(1);
    const line = String(logged.mock.calls[0]?.[0]);
    expect(JSON.parse(line)).toMatchObject({ category: "auth", event: "mercadopago_auth_failure", httpStatus: 401 });
    expect(line).not.toContain("secret-token");
    logged.mockRestore();
  });

  it("passes the 3DS challenge URL of a pending create response through the outcome", async () => {
    const { port, reducer, service } = harness();
    reducer.applyObservation.mockResolvedValue({ attemptStatus: PaymentAttemptStatus.ACTION_REQUIRED, decision: "apply" });
    const created = toMercadoPagoOrder(pendingChallengeOrder);
    port.createOrder.mockResolvedValue(created);

    const outcome = await service.dispatch({ attemptId: "attempt-1", card });

    expect(port.getOrder).not.toHaveBeenCalled();
    expect(outcome?.challengeUrl).toBe(sanitizeChallengeUrl(created.transactions[0]?.transactionSecurityUrl));
  });

  it("flags provider idempotency conflicts for attention while keeping the outcome unknown", async () => {
    const { port, reducer, service } = harness();
    port.createOrder.mockRejectedValue(transientError(MERCADOPAGO_ERROR_CATEGORY.CONFLICT, false));

    await service.dispatch({ attemptId: "attempt-1", card });

    expect(reducer.markUnknown).toHaveBeenCalledWith("attempt-1", expect.objectContaining({ attentionReason: "idempotency_conflict" }));
  });

  it("treats uncertain validation-like failures and unexpected errors as unknown, never rejected", async () => {
    const uncertain = harness();
    uncertain.port.createOrder.mockRejectedValue(transientError(MERCADOPAGO_ERROR_CATEGORY.VALIDATION, true));
    await uncertain.service.dispatch({ attemptId: "attempt-1", card });
    expect(uncertain.reducer.rejectWithoutCharge).not.toHaveBeenCalled();
    expect(uncertain.reducer.markUnknown).toHaveBeenCalled();

    const unexpected = harness();
    unexpected.port.createOrder.mockRejectedValue(new TypeError("socket hang up"));
    await unexpected.service.dispatch({ attemptId: "attempt-1", card });
    expect(unexpected.reducer.markUnknown).toHaveBeenCalledWith("attempt-1", { lastError: "dispatch_failed" });
  });
});
