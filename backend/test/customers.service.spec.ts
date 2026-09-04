import { ERROR_CODE } from "../src/common/errors/api-error.response";
import { OrderStatus, PaymentStatus } from "../src/generated/prisma/enums";
import {
  CustomersService,
} from "../src/modules/customers/customers.service";
import { CustomersRepository, type CustomerListRecord } from "../src/modules/customers/customers.repository";
import type { CustomerRecordWithMetrics, CustomerOrderMetricRecord } from "../src/modules/customers/customers.mapper";

describe("CustomersService", () => {
  it("validates and maps paginated customer lists", async () => {
    const harness = createHarness();
    harness.findMany.mockResolvedValue({ items: [customer("customer-1"), customer("customer-2")], total: 5 });

    const result = await harness.service.listCustomers({ limit: "2", page: "2", sortBy: "fullName", sortOrder: "asc" });

    expect(result).toEqual(expect.objectContaining({ limit: 2, page: 2, total: 5, totalPages: 3 }));
    expect(result.items.map(({ id }) => id)).toEqual(["customer-1", "customer-2"]);
    expect(harness.findMany).toHaveBeenCalledWith({ limit: 2, page: 2, sortBy: "fullName", sortOrder: "asc" });
  });

  it("rejects invalid list queries before accessing the repository", async () => {
    const harness = createHarness();

    await expect(harness.service.listCustomers({ limit: 0 })).rejects.toMatchObject({ status: 400 });
    expect(harness.findMany).not.toHaveBeenCalled();
  });

  it("returns a controlled not-found error for an unknown customer", async () => {
    const harness = createHarness();
    harness.findById.mockResolvedValue(null);

    await expect(harness.service.getCustomer("customer-404")).rejects.toMatchObject({
      response: { code: ERROR_CODE.CUSTOMER_NOT_FOUND, ok: false },
      status: 404,
    });
  });

  it("creates a customer after checking active email uniqueness and supports an address", async () => {
    const harness = createHarness();
    harness.findByActiveEmail.mockResolvedValue(null);
    harness.create.mockResolvedValue(customer("customer-1"));

    await expect(harness.service.createCustomer({
      city: " Buenos Aires ",
      country: "Argentina",
      email: " CAMILA@example.com ",
      fullName: " Camila Pérez ",
      number: "2845",
      postalCode: "1425",
      provinceOrState: "Buenos Aires",
      street: "Av. Santa Fe",
      tags: ["vip"],
    })).resolves.toEqual(expect.objectContaining({ id: "customer-1" }));

    expect(harness.findByActiveEmail).toHaveBeenCalledWith("camila@example.com", undefined);
    expect(harness.create).toHaveBeenCalledWith(expect.objectContaining({
      address: {
        city: "Buenos Aires",
        country: "Argentina",
        number: "2845",
        postalCode: "1425",
        provinceOrState: "Buenos Aires",
        street: "Av. Santa Fe",
      },
      email: "camila@example.com",
      fullName: "Camila Pérez",
    }));
  });

  it("rejects a create when another active customer owns the email", async () => {
    const harness = createHarness();
    harness.findByActiveEmail.mockResolvedValue({ id: "customer-2" });

    await expect(harness.service.createCustomer(validCustomerInput())).rejects.toMatchObject({
      response: { code: ERROR_CODE.EMAIL_EXISTS, message: "Ya existe un cliente activo con ese e-mail.", ok: false },
      status: 409,
    });
    expect(harness.create).not.toHaveBeenCalled();
  });

  it("allows an update with the subject customer's email", async () => {
    const harness = createHarness();
    const existing = customer("customer-1");
    harness.findById.mockResolvedValue(existing);
    harness.findByActiveEmail.mockResolvedValue(null);
    harness.update.mockResolvedValue(existing);

    await harness.service.updateCustomer("customer-1", { email: " CAMILA@example.com " });

    expect(harness.findByActiveEmail).toHaveBeenCalledWith("camila@example.com", "customer-1");
    expect(harness.update).toHaveBeenCalledWith("customer-1", { email: "camila@example.com" });
  });

  it("rejects an update when another active customer owns the new email", async () => {
    const harness = createHarness();
    harness.findById.mockResolvedValue(customer("customer-1"));
    harness.findByActiveEmail.mockResolvedValue({ id: "customer-2" });

    await expect(harness.service.updateCustomer("customer-1", { email: "other@example.com" })).rejects.toMatchObject({
      response: { code: ERROR_CODE.EMAIL_EXISTS, ok: false },
      status: 409,
    });
    expect(harness.update).not.toHaveBeenCalled();
  });

  it("blocks profile and notes edits for anonymized customers", async () => {
    const harness = createHarness();
    harness.findById.mockResolvedValue(customer("customer-1", { isAnonymized: true }));

    await expect(harness.service.updateCustomer("customer-1", { fullName: "New Name" })).rejects.toMatchObject({
      response: { code: ERROR_CODE.CUSTOMER_ANONYMIZED, ok: false },
      status: 400,
    });
    await expect(harness.service.updateCustomerNotes("customer-1", { notes: "New note" })).rejects.toMatchObject({
      response: { code: ERROR_CODE.CUSTOMER_ANONYMIZED, ok: false },
      status: 400,
    });
    expect(harness.update).not.toHaveBeenCalled();
    expect(harness.updateNotes).not.toHaveBeenCalled();
  });

  it("calculates sales metrics from paid, non-cancelled orders only", async () => {
    const harness = createHarness();
    harness.findById.mockResolvedValue(customer("customer-1", {
      orders: [
        order("paid", 1250, PaymentStatus.PAID, OrderStatus.CONFIRMED, "2026-04-01T10:00:00.000Z"),
        order("unpaid", 900, PaymentStatus.PENDING, OrderStatus.CONFIRMED, "2026-05-01T10:00:00.000Z"),
        order("cancelled", 800, PaymentStatus.PAID, OrderStatus.CANCELLED, "2026-06-01T10:00:00.000Z"),
      ],
    }));

    const result = await harness.service.getCustomer("customer-1");

    expect(result.summary).toEqual({
      lastOrder: { date: "2026-04-01T10:00:00.000Z", id: "paid", number: "EN-paid", total: 1250 },
      ordersCount: 1,
      totalSpent: 1250,
    });
  });

  it("updates trimmed notes and validates the notes payload", async () => {
    const harness = createHarness();
    const existing = customer("customer-1");
    harness.findById.mockResolvedValue(existing);
    harness.updateNotes.mockResolvedValue(customer("customer-1", { notes: "Follow up" }));

    await expect(harness.service.updateCustomerNotes("customer-1", { notes: " Follow up " })).resolves.toEqual(expect.objectContaining({
      notes: "Follow up",
    }));
    expect(harness.updateNotes).toHaveBeenCalledWith("customer-1", "Follow up");

    const invalidHarness = createHarness();
    await expect(invalidHarness.service.updateCustomerNotes("customer-1", { notes: 42 })).rejects.toMatchObject({ status: 400 });
    expect(invalidHarness.findById).not.toHaveBeenCalled();
  });
});

function createHarness() {
  const findMany = jest.fn();
  const findById = jest.fn();
  const create = jest.fn();
  const update = jest.fn();
  const updateNotes = jest.fn();
  const findByActiveEmail = jest.fn();
  const repository = { create, findByActiveEmail, findById, findMany, update, updateNotes } as unknown as CustomersRepository;
  return { create, findByActiveEmail, findById, findMany, service: new CustomersService(repository), update, updateNotes };
}

function validCustomerInput() {
  return { email: "customer@example.com", fullName: "Customer Name", tags: [] };
}

function customer(id: string, overrides: Partial<CustomerRecordWithMetrics> = {}): CustomerListRecord {
  return {
    address: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    dniOrCuil: "30123456",
    email: "camila@example.com",
    firstInteractionDate: new Date("2026-01-01T00:00:00.000Z"),
    fullName: "Camila Pérez",
    id,
    isAnonymized: false,
    notes: "Prefers afternoons.",
    orders: [],
    phone: "+54 11 4567-8901",
    tags: ["vip"],
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    ...overrides,
  } as unknown as CustomerListRecord;
}

function order(id: string, total: number, paymentStatus: PaymentStatus, status: OrderStatus, createdAt: string): CustomerOrderMetricRecord {
  return { createdAt: new Date(createdAt), id, number: `EN-${id}`, payment: { status: paymentStatus }, status, total };
}
