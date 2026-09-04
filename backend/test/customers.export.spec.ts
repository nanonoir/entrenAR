import { ERROR_CODE } from "../src/common/errors/api-error.response";
import { OrderStatus, PaymentStatus } from "../src/generated/prisma/enums";
import { CustomersRepository, type CustomerDetailRecord, type CustomerListRecord } from "../src/modules/customers/customers.repository";
import { CustomersService } from "../src/modules/customers/customers.service";

describe("CustomersService CSV exports", () => {
  it("starts list exports with a UTF-8 BOM and uses semicolon separators", async () => {
    const harness = createHarness();
    harness.findMany.mockResolvedValue({ items: [customer("customer-1")], total: 1 });

    const csv = await harness.service.exportCustomersListCsv({ limit: 20 });

    expect(csv.startsWith("\uFEFFID;Nombre y apellido;E-mail")).toBe(true);
    expect(csv.split("\n")[0]).toContain(";Teléfono;DNI/CUIL;");
    expect(harness.findMany).toHaveBeenCalledWith(expect.objectContaining({ limit: 100, page: 1 }));
  });

  it("quotes special values and prefixes every formula character", async () => {
    const harness = createHarness();
    harness.findMany.mockResolvedValue({
      items: [
        customer("equal", { fullName: "=SUM(A1:A2)" }),
        customer("plus", { fullName: "+CMD()" }),
        customer("minus", { fullName: "-CMD()" }),
        customer("at", { fullName: "@CMD()" }),
        customer("quoted", { fullName: '=CMD();"quoted"\nnext' }),
      ],
      total: 5,
    });

    const csv = await harness.service.exportCustomersListCsv({});

    expect(csv).toContain("'=SUM(A1:A2)");
    expect(csv).toContain("'+CMD()");
    expect(csv).toContain("'-CMD()");
    expect(csv).toContain("'@CMD()");
    expect(csv).toContain(`"'=CMD();""quoted""\nnext"`);
  });

  it("masks PII but preserves anonymized customer metrics in list exports", async () => {
    const harness = createHarness();
    harness.findMany.mockResolvedValue({
      items: [customer("customer-anon", {
        email: "private@example.com",
        fullName: "Original Name",
        isAnonymized: true,
        orders: [order("order-1", 1250) as unknown as CustomerListRecord["orders"][number]],
        phone: "+54 11 4567-8901",
        dniOrCuil: "30123456",
      })],
      total: 1,
    });

    const csv = await harness.service.exportCustomersListCsv({});

    expect(csv).toContain("Cliente eliminado (customer-anon)");
    expect(csv).toContain(";1250;1;");
    expect(csv).not.toContain("private@example.com");
    expect(csv).not.toContain("Original Name");
    expect(csv).not.toContain("30123456");
  });

  it("exports active customer details with address and order history", async () => {
    const harness = createHarness();
    harness.findById.mockResolvedValue(customer("customer-1", { orders: [order("order-1", 1250) as unknown as CustomerListRecord["orders"][number]] }) as unknown as CustomerDetailRecord);

    const csv = await harness.service.exportCustomerDetailCsv("customer-1");

    expect(csv).toContain("\uFEFFCampo;Valor");
    expect(csv).toContain("Nombre y apellido;Camila Pérez");
    expect(csv).toContain("Dirección de envío;Av. Santa Fe 2845 · CP 1425 · Palermo, Buenos Aires, Buenos Aires, Argentina");
    expect(csv).toContain("Historial de ventas;EN-order-1");
  });

  it("rejects anonymized detail exports with a controlled privacy error", async () => {
    const harness = createHarness();
    harness.findById.mockResolvedValue(customer("customer-anon", { isAnonymized: true }) as unknown as CustomerDetailRecord);

    await expect(harness.service.exportCustomerDetailCsv("customer-anon")).rejects.toMatchObject({
      response: { code: ERROR_CODE.CUSTOMER_ANONYMIZED, message: "No se puede exportar el detalle de un cliente anonimizado.", ok: false },
      status: 400,
    });
  });
});

function createHarness() {
  const findMany = jest.fn();
  const findById = jest.fn();
  const repository = { findById, findMany } as unknown as CustomersRepository;
  return { findById, findMany, service: new CustomersService(repository) };
}

function customer(id: string, overrides: Partial<CustomerListRecord> = {}): CustomerListRecord {
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
    ...overrides,
  } as unknown as CustomerListRecord;
}

function order(id: string, total: number) {
  return {
    createdAt: new Date("2026-04-01T10:00:00.000Z"),
    id,
    number: `EN-${id}`,
    payment: { status: PaymentStatus.PAID },
    status: OrderStatus.CONFIRMED,
    total,
  };
}
