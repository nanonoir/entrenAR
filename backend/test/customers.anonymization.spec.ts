import { Prisma } from "../src/generated/prisma/client";
import { OrderHistoryEventType, OrderStatus, PaymentStatus, Role } from "../src/generated/prisma/enums";
import { customerDetailInclude, CustomersRepository, type CustomerDetailRecord } from "../src/modules/customers/customers.repository";
import { CustomersService } from "../src/modules/customers/customers.service";

describe("CustomersService anonymization", () => {
  it("sanitizes the customer and every order in one transaction with an audit entry", async () => {
    const transaction = createTransaction();
    const harness = createHarness(customer("customer-1"), transaction);
    transaction.customer.update.mockResolvedValue(customer("customer-1", { isAnonymized: true, address: null }));
    transaction.order.findMany.mockResolvedValue([{ id: "order-1" }, { id: "order-2" }]);

    const result = await harness.service.anonymizeCustomer("customer-1", { id: "admin-1", role: Role.ADMIN });

    expect(result).toMatchObject({ email: "", fullName: "Cliente eliminado (customer-1)", id: "customer-1", isAnonymized: true });
    expect(result).not.toHaveProperty("address");
    expect(transaction.customer.update).toHaveBeenCalledWith({
      data: { dniOrCuil: null, email: "", fullName: "Cliente eliminado (customer-1)", isAnonymized: true, notes: null, phone: null, userId: null },
      include: customerDetailInclude,
      where: { id: "customer-1" },
    });
    expect(transaction.customerAddress.deleteMany).toHaveBeenCalledWith({ where: { customerId: "customer-1" } });
    expect(transaction.order.update).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({
        customerDni: null,
        customerEmail: "",
        customerFirstName: "Cliente",
        customerLastName: "eliminado",
        customerPhone: null,
        customerSnapshot: { email: "", fullName: "Cliente eliminado (customer-1)", id: "customer-1", isAnonymized: true },
        shippingAddressSnapshot: Prisma.JsonNull,
      }),
      where: { id: "order-1" },
    }));
    expect(transaction.orderHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "admin-1",
        actorRole: Role.ADMIN,
        description: "Customer personal data anonymized",
        metadata: { description: "Customer personal data anonymized", type: "SALE_UPDATED" },
        orderId: "order-1",
        title: "Customer data anonymized",
        type: OrderHistoryEventType.NOTE_ADDED,
      }),
    });
    expect(transaction.orderHistory.create).toHaveBeenCalledTimes(2);
  });

  it("does not commit a partial anonymization when a required write fails", async () => {
    const transaction = createTransaction();
    const harness = createHarness(customer("customer-1"), transaction);
    const failure = new Error("order update failed");
    let committed = false;
    harness.transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
      try {
        const result = await callback(transaction as unknown as Prisma.TransactionClient);
        committed = true;
        return result;
      } catch (error) {
        throw error;
      }
    });
    transaction.order.findMany.mockResolvedValue([{ id: "order-1" }]);
    transaction.order.update.mockRejectedValue(failure);

    await expect(harness.service.anonymizeCustomer("customer-1", { id: "admin-1" })).rejects.toBe(failure);

    expect(committed).toBe(false);
    expect(transaction.orderHistory.create).not.toHaveBeenCalled();
  });

  it("returns an existing anonymized projection without opening a transaction", async () => {
    const transaction = createTransaction();
    const harness = createHarness(customer("customer-1", { isAnonymized: true }), transaction);

    await expect(harness.service.anonymizeCustomer("customer-1")).resolves.toMatchObject({
      email: "",
      fullName: "Cliente eliminado (customer-1)",
      isAnonymized: true,
    });

    expect(harness.transaction).not.toHaveBeenCalled();
    expect(transaction.customer.update).not.toHaveBeenCalled();
    expect(transaction.orderHistory.create).not.toHaveBeenCalled();
  });
});

function createHarness(customerRecord: CustomerDetailRecord, transaction: ReturnType<typeof createTransaction>) {
  const findById = jest.fn().mockResolvedValue(customerRecord);
  const transactionRunner = jest.fn(async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => callback(transaction as unknown as Prisma.TransactionClient));
  const repository = { findById, transaction: transactionRunner } as unknown as CustomersRepository;
  return { service: new CustomersService(repository), transaction: transactionRunner };
}

function createTransaction() {
  return {
    customer: { update: jest.fn() },
    customerAddress: { deleteMany: jest.fn() },
    order: { findMany: jest.fn(), update: jest.fn() },
    orderHistory: { create: jest.fn() },
  };
}

function customer(id: string, overrides: Partial<CustomerDetailRecord> = {}): CustomerDetailRecord {
  return {
    address: {
      city: "Buenos Aires",
      country: "Argentina",
      floorOrApartment: null,
      id: "address-1",
      neighborhood: "Palermo",
      number: "2845",
      postalCode: "1425",
      provinceOrState: "Buenos Aires",
      street: "Av. Santa Fe",
      customerId: id,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    dniOrCuil: "30123456",
    email: "cami@example.com",
    firstInteractionDate: new Date("2026-01-01T00:00:00.000Z"),
    fullName: "Camila Pérez",
    id,
    isAnonymized: false,
    notes: "Private note",
    orders: [],
    phone: "+54 11 4567-8901",
    tags: ["vip"],
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    user: null,
    ...overrides,
  } as unknown as CustomerDetailRecord;
}
