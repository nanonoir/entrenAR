import { PurchaseOrderStatus, SupplierStatus } from "../src/generated/prisma/enums";
import { InventoryRepository } from "../src/modules/inventory/inventory.repository";
import { PurchaseOrdersRepository } from "../src/modules/purchase-orders/purchase-orders.repository";
import { PurchaseOrdersService } from "../src/modules/purchase-orders/purchase-orders.service";
import { createPurchaseOrderSchema } from "../src/modules/purchase-orders/purchase-orders.schemas";

describe("PurchaseOrdersService", () => {
  it("submits and receives an ordered purchase order with purchase-order stock origin", async () => {
    const h = harness(); const current = purchaseOrder({ status: PurchaseOrderStatus.DRAFT }); const ordered = purchaseOrder({ status: PurchaseOrderStatus.ORDERED }); const received = purchaseOrder({ status: PurchaseOrderStatus.RECEIVED, receivedAt: new Date() });
    h.repository.findByIdInTransaction.mockResolvedValueOnce(current).mockResolvedValueOnce(ordered);
    h.repository.updateStatusIfCurrent.mockResolvedValue(true);
    await expect(h.service.submit(current.id)).resolves.toMatchObject({ status: PurchaseOrderStatus.ORDERED });
    h.repository.findByIdInTransaction.mockResolvedValueOnce(ordered).mockResolvedValueOnce(received);
    await expect(h.service.receive(current.id, { id: "admin-1" })).resolves.toMatchObject({ status: PurchaseOrderStatus.RECEIVED });
    expect(h.inventory.incrementStockForItems).toHaveBeenCalledWith(expect.anything(), expect.arrayContaining([{ productId: "product-1", quantity: 3, variantId: null }]), expect.objectContaining({ origin: "purchase_order" }));
  });

  it("rejects receiving a draft and editing an ordered order's items", async () => {
    const h = harness(); const draft = purchaseOrder({ status: PurchaseOrderStatus.DRAFT });
    h.repository.findByIdInTransaction.mockResolvedValue(draft);
    await expect(h.service.receive(draft.id)).rejects.toMatchObject({ status: 409 });
    expect(h.inventory.incrementStockForItems).not.toHaveBeenCalled();
    const ordered = purchaseOrder({ status: PurchaseOrderStatus.ORDERED }); h.repository.findByIdInTransaction.mockResolvedValue(ordered);
    await expect(h.service.update(ordered.id, { items: createPurchaseOrderSchema.parse({ supplierId: "supplier-1", items: [{ productId: "product-1", quantity: 1, sku: "SKU", title: "Product", unitCost: 10 }] }).items })).rejects.toMatchObject({ status: 409 });
    expect(h.repository.update).not.toHaveBeenCalled();
  });
});

function harness() {
  const repository = { create: jest.fn(), findById: jest.fn(), findByIdInTransaction: jest.fn(), list: jest.fn(), update: jest.fn(), updateStatus: jest.fn(), updateStatusIfCurrent: jest.fn(), transaction: jest.fn((callback: (transaction: object) => Promise<unknown>) => callback({})) };
  const inventory = { incrementStockForItems: jest.fn() };
  return { inventory, repository, service: new PurchaseOrdersService(repository as unknown as PurchaseOrdersRepository, inventory as unknown as InventoryRepository) };
}

function purchaseOrder(overrides: Partial<{ status: PurchaseOrderStatus; receivedAt: Date }> = {}) {
  return { id: "po-1", orderNumber: "PO-1", supplierId: "supplier-1", status: PurchaseOrderStatus.DRAFT, notes: null, subtotal: 30, tax: 0, shippingCost: 0, total: 30, expectedDate: null, receivedAt: null, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"), supplier: { id: "supplier-1", name: "Supplier", code: "SUP-1", contactName: null, email: null, phone: null, notes: null, status: SupplierStatus.ACTIVE, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") }, items: [{ id: "item-1", purchaseOrderId: "po-1", productId: "product-1", variantId: null, sku: "SKU", title: "Product", quantity: 3, unitCost: 10, totalCost: 30 }], ...overrides };
}
