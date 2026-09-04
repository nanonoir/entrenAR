import { PrismaService } from "../src/common/prisma/prisma.service";
import { Prisma } from "../src/generated/prisma/client";
import { OrderStatus, PaymentStatus } from "../src/generated/prisma/enums";
import {
  customerDetailInclude,
  customerListInclude,
  customerOrderBy,
  customerWhere,
  CustomersRepository,
  type CustomerDetailRecord,
  type CustomerListRecord,
  type CustomerRepositoryListQuery,
} from "../src/modules/customers/customers.repository";

describe("CustomersRepository", () => {
  it("builds case-insensitive search, relation, account, and tag filters", async () => {
    const harness = createHarness();
    harness.customer.findMany.mockResolvedValue([]);
    harness.customer.count.mockResolvedValue(0);

    await harness.repository.findMany({
      ...baseQuery(),
      city: " Buenos Aires ",
      country: " Argentina ",
      hasOrders: true,
      isAnonymized: false,
      provinceOrState: " Buenos Aires ",
      search: " Camila ",
      sortBy: "name",
      sortOrder: "asc",
      tags: { hasEvery: [" vip ", "online"] },
    });

    expect(harness.customer.findMany).toHaveBeenCalledWith({
      include: customerListInclude,
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
      skip: 0,
      take: 20,
      where: {
        OR: [
          { fullName: { contains: "Camila", mode: "insensitive" } },
          { email: { contains: "Camila", mode: "insensitive" } },
          { dniOrCuil: { contains: "Camila", mode: "insensitive" } },
        ],
        address: {
          is: {
            city: { equals: "Buenos Aires", mode: "insensitive" },
            country: { equals: "Argentina", mode: "insensitive" },
            provinceOrState: { equals: "Buenos Aires", mode: "insensitive" },
          },
        },
        isAnonymized: false,
        orders: { some: {} },
        tags: { hasEvery: ["vip", "online"] },
      },
    });
    expect(harness.customer.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.any(Object) }));
    expect(harness.customer.create).not.toHaveBeenCalled();
    expect(harness.customer.update).not.toHaveBeenCalled();
  });

  it.each([
    [true, { some: {} }],
    [false, { none: {} }],
  ])("supports the hasOrders=%s relation filter and hasSome tags", async (hasOrders, orderFilter) => {
    const harness = createHarness();
    harness.customer.findMany.mockResolvedValue([]);
    harness.customer.count.mockResolvedValue(0);

    await harness.repository.findMany({ ...baseQuery(), hasOrders, tags: ["vip", "vip"] });

    expect(customerWhere({ ...baseQuery(), hasOrders, tags: ["vip", "vip"] })).toMatchObject({
      orders: orderFilter,
      tags: { hasSome: ["vip"] },
    });
  });

  it("applies deterministic database pagination and a stable ID tie-breaker", async () => {
    const harness = createHarness();
    const records = [record("customer-3"), record("customer-4")];
    harness.customer.findMany.mockResolvedValue(records);
    harness.customer.count.mockResolvedValue(5);

    const result = await harness.repository.findMany({ ...baseQuery(), page: 2, limit: 2, sortBy: "createdAt" });

    expect(result).toEqual({ items: records, total: 5 });
    expect(harness.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: 2,
      take: 2,
    }));
  });

  it("sorts metric pages in memory using only paid, non-cancelled orders", async () => {
    const harness = createHarness();
    const records = [
      record("customer-low", [order("low-paid", 100)]),
      record("customer-rich", [order("rich-paid", 500), order("rich-unpaid", 900, PaymentStatus.PENDING)]),
      record("customer-cancelled", [order("cancelled", 200, PaymentStatus.PAID, OrderStatus.CANCELLED)]),
    ];
    harness.customer.findMany.mockResolvedValue(records);
    harness.customer.count.mockResolvedValue(records.length);

    const result = await harness.repository.findMany({ ...baseQuery(), limit: 2, sortBy: "totalSpent" });

    expect(result.items.map(({ id }) => id)).toEqual(["customer-rich", "customer-low"]);
    expect(result.total).toBe(3);
    expect(harness.customer.findMany).toHaveBeenCalledWith(expect.not.objectContaining({ skip: 0, take: 2 }));
    expect(customerOrderBy({ sortBy: "ordersCount", sortOrder: "asc" })).toEqual([{ id: "asc" }]);
  });

  it("gets a customer with address, safe user data, payment status, and metric item details", async () => {
    const harness = createHarness();
    const customer = record("customer-1") as unknown as CustomerDetailRecord;
    harness.customer.findUnique.mockResolvedValue(customer);

    await expect(harness.repository.findById("customer-1")).resolves.toBe(customer);
    expect(harness.customer.findUnique).toHaveBeenCalledWith({ include: customerDetailInclude, where: { id: "customer-1" } });
    expect(customerDetailInclude.address).toBe(true);
    expect(customerDetailInclude.orders.select.items).toBeDefined();
    expect(customerDetailInclude.orders.select.payment).toEqual({ select: { status: true } });
    expect(customerDetailInclude.user).toEqual(expect.objectContaining({ select: expect.objectContaining({ id: true, email: true }) }));
  });

  it("creates a customer and translates an optional address into address.create", async () => {
    const harness = createHarness();
    const address = makeAddress();
    const customer = record("customer-1");
    harness.customer.create.mockResolvedValue(customer);

    await expect(harness.repository.create({ email: "camila@example.com", fullName: "Camila Pérez", tags: ["vip"], address })).resolves.toBe(customer);

    expect(harness.customer.create).toHaveBeenCalledWith({
      data: { address: { create: address }, email: "camila@example.com", fullName: "Camila Pérez", tags: ["vip"] },
      include: customerListInclude,
    });
  });

  it("updates scalar fields and replaces or deletes the one-to-one address", async () => {
    const harness = createHarness();
    const address = makeAddress();
    harness.customer.update.mockResolvedValue(record("customer-1"));

    await harness.repository.update("customer-1", { fullName: "Updated Name", address });
    expect(harness.customer.update).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: { address: { upsert: { create: address, update: address } }, fullName: "Updated Name" },
      where: { id: "customer-1" },
    }));

    await harness.repository.update("customer-1", { address: null });
    expect(harness.customer.update).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: { address: { delete: true } },
      where: { id: "customer-1" },
    }));
  });

  it("updates notes with an explicit timestamp and supports transaction clients", async () => {
    const harness = createHarness();
    const transaction = createTransaction();
    harness.customer.update.mockResolvedValue(record("customer-1"));
    transaction.customer.update.mockResolvedValue(record("customer-1"));

    await harness.repository.updateNotes(transaction as unknown as Prisma.TransactionClient, "customer-1", "Call next week.");

    expect(transaction.customer.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { notes: "Call next week.", updatedAt: expect.any(Date) },
      where: { id: "customer-1" },
    }));
    expect(harness.customer.update).not.toHaveBeenCalled();
  });

  it("checks normalized active email availability and excludes the subject customer", async () => {
    const harness = createHarness();
    harness.customer.findFirst.mockResolvedValue(null);

    await expect(harness.repository.findByActiveEmail(" CAMILA@Example.com ", "customer-2")).resolves.toBeNull();
    expect(harness.customer.findFirst).toHaveBeenCalledWith({
      where: { email: "camila@example.com", id: { not: "customer-2" }, isAnonymized: false },
    });
    expect(harness.customer.create).not.toHaveBeenCalled();
    expect(harness.customer.update).not.toHaveBeenCalled();
  });

  it("propagates Prisma errors without attempting a second write", async () => {
    const harness = createHarness();
    const error = new Error("database unavailable");
    harness.customer.create.mockRejectedValue(error);

    await expect(harness.repository.create({ fullName: "Customer Name" })).rejects.toBe(error);
    expect(harness.customer.update).not.toHaveBeenCalled();
    expect(harness.customer.delete).not.toHaveBeenCalled();
  });

  it("delegates transaction callbacks to Prisma", async () => {
    const harness = createHarness();
    const transaction = createTransaction();
    harness.prisma.$transaction.mockImplementation(async (callback: (client: Prisma.TransactionClient) => Promise<string>) => callback(transaction as unknown as Prisma.TransactionClient));

    const expectedTransaction = transaction as unknown as Prisma.TransactionClient;
    await expect(harness.repository.transaction(async (client) => client === expectedTransaction ? "committed" : "wrong")).resolves.toBe("committed");
  });
});

function baseQuery(): CustomerRepositoryListQuery {
  return { limit: 20, page: 1, sortBy: "createdAt", sortOrder: "desc" };
}

function createHarness() {
  const customer = {
    count: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  const prisma = { $transaction: jest.fn(), customer };
  return { customer, prisma, repository: new CustomersRepository(prisma as unknown as PrismaService) };
}

function createTransaction(): { customer: { create: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock } } {
  return { customer: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() } };
}

function record(id: string, orders: unknown[] = []): CustomerListRecord {
  return { id, orders } as unknown as CustomerListRecord;
}

function order(id: string, total: number, paymentStatus: PaymentStatus = PaymentStatus.PAID, status: OrderStatus = OrderStatus.CONFIRMED) {
  return { createdAt: new Date(), id, number: id, payment: { status: paymentStatus }, status, total: { toString: () => String(total) } };
}

function makeAddress() {
  return {
    city: "Buenos Aires",
    country: "Argentina",
    number: "2845",
    postalCode: "1425",
    provinceOrState: "Buenos Aires",
    street: "Av. Santa Fe",
  };
}
