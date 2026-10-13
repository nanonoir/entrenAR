import { Prisma } from "../../generated/prisma/client";
import { CheckoutOrderRepository, type CheckoutOrderCreateInput } from "./checkout-order.repository";
import type { TransactionClient } from "./checkout-cart.repository";

describe("checkout optional object snapshots", () => {
  it("stores absent pickup address and bank snapshot as SQL NULL, never JSON null", async () => {
    const order = { id: "order" };
    const tx = {
      order: { create: jest.fn().mockResolvedValue(order), findUniqueOrThrow: jest.fn().mockResolvedValue(order) },
      orderItem: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      orderPayment: { create: jest.fn().mockResolvedValue({}) },
    };
    const input: CheckoutOrderCreateInput = {
      currency: "ARS", customerEmail: "demo@example.invalid", customerFirstName: "Demo", customerLastName: "Ficticio", customerSnapshot: {}, deliverySnapshot: {}, discountSnapshot: {},
      deliveryType: "PICKUP", shippingAddressSnapshot: null, discountAmount: 0, shippingCost: 0, subtotal: 100, total: 100, number: "DEMO", status: "PENDING", inventoryPolicy: "NOT_APPLICABLE", items: [],
      payment: { amount: 100, currency: "ARS", paymentMethodId: "manual", paymentMethodSnapshot: {}, status: "PENDING", bankTransferSnapshot: null },
    };
    await new CheckoutOrderRepository().createPendingOrder(tx as unknown as TransactionClient, input);
    expect(tx.order.create.mock.calls[0]?.[0].data.shippingAddressSnapshot).toBe(Prisma.DbNull);
    expect(tx.orderPayment.create.mock.calls[0]?.[0].data.bankTransferSnapshot).toBe(Prisma.DbNull);
  });
});
