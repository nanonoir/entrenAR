import { PaymentAttemptStatus } from "../../generated/prisma/enums";
import {
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
import { toMercadoPagoOrder } from "./mercadopago/mercadopago-orders.schemas";
import { PaymentDispatchService } from "./payment-dispatch.service";
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
  const service = new PaymentDispatchService(
    port,
    reducer as unknown as PaymentReducerService,
    repository as unknown as PaymentsRepository,
    sleep,
  );

  return { port, reducer, repository, service, sleep };
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

  it("retries a transient failure once with the same key and body", async () => {
    const { port, reducer, service, sleep } = harness();
    port.createOrder.mockRejectedValueOnce(transientError()).mockResolvedValueOnce(toMercadoPagoOrder(processingOrder));

    await service.dispatch({ attemptId: "attempt-1", card });

    expect(port.createOrder).toHaveBeenCalledTimes(2);
    expect(port.createOrder.mock.calls[1]).toEqual(port.createOrder.mock.calls[0]);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep.mock.calls[0]?.[0]).toBeGreaterThanOrEqual(500);
    expect(reducer.applyObservation).toHaveBeenCalled();
  });

  it("marks the outcome unknown, holding stock, when transient failures persist", async () => {
    const { port, reducer, service } = harness();
    port.createOrder.mockRejectedValue(transientError());

    await service.dispatch({ attemptId: "attempt-1", card });

    expect(port.createOrder).toHaveBeenCalledTimes(2);
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

  it.each([MERCADOPAGO_ERROR_CATEGORY.VALIDATION, MERCADOPAGO_ERROR_CATEGORY.AUTH])(
    "opens a retry window without retrying on %s failures",
    async (category) => {
      const { port, reducer, service } = harness();
      port.createOrder.mockRejectedValue(transientError(category, false));

      await service.dispatch({ attemptId: "attempt-1", card });

      expect(port.createOrder).toHaveBeenCalledTimes(1);
      expect(reducer.rejectWithoutCharge).toHaveBeenCalledWith("attempt-1", `provider_${category}`);
    },
  );

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
