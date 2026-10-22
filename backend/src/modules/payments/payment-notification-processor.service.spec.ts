import type { PrismaService } from "../../common/prisma/prisma.service";
import { PaymentNotificationStatus } from "../../generated/prisma/enums";
import { MercadoPagoOrdersError, type MercadoPagoOrder } from "./mercadopago/mercadopago-orders.port";
import {
  NOTIFICATION_MAX_PROCESS_ATTEMPTS,
  PaymentNotificationProcessorService,
  notificationBackoffMs,
} from "./payment-notification-processor.service";
import type { PaymentReducerService } from "./payment-reducer.service";
import type { PaymentsRepository } from "./payments.repository";
import type { PaymentsTransaction } from "./payments-transaction";

const DB_NOW = new Date("2026-10-21T12:00:00.000Z");

function observation(overrides: Partial<MercadoPagoOrder> = {}): MercadoPagoOrder {
  return {
    chargebacks: [],
    externalReference: "order-1",
    id: "ORD1",
    refundedAmount: "0.00",
    status: "processed",
    statusDetail: "accredited",
    totalAmount: "100.00",
    transactions: [],
    ...overrides,
  };
}

function harness(row: { processAttempts?: number; resourceId?: string; topic?: string } = {}) {
  const claimed = { id: "n1", leaseFence: 1, processAttempts: 1, resourceId: "ORD1", topic: "order", ...row };
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const prisma = { $queryRaw: jest.fn().mockResolvedValue([claimed]), paymentNotification: { updateMany } };
  const repository = {
    attemptByProviderOrderId: jest.fn().mockResolvedValue(null),
    databaseNow: jest.fn().mockResolvedValue(DB_NOW),
    orderById: jest.fn().mockResolvedValue(null),
    unresolvedAttemptsWithoutProviderOrder: jest.fn().mockResolvedValue([]),
  };
  const reducer = { applyObservation: jest.fn().mockResolvedValue({}) };
  const port = { createOrder: jest.fn(), getOrder: jest.fn().mockResolvedValue(observation()), searchOrders: jest.fn() };
  const transactions = { run: jest.fn() };
  const service = new PaymentNotificationProcessorService(
    prisma as unknown as PrismaService,
    repository as unknown as PaymentsRepository,
    reducer as unknown as PaymentReducerService,
    transactions as unknown as PaymentsTransaction,
    port,
  );
  return { port, reducer, repository, service, transactions, updateMany };
}

const lastStatus = (updateMany: jest.Mock) => updateMany.mock.calls.at(-1)![0].data;

describe("PaymentNotificationProcessorService", () => {
  it("associates by provider order id, reduces once and marks the row processed under its fence", async () => {
    const h = harness();
    h.repository.attemptByProviderOrderId.mockResolvedValue({ id: "attempt-1", payment: { orderId: "order-1" } });

    await expect(h.service.processById("n1")).resolves.toBe("processed");

    expect(h.port.getOrder).toHaveBeenCalledWith("ORD1");
    expect(h.reducer.applyObservation).toHaveBeenCalledWith("attempt-1", expect.objectContaining({ id: "ORD1" }));
    expect(lastStatus(h.updateMany)).toMatchObject({ attemptId: "attempt-1", status: PaymentNotificationStatus.PROCESSED });
    expect(h.updateMany.mock.calls.at(-1)![0].where).toMatchObject({ leaseFence: 1, status: PaymentNotificationStatus.PROCESSING });
  });

  it("associates a webhook that beats the dispatch result through the external reference and one candidate", async () => {
    const h = harness();
    h.repository.orderById.mockResolvedValue({ id: "order-1", payment: { provider: "MERCADOPAGO" } });
    h.repository.unresolvedAttemptsWithoutProviderOrder.mockResolvedValue([{ id: "attempt-9" }]);

    await expect(h.service.processById("n1")).resolves.toBe("processed");
    expect(h.reducer.applyObservation).toHaveBeenCalledWith("attempt-9", expect.anything());
  });

  it.each([
    ["unknown order", null, []],
    ["no candidate", { id: "order-1", payment: { provider: "MERCADOPAGO" } }, []],
    ["ambiguous candidates", { id: "order-1", payment: { provider: "MERCADOPAGO" } }, [{ id: "a" }, { id: "b" }]],
    ["non Mercado Pago order", { id: "order-1", payment: { provider: null } }, [{ id: "a" }]],
  ])("retries with backoff and never reduces on %s", async (_name, order, candidates) => {
    const h = harness();
    h.repository.orderById.mockResolvedValue(order);
    h.repository.unresolvedAttemptsWithoutProviderOrder.mockResolvedValue(candidates);

    await expect(h.service.processById("n1")).resolves.toBe("retry");

    expect(h.reducer.applyObservation).not.toHaveBeenCalled();
    expect(lastStatus(h.updateMany)).toMatchObject({
      nextRunAt: new Date(DB_NOW.getTime() + notificationBackoffMs(1)),
      status: PaymentNotificationStatus.PENDING,
    });
  });

  it("quarantines with a reason once retries are exhausted", async () => {
    const h = harness({ processAttempts: NOTIFICATION_MAX_PROCESS_ATTEMPTS });
    await expect(h.service.processById("n1")).resolves.toBe("quarantined");
    expect(lastStatus(h.updateMany)).toMatchObject({ quarantineReason: "unknown_association", status: PaymentNotificationStatus.QUARANTINED });
  });

  it("quarantines immediately when the provider returns a different order than the signed id", async () => {
    const h = harness();
    h.port.getOrder.mockResolvedValue(observation({ id: "ORD-OTHER" }));
    await expect(h.service.processById("n1")).resolves.toBe("quarantined");
    expect(lastStatus(h.updateMany).quarantineReason).toBe("resource_mismatch");
    expect(h.reducer.applyObservation).not.toHaveBeenCalled();
  });

  it("retries provider failures with a sanitized category", async () => {
    const h = harness({ processAttempts: NOTIFICATION_MAX_PROCESS_ATTEMPTS });
    h.port.getOrder.mockRejectedValue(new MercadoPagoOrdersError("boom", { category: "transient" }));
    await expect(h.service.processById("n1")).resolves.toBe("quarantined");
    expect(lastStatus(h.updateMany).quarantineReason).toBe("provider_transient");
  });

  it("skips when the fence no longer matches (a newer lease owns the row)", async () => {
    const h = harness();
    h.repository.attemptByProviderOrderId.mockResolvedValue({ id: "attempt-1", payment: { orderId: "order-1" } });
    h.updateMany.mockResolvedValue({ count: 0 });
    await expect(h.service.processById("n1")).resolves.toBe("skipped");
  });

  describe("chargebacks and fraud alerts", () => {
    it("quarantines non-Orders resource ids without any provider call or hold", async () => {
      const h = harness({ resourceId: "1234567890", topic: "topic_chargebacks_wh" });
      await expect(h.service.processById("n1")).resolves.toBe("quarantined");
      expect(lastStatus(h.updateMany).quarantineReason).toBe("unverified_association");
      expect(h.port.getOrder).not.toHaveBeenCalled();
      expect(h.transactions.run).not.toHaveBeenCalled();
    });

    it("quarantines fraud alerts as unverified, even for a known provider order, with no provider call or hold", async () => {
      for (const resourceId of ["1234567890", "ORD1"]) {
        const h = harness({ resourceId, topic: "stop_delivery_op_wh" });
        h.repository.attemptByProviderOrderId.mockResolvedValue({ id: "attempt-1", payment: { orderId: "order-1" } });
        await expect(h.service.processById("n1")).resolves.toBe("quarantined");
        expect(lastStatus(h.updateMany).quarantineReason).toBe("unverified_fraud_association");
        expect(h.port.getOrder).not.toHaveBeenCalled();
        expect(h.reducer.applyObservation).not.toHaveBeenCalled();
        expect(h.transactions.run).not.toHaveBeenCalled();
      }
    });

    it("retries a chargeback whose provider order is not known locally and never invents an association", async () => {
      const h = harness({ topic: "topic_chargebacks_wh" });
      await expect(h.service.processById("n1")).resolves.toBe("retry");
      expect(h.transactions.run).not.toHaveBeenCalled();
    });

    it("quarantines when the authoritative external reference does not match the attempt's order", async () => {
      const h = harness({ topic: "topic_chargebacks_wh" });
      h.repository.attemptByProviderOrderId.mockResolvedValue({ id: "attempt-1", payment: { orderId: "someone-else" } });
      await expect(h.service.processById("n1")).resolves.toBe("quarantined");
      expect(lastStatus(h.updateMany).quarantineReason).toBe("external_reference_mismatch");
    });

    it("requires chargeback evidence in the authoritative read before recording a dispute", async () => {
      const h = harness({ topic: "topic_chargebacks_wh" });
      h.repository.attemptByProviderOrderId.mockResolvedValue({ id: "attempt-1", payment: { orderId: "order-1" } });
      await expect(h.service.processById("n1")).resolves.toBe("retry");
      expect(h.transactions.run).not.toHaveBeenCalled();

      h.port.getOrder.mockResolvedValue(observation({ chargebacks: [{ id: "cb1", status: "in_process" }] }));
      await expect(h.service.processById("n1")).resolves.toBe("processed");
      expect(h.reducer.applyObservation).toHaveBeenCalledWith("attempt-1", expect.anything());
      expect(h.transactions.run).toHaveBeenCalledTimes(1);
    });
  });
});

describe("notificationBackoffMs", () => {
  it("grows exponentially and is capped", () => {
    expect(notificationBackoffMs(1)).toBe(15_000);
    expect(notificationBackoffMs(2)).toBe(30_000);
    expect(notificationBackoffMs(30)).toBe(15 * 60 * 1_000);
  });
});
