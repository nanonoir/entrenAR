import { CheckoutSessionStatus, PaymentAttemptStatus, PaymentProvider, Role } from "../../generated/prisma/enums";
import type { MercadoPagoOrdersPort } from "./mercadopago/mercadopago-orders.port";
import type { PaymentReducerService } from "./payment-reducer.service";
import { PaymentStatusService } from "./payment-status.service";
import type { PaymentsRepository } from "./payments.repository";

function harness(boundOrderId: string | null) {
  const repository = {
    latestPendingOrderIdByUser: jest.fn().mockResolvedValue("unrelated-order"),
    orderById: jest.fn().mockResolvedValue({
      checkoutSessionId: "session-1",
      currency: "ARS",
      id: "order-1",
      number: "N-1",
      payment: {
        attempts: [{ id: "attempt-1", providerOrderId: "mp-1", status: PaymentAttemptStatus.ACTION_REQUIRED, challengeCreatedAt: new Date() }],
        provider: PaymentProvider.MERCADOPAGO,
        refundedAmount: 0,
        rowVersion: 1,
        status: "PENDING",
      },
      status: "PENDING",
      total: 10,
      userId: "user-1",
    }),
    orderIdBySession: jest.fn().mockResolvedValue(boundOrderId),
    sessionByToken: jest.fn().mockResolvedValue({ expiresAt: null, id: "session-1", status: CheckoutSessionStatus.ACTIVE, userId: "user-1" }),
    sessionStatus: jest.fn().mockResolvedValue(CheckoutSessionStatus.ACTIVE),
    databaseNow: jest.fn().mockResolvedValue(new Date()),
  };
  const port = { createOrder: jest.fn(), getOrder: jest.fn(), searchOrders: jest.fn() };
  const service = new PaymentStatusService(
    repository as unknown as PaymentsRepository,
    {} as PaymentReducerService,
    port as unknown as MercadoPagoOrdersPort,
  );
  return { port, repository, service };
}

describe("PaymentStatusService", () => {
  const owner = { role: Role.CUSTOMER, sessionToken: "token", userId: "user-1" };

  it("returns null, not an unrelated order, when a valid session has no bound order", async () => {
    const { repository, service } = harness(null);

    await expect(service.activeForOwner(owner)).resolves.toBeNull();
    expect(repository.latestPendingOrderIdByUser).not.toHaveBeenCalled();
  });

  it("falls back to the latest pending order only for token-less customers", async () => {
    const { repository, service } = harness(null);
    repository.orderById.mockResolvedValue(null);

    await expect(service.activeForOwner({ role: Role.CUSTOMER, userId: "user-1" })).rejects.toBeDefined();
    expect(repository.latestPendingOrderIdByUser).toHaveBeenCalledWith("user-1");
  });

  it("uses a known challenge URL instead of a redundant provider GET", async () => {
    const { port, service } = harness("order-1");

    const view = await service.viewOwnedOrder("order-1", owner, "https://www.mercadopago.com/3ds/challenge");

    expect(port.getOrder).not.toHaveBeenCalled();
    expect(view.challenge?.url).toBe("https://www.mercadopago.com/3ds/challenge");
  });
});
