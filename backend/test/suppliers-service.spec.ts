import { SupplierStatus } from "../src/generated/prisma/enums";
import { SuppliersRepository } from "../src/modules/suppliers/suppliers.repository";
import { SuppliersService } from "../src/modules/suppliers/suppliers.service";
import { createSupplierSchema } from "../src/modules/suppliers/suppliers.schemas";

describe("SuppliersService", () => {
  it("creates active suppliers and rejects duplicate codes", async () => {
    const h = harness();
    const input = createSupplierSchema.parse({ code: "sup-1", name: "Supplier One" });
    const record = supplierRecord({ code: "SUP-1", status: SupplierStatus.ACTIVE });
    h.repository.findByCodeInTransaction.mockResolvedValueOnce(null).mockResolvedValueOnce(record);
    h.repository.create.mockResolvedValue(record);
    await expect(h.service.create(input)).resolves.toMatchObject({ code: "SUP-1", status: SupplierStatus.ACTIVE });
    await expect(h.service.create(input)).rejects.toMatchObject({ status: 409 });
    expect(h.repository.create).toHaveBeenCalledTimes(1);
  });

  it("updates fields, toggles status, and keeps a duplicate update atomic", async () => {
    const h = harness();
    const current = supplierRecord({ id: "supplier-1", code: "SUP-1" });
    h.repository.findByIdInTransaction.mockResolvedValue(current);
    h.repository.findByCodeInTransaction.mockResolvedValue(supplierRecord({ id: "supplier-2", code: "SUP-2" }));
    await expect(h.service.update("supplier-1", { code: "SUP-2" })).rejects.toMatchObject({ status: 409 });
    expect(h.repository.update).not.toHaveBeenCalled();
    h.repository.findById.mockResolvedValue(current);
    h.repository.update.mockResolvedValue(supplierRecord({ ...current, status: SupplierStatus.INACTIVE }));
    await expect(h.service.toggleStatus("supplier-1")).resolves.toMatchObject({ status: SupplierStatus.INACTIVE });
  });
});

function harness() {
  const repository = { create: jest.fn(), findByCodeInTransaction: jest.fn(), findById: jest.fn(), findByIdInTransaction: jest.fn(), list: jest.fn(), softDelete: jest.fn(), update: jest.fn(), transaction: jest.fn((callback: (transaction: object) => Promise<unknown>) => callback({})) };
  return { repository, service: new SuppliersService(repository as unknown as SuppliersRepository) };
}

function supplierRecord(overrides: Partial<{ id: string; code: string; status: SupplierStatus }> = {}) {
  return { id: "supplier-1", name: "Supplier", code: "SUP-1", contactName: null, email: null, phone: null, notes: null, status: SupplierStatus.ACTIVE, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"), ...overrides };
}
