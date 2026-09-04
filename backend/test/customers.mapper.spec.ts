import {
  toCustomerDetailResponseDto,
  toCustomerResponseDto,
  type CustomerRecordWithMetrics,
} from "../src/modules/customers/customers.mapper";

describe("customer mapper", () => {
  it("maps a customer, address, tags, and calculated detail metrics", () => {
    const customer = makeCustomer({
      address: {
        city: "Buenos Aires",
        country: "Argentina",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        customerId: "customer-1",
        floorOrApartment: "3 B",
        id: "address-1",
        neighborhood: null,
        number: "2845",
        postalCode: "1425",
        provinceOrState: "Buenos Aires",
        street: "Av. Santa Fe",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      tags: ["vip", "online"],
    });

    expect(toCustomerResponseDto(customer)).toEqual(expect.objectContaining({
      address: expect.objectContaining({ city: "Buenos Aires", floorOrApartment: "3 B" }),
      email: "camila@example.com",
      fullName: "Camila Pérez",
      tags: ["vip", "online"],
    }));

    expect(toCustomerDetailResponseDto(customer, {
      lastOrder: { createdAt: new Date("2026-04-05T10:00:00.000Z"), id: "order-2", number: "EN-002", total: decimal("1250.50") },
      ordersCount: 2,
      totalSpent: decimal("2450.50"),
    })).toEqual(expect.objectContaining({
      summary: { lastOrder: { date: "2026-04-05T10:00:00.000Z", id: "order-2", number: "EN-002", total: 1250.5 }, ordersCount: 2, totalSpent: 2450.5 },
    }));
  });

  it("omits nullable profile and address fields and defaults empty metrics", () => {
    const customer = makeCustomer({ address: null, dniOrCuil: null, email: null, notes: null, phone: null, tags: [] });
    const mapped = toCustomerDetailResponseDto(customer);

    expect(mapped).toEqual(expect.objectContaining({ email: "", fullName: "Camila Pérez", tags: [] }));
    expect(mapped.address).toBeUndefined();
    expect(mapped.dniOrCuil).toBeUndefined();
    expect(mapped.notes).toBeUndefined();
    expect(mapped.phone).toBeUndefined();
    expect(mapped.summary).toEqual({ ordersCount: 0, totalSpent: 0 });
  });

  it("masks every customer PII field after anonymization while retaining metrics", () => {
    const customer = makeCustomer({
      address: { city: "Buenos Aires" } as CustomerRecordWithMetrics["address"],
      isAnonymized: true,
      metrics: { ordersCount: 1, totalSpent: 500 },
      notes: "Private note",
      phone: "+54 11 5555-5555",
    });

    const mapped = toCustomerDetailResponseDto(customer);

    expect(mapped).toEqual(expect.objectContaining({
      email: "",
      fullName: "Cliente eliminado (customer-1)",
      id: "customer-1",
      isAnonymized: true,
      summary: { ordersCount: 1, totalSpent: 500 },
    }));
    expect(mapped.address).toBeUndefined();
    expect(mapped.dniOrCuil).toBeUndefined();
    expect(mapped.notes).toBeUndefined();
    expect(mapped.phone).toBeUndefined();
  });
});

function makeCustomer(overrides: Partial<CustomerRecordWithMetrics> = {}): CustomerRecordWithMetrics {
  return {
    address: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    dniOrCuil: "30123456",
    email: "camila@example.com",
    firstInteractionDate: new Date("2026-01-01T00:00:00.000Z"),
    fullName: "Camila Pérez",
    id: "customer-1",
    isAnonymized: false,
    notes: "Prefers afternoons.",
    phone: "+54 11 4567-8901",
    tags: ["vip"],
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    ...overrides,
  } as CustomerRecordWithMetrics;
}

function decimal(value: string) {
  return { toString: () => value };
}
