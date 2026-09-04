import { SupplierStatus } from "../../generated/prisma/enums";
import {
  createSupplierSchema,
  supplierFilterQuerySchema,
  supplierStatusSchema,
  updateSupplierSchema,
} from "./suppliers.schemas";

describe("supplier schemas", () => {
  it("normalizes supplier codes and optional text fields", () => {
    expect(createSupplierSchema.parse({
      code: "  supplier-1 ",
      contactName: "  Ada Lovelace  ",
      email: " supplier@example.com ",
      name: "  Supplier One ",
      notes: "  Preferred supplier  ",
      phone: "  +54 11 5555-5555 ",
      status: "inactive",
    })).toEqual({
      code: "SUPPLIER-1",
      contactName: "Ada Lovelace",
      email: "supplier@example.com",
      name: "Supplier One",
      notes: "Preferred supplier",
      phone: "+54 11 5555-5555",
      status: SupplierStatus.INACTIVE,
    });

    expect(updateSupplierSchema.parse({ id: "supplier-1", code: " supplier-2 " })).toEqual({
      code: "SUPPLIER-2",
      id: "supplier-1",
    });
  });

  it("coerces filters and applies deterministic defaults", () => {
    expect(supplierFilterQuerySchema.parse({ status: "active", limit: "5", page: "2" })).toEqual({
      limit: 5,
      page: 2,
      sortBy: "name",
      sortOrder: "asc",
      status: SupplierStatus.ACTIVE,
    });
    expect(supplierStatusSchema.parse({ status: "inactive" })).toEqual({ status: SupplierStatus.INACTIVE });
  });

  it.each([
    { code: "", name: "Supplier" },
    { code: "SUP-1", name: "" },
    { code: "SUP-1", email: "invalid", name: "Supplier" },
    { code: "SUP-1", name: "Supplier", status: "unknown" },
    { code: "SUP-1", name: "Supplier", unexpected: true },
  ])("rejects malformed create input: %o", (input) => {
    expect(createSupplierSchema.safeParse(input).success).toBe(false);
  });

  it("rejects empty updates and invalid filter transport", () => {
    expect(updateSupplierSchema.safeParse({}).success).toBe(false);
    expect(updateSupplierSchema.safeParse({ id: "supplier-1" }).success).toBe(false);
    expect(supplierFilterQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
    expect(supplierFilterQuerySchema.safeParse({ status: "unknown" }).success).toBe(false);
    expect(supplierStatusSchema.safeParse({ status: "ACTIVE", extra: true }).success).toBe(false);
  });
});
