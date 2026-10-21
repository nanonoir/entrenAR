import { Role } from "../../generated/prisma/enums";
import { MERCADOPAGO_ERROR_CATEGORY, MercadoPagoOrdersError } from "./mercadopago/mercadopago-orders.port";
import { PaymentUnknownResolutionService } from "./payment-unknown-resolution.service";

const NOW = new Date("2026-10-21T12:00:00.000Z");
const ACTOR = { id: "admin-1", role: Role.ADMIN };

function harness(attempt: Partial<{ attention: Date | null; minutesAgo: number; providerOrderId: string | null }> | null = {}) {
  const row = attempt === null ? null : {
    id: "attempt-1",
    payment: { attentionRequiredAt: attempt.attention ?? null },
    providerOrderId: attempt.providerOrderId ?? null,
    reconcileFence: 7,
    submittedAt: new Date(NOW.getTime() - (attempt.minutesAgo ?? 1) * 60_000),
  };
  const prisma = { paymentAttempt: { findFirst: jest.fn().mockResolvedValue(row) } };
  const repository = { databaseNow: jest.fn().mockResolvedValue(NOW) };
  const reconciliation = { locateProviderOrder: jest.fn() };
  const reducer = { applyObservation: jest.fn().mockResolvedValue({ decision: "apply" }), cancelUncreated: jest.fn().mockResolvedValue({ decision: "apply" }) };
  const port = { getOrder: jest.fn(), searchOrders: jest.fn() };
  const service = new PaymentUnknownResolutionService(prisma as never, repository as never, reconciliation as never, reducer as never, port as never);
  return { port, reconciliation, reducer, service };
}

describe("PaymentUnknownResolutionService", () => {
  it.each([
    ["there is no UNKNOWN attempt", null],
    ["the attempt is recent and not flagged", { minutesAgo: 5 }],
  ])("answers 409 without calling the provider when %s", async (_name, attempt) => {
    const { port, reconciliation, reducer, service } = harness(attempt);

    await expect(service.resolve("order-1", ACTOR)).rejects.toMatchObject({ status: 409 });
    expect(reconciliation.locateProviderOrder).not.toHaveBeenCalled();
    expect(port.getOrder).not.toHaveBeenCalled();
    expect(reducer.cancelUncreated).not.toHaveBeenCalled();
  });

  it("re-reads a known provider order and applies it with the attempt fence, cancelling nothing", async () => {
    const { port, reducer, service } = harness({ attention: NOW, providerOrderId: "ORD1" });
    const observation = { id: "ORD1" };
    port.getOrder.mockResolvedValue(observation);

    await expect(service.resolve("order-1", ACTOR)).resolves.toBe("payment_updated");
    expect(reducer.applyObservation).toHaveBeenCalledWith("attempt-1", observation, 7);
    expect(reducer.cancelUncreated).not.toHaveBeenCalled();
  });

  it("applies the order located by external reference when the attempt is older than 30 minutes", async () => {
    const { port, reconciliation, reducer, service } = harness({ minutesAgo: 31 });
    reconciliation.locateProviderOrder.mockResolvedValue({ kind: "found", providerOrderId: "ORD2" });
    port.getOrder.mockResolvedValue({ id: "ORD2" });

    await expect(service.resolve("order-1", ACTOR)).resolves.toBe("payment_updated");
    expect(port.getOrder).toHaveBeenCalledWith("ORD2");
    expect(reducer.applyObservation).toHaveBeenCalledWith("attempt-1", { id: "ORD2" }, 7);
  });

  it("closes the attempt and cancels the order only when the search confirms nothing exists", async () => {
    const { reconciliation, reducer, service } = harness({ attention: NOW });
    reconciliation.locateProviderOrder.mockResolvedValue({ kind: "absent" });

    await expect(service.resolve("order-1", ACTOR)).resolves.toBe("order_cancelled");
    expect(reducer.cancelUncreated).toHaveBeenCalledWith("attempt-1", expect.any(String), expect.objectContaining({ actor: ACTOR, requireUnknown: true }));
    expect(reducer.applyObservation).not.toHaveBeenCalled();
  });

  it.each([
    ["a search failure", (m: ReturnType<typeof harness>) => m.reconciliation.locateProviderOrder.mockRejectedValue(new MercadoPagoOrdersError("down", { category: MERCADOPAGO_ERROR_CATEGORY.TRANSIENT }))],
    ["a read failure", (m: ReturnType<typeof harness>) => { m.reconciliation.locateProviderOrder.mockResolvedValue({ kind: "found", providerOrderId: "ORD2" }); m.port.getOrder.mockRejectedValue(new Error("5xx")); }],
  ])("answers 503 and changes nothing after %s", async (_name, arrange) => {
    const h = harness({ attention: NOW });
    arrange(h);

    await expect(h.service.resolve("order-1", ACTOR)).rejects.toMatchObject({ status: 503 });
    expect(h.reducer.applyObservation).not.toHaveBeenCalled();
    expect(h.reducer.cancelUncreated).not.toHaveBeenCalled();
  });

  it("answers 409 and cancels nothing when provider orders cannot be attributed to the attempt", async () => {
    const { reconciliation, reducer, service } = harness({ attention: NOW });
    reconciliation.locateProviderOrder.mockResolvedValue({ kind: "unresolved" });

    await expect(service.resolve("order-1", ACTOR)).rejects.toMatchObject({ status: 409 });
    expect(reducer.cancelUncreated).not.toHaveBeenCalled();
  });

  it.each([
    ["a stale reducer fence", "applyObservation", { stale: true }, { kind: "found", providerOrderId: "ORD2" }],
    ["a reducer that no longer sees an UNKNOWN attempt", "cancelUncreated", { decision: "ignore" }, { kind: "absent" }],
  ] as const)("answers 409 on %s", async (_name, method, result, located) => {
    const h = harness({ attention: NOW });
    h.reconciliation.locateProviderOrder.mockResolvedValue(located);
    h.port.getOrder.mockResolvedValue({ id: "ORD2" });
    h.reducer[method].mockResolvedValue(result);

    await expect(h.service.resolve("order-1", ACTOR)).rejects.toMatchObject({ status: 409 });
  });
});
