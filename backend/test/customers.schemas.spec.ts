import {
  createCustomerSchema,
  customerAddressSchema,
  customerIdParamSchema,
  customerListQuerySchema,
  updateCustomerNotesSchema,
  updateCustomerSchema,
} from "../src/modules/customers/customers.schemas";

describe("customer schemas", () => {
  it("parses a valid list query and normalizes filters", () => {
    expect(customerListQuerySchema.parse({
      city: " Buenos Aires ",
      hasOrders: "true",
      isAnonymized: "false",
      page: "2",
      search: "  camila ",
      sortBy: "fullName",
      sortOrder: "asc",
    })).toMatchObject({
      city: "Buenos Aires",
      hasOrders: true,
      isAnonymized: false,
      limit: 20,
      page: 2,
      search: "camila",
      sortBy: "fullName",
      sortOrder: "asc",
    });
  });

  it.each([
    { page: "0" },
    { limit: "101" },
    { hasOrders: "yes" },
    { sortBy: "unsupported" },
    { sortOrder: "ascending" },
  ])("rejects invalid list query %#", (query) => {
    expect(() => customerListQuerySchema.parse(query)).toThrow();
  });

  it("accepts Prisma cuid-shaped and legacy opaque customer IDs", () => {
    expect(customerIdParamSchema.parse({ id: "cmj9p2f8a0000qwer123456789" })).toEqual({ id: "cmj9p2f8a0000qwer123456789" });
    expect(customerIdParamSchema.parse({ id: "cus_001" })).toEqual({ id: "cus_001" });
    expect(() => customerIdParamSchema.parse({ id: " " })).toThrow();
  });

  it("normalizes a valid customer profile", () => {
    const customer = createCustomerSchema.parse({
      city: "Buenos Aires",
      country: "Argentina",
      dniOrCuil: " 20-12345678-9 ",
      email: "  CAMILA@example.com ",
      fullName: " Camila Pérez ",
      number: "2845",
      notes: " Prefers afternoon deliveries. ",
      phone: " +54 11 4567-8901 ",
      postalCode: "1425",
      provinceOrState: "Buenos Aires",
      street: "Av. Santa Fe",
      tags: [" vip ", "online"],
    });

    expect(customer).toMatchObject({
      city: "Buenos Aires",
      dniOrCuil: "20-12345678-9",
      email: "camila@example.com",
      fullName: "Camila Pérez",
      notes: "Prefers afternoon deliveries.",
      phone: "+54 11 4567-8901",
      tags: ["vip", "online"],
    });
  });

  it("rejects partial addresses in create, update, and standalone address validation", () => {
    const partialAddress = { city: "Buenos Aires", street: "Av. Santa Fe" };
    expect(() => createCustomerSchema.parse({ email: "customer@example.com", fullName: "Customer Name", ...partialAddress })).toThrow();
    expect(() => updateCustomerSchema.parse(partialAddress)).toThrow();
    expect(() => customerAddressSchema.parse(partialAddress)).toThrow();
  });

  it("accepts an address with optional fields omitted", () => {
    expect(customerAddressSchema.parse({
      city: "Córdoba",
      country: "Argentina",
      number: "450",
      postalCode: "5000",
      provinceOrState: "Córdoba",
      street: "Colón",
    })).toMatchObject({ city: "Córdoba", number: "450", postalCode: "5000", street: "Colón" });
  });

  it("supports partial profile updates and explicit note clearing", () => {
    expect(updateCustomerSchema.parse({ phone: " +54 11 5555-5555 " })).toEqual({ phone: "+54 11 5555-5555" });
    expect(updateCustomerNotesSchema.parse({ notes: "   " })).toEqual({ notes: "" });
    expect(() => updateCustomerNotesSchema.parse({ notes: 42 })).toThrow();
  });
});
