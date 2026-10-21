import { PaymentAttemptStatus } from "../../generated/prisma/enums";
import { MERCADOPAGO_ERROR_CATEGORY, MercadoPagoOrdersError } from "./mercadopago/mercadopago-orders.port";
import { PaymentReconciliationService } from "./payment-reconciliation.service";

function harness() {
  const now = new Date("2026-10-21T12:00:00.000Z");
  const prisma = {
    $queryRaw: jest.fn(),
    orderPayment: { findMany: jest.fn().mockResolvedValue([]) },
    paymentAttempt: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const repository = { databaseNow: jest.fn().mockResolvedValue(now), unresolvedAttemptsWithoutProviderOrder: jest.fn() };
  const reducer = { applyObservation: jest.fn(), expireUnpaid: jest.fn(), flagAttention: jest.fn() };
  const port = { createOrder: jest.fn(), getOrder: jest.fn(), searchOrders: jest.fn() };
  const service = new PaymentReconciliationService(prisma as never, repository as never, reducer as never, port as never);
  return { now, port, prisma, reducer, repository, service };
}

describe("PaymentReconciliationService", () => {
  it("never releases stock when a search finds nothing for an UNKNOWN attempt", async () => {
    const { port, prisma, reducer, service } = harness();
    prisma.paymentAttempt.findUnique
      .mockResolvedValueOnce({ payment: { orderId: "order-1" } })
      .mockResolvedValueOnce({ payment: { reviewStartedAt: null }, status: PaymentAttemptStatus.UNKNOWN, submittedAt: new Date("2026-10-21T10:00:00.000Z") });
    port.searchOrders.mockResolvedValue([]);

    const outcome = await service.reconcileClaimed({ id: "attempt-1", providerOrderId: null, reconcileFence: 3 });

    expect(outcome).toBe("unresolved");
    expect(port.getOrder).not.toHaveBeenCalled();
    expect(reducer.applyObservation).not.toHaveBeenCalled();
    expect(reducer.expireUnpaid).not.toHaveBeenCalled();
    const [{ data, where }] = prisma.paymentAttempt.updateMany.mock.calls[0] as [{ data: Record<string, unknown>; where: Record<string, unknown> }];
    expect(where).toEqual({ id: "attempt-1", reconcileFence: 3 });
    expect(data["reconcileLeaseUntil"]).toBeNull();
    expect((data["nextReconcileAt"] as Date).getTime() - new Date("2026-10-21T12:00:00.000Z").getTime()).toBe(5 * 60_000);
  });

  it("applies the single unmatched provider order found by external reference, with the claim fence", async () => {
    const { port, prisma, reducer, repository, service } = harness();
    prisma.paymentAttempt.findUnique
      .mockResolvedValueOnce({ payment: { orderId: "order-1" } })
      .mockResolvedValueOnce({ payment: { reviewStartedAt: null }, status: PaymentAttemptStatus.PROCESSING, submittedAt: new Date("2026-10-21T11:59:00.000Z") });
    const found = { externalReference: "order-1", id: "ORD1" };
    port.searchOrders.mockResolvedValue([found, { externalReference: "other", id: "ORD2" }]);
    port.getOrder.mockResolvedValue(found);
    prisma.paymentAttempt.findMany.mockResolvedValue([]);
    repository.unresolvedAttemptsWithoutProviderOrder.mockResolvedValue([{ id: "attempt-1" }]);
    reducer.applyObservation.mockResolvedValue({});

    expect(await service.reconcileClaimed({ id: "attempt-1", providerOrderId: null, reconcileFence: 4 })).toBe("applied");
    expect(port.getOrder).toHaveBeenCalledWith("ORD1");
    expect(reducer.applyObservation).toHaveBeenCalledWith("attempt-1", found, 4);
  });

  it("flags attention instead of guessing when several provider orders are unmatched", async () => {
    const { port, prisma, reducer, repository, service } = harness();
    prisma.paymentAttempt.findUnique
      .mockResolvedValueOnce({ payment: { orderId: "order-1" } })
      .mockResolvedValueOnce({ payment: { reviewStartedAt: null }, status: PaymentAttemptStatus.UNKNOWN, submittedAt: new Date("2026-10-21T11:59:00.000Z") });
    port.searchOrders.mockResolvedValue([{ externalReference: "order-1", id: "ORD1" }, { externalReference: "order-1", id: "ORD2" }]);
    repository.unresolvedAttemptsWithoutProviderOrder.mockResolvedValue([{ id: "attempt-1" }]);

    expect(await service.reconcileClaimed({ id: "attempt-1", providerOrderId: null, reconcileFence: 1 })).toBe("unresolved");
    expect(reducer.flagAttention).toHaveBeenCalledWith("attempt-1", "ambiguous_provider_orders");
    expect(reducer.applyObservation).not.toHaveBeenCalled();
  });

  it("does not write a release when the reducer refused a stale fence", async () => {
    const { port, prisma, reducer, service } = harness();
    port.getOrder.mockResolvedValue({ id: "ORD1" });
    reducer.applyObservation.mockResolvedValue({ stale: true });

    expect(await service.reconcileClaimed({ id: "attempt-1", providerOrderId: "ORD1", reconcileFence: 1 })).toBe("stale");
    expect(prisma.paymentAttempt.updateMany).not.toHaveBeenCalled();
  });

  it("reschedules after provider failures without changing attempt state", async () => {
    const { port, prisma, reducer, service } = harness();
    prisma.paymentAttempt.findUnique.mockResolvedValue({ payment: { reviewStartedAt: null }, status: PaymentAttemptStatus.PROCESSING, submittedAt: new Date("2026-10-21T11:59:30.000Z") });
    port.getOrder.mockRejectedValue(new MercadoPagoOrdersError("down", { category: MERCADOPAGO_ERROR_CATEGORY.TRANSIENT }));

    expect(await service.reconcileClaimed({ id: "attempt-1", providerOrderId: "ORD1", reconcileFence: 1 })).toBe("failed");
    expect(reducer.applyObservation).not.toHaveBeenCalled();
    expect(prisma.paymentAttempt.updateMany).toHaveBeenCalledTimes(1);
  });

  it("postpones expiry when a known provider order cannot be re-read", async () => {
    const { port, prisma, reducer, service } = harness();
    prisma.orderPayment.findMany.mockResolvedValue([
      { attempts: [{ id: "a1", providerOrderId: "ORD1", status: PaymentAttemptStatus.REJECTED }], orderId: "order-1" },
    ]);
    port.getOrder.mockRejectedValue(new MercadoPagoOrdersError("down", { category: MERCADOPAGO_ERROR_CATEGORY.TRANSIENT }));

    expect(await service.expireDue()).toEqual(["postponed"]);
    expect(reducer.expireUnpaid).not.toHaveBeenCalled();
  });

  it("re-reads known provider orders before releasing", async () => {
    const { port, prisma, reducer, service } = harness();
    prisma.orderPayment.findMany.mockResolvedValue([
      { attempts: [{ id: "a1", providerOrderId: "ORD1", status: PaymentAttemptStatus.REJECTED }], orderId: "order-1" },
    ]);
    port.getOrder.mockResolvedValue({ id: "ORD1" });
    reducer.expireUnpaid.mockResolvedValue(true);

    expect(await service.expireDue()).toEqual(["released"]);
    expect(port.getOrder).toHaveBeenCalledWith("ORD1");
    expect(reducer.applyObservation).toHaveBeenCalledWith("a1", { id: "ORD1" });
    expect(reducer.expireUnpaid).toHaveBeenCalledWith("order-1");
  });
});
