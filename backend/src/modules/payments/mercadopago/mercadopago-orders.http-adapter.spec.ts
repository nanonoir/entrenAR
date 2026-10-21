import type { ConfigService } from "@nestjs/config";

import type { AppConfig } from "../../../config/app.config";
import {
  canceledOrder,
  chargedBackOrder,
  failedOrder,
  partiallyRefundedOrder,
  pendingChallengeOrder,
  processedAccreditedOrder,
  refundedOrder,
} from "./__fixtures__/orders.fixtures";
import {
  MERCADOPAGO_API_ORIGIN,
  MERCADOPAGO_REQUEST_TIMEOUT_MS,
  MercadoPagoHttpOrdersAdapter,
} from "./mercadopago-orders.http-adapter";
import { MercadoPagoOrdersError, type CreateMercadoPagoOrderRequest } from "./mercadopago-orders.port";

const ACCESS_TOKEN = "TEST-access-token-value";
const CARD_TOKEN = "card-token-value-123";

const createRequest: CreateMercadoPagoOrderRequest = {
  externalReference: "order_internal_1",
  items: [{ quantity: 2, title: "Proteina", unitPrice: "6172.84" }],
  payer: { email: "cliente@example.com", firstName: "Ana", identification: { number: "12345678", type: "DNI" }, lastName: "Perez" },
  payment: { amount: "12345.67", installments: 1, paymentMethodId: "master", paymentMethodType: "credit_card", statementDescriptor: "ENTRENAR", token: CARD_TOKEN },
  totalAmount: "12345.67",
};

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json", ...headers }, status });
}

function createAdapter(fetchMock: jest.Mock, configured = true) {
  const configService = {
    get: jest.fn(() => (configured ? { accessToken: ACCESS_TOKEN, environment: "test", webhookSecret: "secret-value" } : undefined)),
  } as unknown as ConfigService<AppConfig, true>;

  return new MercadoPagoHttpOrdersAdapter(configService, fetchMock as unknown as typeof fetch);
}

async function catchError(promise: Promise<unknown>): Promise<MercadoPagoOrdersError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(MercadoPagoOrdersError);
    return error as MercadoPagoOrdersError;
  }
  throw new Error("Expected the call to fail.");
}

describe("MercadoPagoHttpOrdersAdapter", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  describe("createOrder", () => {
    it("posts the documented card projection to the fixed origin with an idempotency key", async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse(processedAccreditedOrder, 201));
      const order = await createAdapter(fetchMock).createOrder(createRequest, "11111111-1111-4111-8111-111111111111");

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);

      expect(url).toBe(`${MERCADOPAGO_API_ORIGIN}/v1/orders`);
      expect(init.method).toBe("POST");
      expect(init.headers).toMatchObject({
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": "11111111-1111-4111-8111-111111111111",
      });
      expect(body).toMatchObject({
        capture_mode: "automatic",
        config: { online: { transaction_security: { liability_shift: "required", validation: "on_fraud_risk" } } },
        external_reference: "order_internal_1",
        processing_mode: "automatic",
        total_amount: "12345.67",
        type: "online",
      });
      expect(body.transactions.payments).toEqual([
        {
          amount: "12345.67",
          payment_method: { id: "master", installments: 1, statement_descriptor: "ENTRENAR", token: CARD_TOKEN, type: "credit_card" },
        },
      ]);
      expect(body).not.toHaveProperty("notification_url");
      expect(order).toMatchObject({
        externalReference: "order_internal_1",
        id: "ORD01TESTORDER000000000000001",
        status: "processed",
        statusDetail: "accredited",
        totalAmount: "12345.67",
      });
      expect(JSON.stringify(order)).not.toContain(CARD_TOKEN);
    });

    it("applies a 10 second abort timeout and reports an uncertain outcome", async () => {
      jest.useFakeTimers();
      const fetchMock = jest.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      }));
      const pending = catchError(createAdapter(fetchMock).createOrder(createRequest, "key"));

      await jest.advanceTimersByTimeAsync(MERCADOPAGO_REQUEST_TIMEOUT_MS);
      const error = await pending;

      expect(error).toMatchObject({ category: "transient", outcomeUncertain: true, providerCode: "timeout" });
      expect(error.message).not.toContain(CARD_TOKEN);
    });

    it("reports network failures as transient and uncertain without leaking the request", async () => {
      const fetchMock = jest.fn().mockRejectedValue(new Error(`socket hang up ${CARD_TOKEN}`));
      const error = await catchError(createAdapter(fetchMock).createOrder(createRequest, "key"));

      expect(error).toMatchObject({ category: "transient", outcomeUncertain: true, providerCode: "network_error" });
      expect(error.message).not.toContain(CARD_TOKEN);
    });

    it.each([
      [400, "validation", false],
      [422, "validation", false],
      [401, "auth", false],
      [403, "auth", false],
      [409, "conflict", false],
      [429, "rate_limit", false],
      [500, "transient", true],
      [503, "transient", true],
      [418, "unknown", true],
    ])("maps HTTP %i to the %s category", async (status, category, uncertain) => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ errors: [{ code: "provider_code", message: `echo ${CARD_TOKEN}` }] }, status, { "retry-after": "7" }));
      const error = await catchError(createAdapter(fetchMock).createOrder(createRequest, "key"));

      expect(error).toMatchObject({ category, httpStatus: status, outcomeUncertain: uncertain, providerCode: "provider_code" });
      expect(error.message).not.toContain(CARD_TOKEN);
      if (status === 429) expect(error.retryAfterSeconds).toBe(7);
    });

    it("treats an unparseable successful response as an uncertain unknown error", async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ id: "ORD1" }, 201));
      const error = await catchError(createAdapter(fetchMock).createOrder(createRequest, "key"));

      expect(error).toMatchObject({ category: "unknown", outcomeUncertain: true, providerCode: "invalid_response" });
    });

    it("fails without calling the network when the integration is not configured", async () => {
      const fetchMock = jest.fn();
      const error = await catchError(createAdapter(fetchMock, false).createOrder(createRequest, "key"));

      expect(error.providerCode).toBe("integration_not_configured");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("getOrder", () => {
    it("reads an order without an idempotency key and without sending a body", async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse(pendingChallengeOrder));
      const order = await createAdapter(fetchMock).getOrder("ORD/01 test");

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${MERCADOPAGO_API_ORIGIN}/v1/orders/ORD%2F01%20test`);
      expect(init.method).toBe("GET");
      expect(init.body).toBeUndefined();
      expect(init.headers).not.toHaveProperty("X-Idempotency-Key");
      expect(order).toMatchObject({ status: "action_required", statusDetail: "pending_challenge" });
    });

    it("normalizes failed, refunded and charged back orders", async () => {
      const fetchMock = jest.fn()
        .mockResolvedValueOnce(jsonResponse(failedOrder))
        .mockResolvedValueOnce(jsonResponse(partiallyRefundedOrder))
        .mockResolvedValueOnce(jsonResponse(refundedOrder))
        .mockResolvedValueOnce(jsonResponse(chargedBackOrder))
        .mockResolvedValueOnce(jsonResponse(canceledOrder));
      const adapter = createAdapter(fetchMock);

      const failed = await adapter.getOrder("a");
      const partial = await adapter.getOrder("b");
      const refunded = await adapter.getOrder("c");
      const chargedBack = await adapter.getOrder("d");
      const canceled = await adapter.getOrder("e");

      expect(failed.transactions[0]).toMatchObject({ status: "failed", statusDetail: "rejected_by_issuer" });
      expect(partial.refundedAmount).toBe("345.67");
      expect(refunded.refundedAmount).toBe("12345.67");
      expect(chargedBack.chargebacks).toEqual([{ caseId: "1234567890", id: "CBK01TESTCHARGEBACK00000001", status: "in_process", transactionId: "PAY01TESTPAYMENT00000000001" }]);
      expect(canceled.status).toBe("canceled");
    });

    it("keeps unknown future statuses parseable", async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ ...processedAccreditedOrder, status: "brand_new_status", status_detail: "brand_new_detail" }));

      await expect(createAdapter(fetchMock).getOrder("a")).resolves.toMatchObject({ status: "brand_new_status", statusDetail: "brand_new_detail" });
    });

    it("rejects malformed amounts", async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ ...processedAccreditedOrder, total_amount: "12.345" }));

      await expect(createAdapter(fetchMock).getOrder("a")).rejects.toMatchObject({ providerCode: "invalid_response" });
    });

    it("maps a 404 to an unknown category carrying the HTTP status", async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ errors: [{ code: "order_not_found" }] }, 404));

      await expect(createAdapter(fetchMock).getOrder("a")).rejects.toMatchObject({ category: "unknown", httpStatus: 404, providerCode: "order_not_found" });
    });
  });

  describe("searchOrders", () => {
    it("searches by external reference with a bounded limit", async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ data: [processedAccreditedOrder, failedOrder] }));
      const orders = await createAdapter(fetchMock).searchOrders({ externalReference: "order_internal_1", limit: 500 });

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toBe(`${MERCADOPAGO_API_ORIGIN}/v1/orders?external_reference=order_internal_1&limit=20`);
      expect(orders).toHaveLength(2);
    });

    it("accepts a bare array and truncates to the limit", async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse([processedAccreditedOrder, failedOrder, canceledOrder]));
      const orders = await createAdapter(fetchMock).searchOrders({ externalReference: "order_internal_1", limit: 2 });

      expect(orders).toHaveLength(2);
    });

    it("rejects an unexpected search shape", async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ unexpected: true }));

      await expect(createAdapter(fetchMock).searchOrders({ externalReference: "x" })).rejects.toMatchObject({ category: "unknown" });
    });
  });
});
