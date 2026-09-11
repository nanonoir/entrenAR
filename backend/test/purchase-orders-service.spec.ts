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

  it("rejects forged derived money and calculates create totals from base fields", async () => {
    const forged = createPurchaseOrderSchema.safeParse({
      supplierId: "supplier-1",
      items: [{ productId: "product-1", quantity: 2, sku: "SKU", title: "Product", unitCost: 100, totalCost: 1 }],
      subtotal: 1,
      total: 1,
    });
    expect(forged.success).toBe(false);
    expect(createPurchaseOrderSchema.safeParse({ supplierId: "supplier-1", items: [{ productId: "product-1", quantity: 1, sku: "SKU", title: "Product", unitCost: 10.001 }] }).success).toBe(false);

    const h = harness();
    const created = purchaseOrder({ subtotal: 350, tax: 35, shippingCost: 20, total: 405 });
    h.repository.create.mockResolvedValue(created);
    const input = createPurchaseOrderSchema.parse({
      supplierId: "supplier-1",
      items: [
        { productId: "product-1", quantity: 2, sku: "A", title: "A", unitCost: 100 },
        { productId: "product-1", quantity: 3, sku: "B", title: "B", unitCost: 50 },
      ],
      tax: 35,
      shippingCost: 20,
    });

    await h.service.create(input);
    const createRecord = h.repository.create.mock.calls[0]?.[1];
    expect(Number(createRecord.subtotal)).toBe(350);
    expect(Number(createRecord.total)).toBe(405);
    expect(createRecord.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ totalCost: expect.objectContaining({ valueOf: expect.any(Function) }) }),
      expect.objectContaining({ totalCost: expect.objectContaining({ valueOf: expect.any(Function) }) }),
    ]));
  });

  it("merges draft financial updates and rejects stale writes", async () => {
    const h = harness();
    const current = purchaseOrder({ tax: 100, shippingCost: 50, subtotal: 1000, total: 1150, items: [{ id: "item-1", purchaseOrderId: "po-1", productId: "product-1", variantId: null, sku: "SKU", title: "Product", quantity: 100, unitCost: 10, totalCost: 1000 }] });
    const updated = purchaseOrder({ tax: 100, shippingCost: 200, subtotal: 1000, total: 1300 });
    h.repository.findByIdInTransaction.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    h.repository.update.mockResolvedValue(updated);

    await h.service.update(current.id, { shippingCost: 200 });
    const updateRecord = h.repository.update.mock.calls[0]?.[2];
    expect(Number(updateRecord.tax)).toBe(100);
    expect(Number(updateRecord.shippingCost)).toBe(200);
    expect(Number(updateRecord.subtotal)).toBe(1000);
    expect(Number(updateRecord.total)).toBe(1300);
    expect(h.repository.update.mock.calls[0]?.[3]).toEqual(current.updatedAt);

    h.repository.findByIdInTransaction.mockResolvedValueOnce(current);
    h.repository.update.mockResolvedValue(null);
    await expect(h.service.update(current.id, { tax: 125 })).rejects.toMatchObject({ status: 409 });
  });

  it("recalculates derived totals from base fields during draft updates", async () => {
    const h = harness();
    const current = purchaseOrder({
      items: [{ id: "item-1", purchaseOrderId: "po-1", productId: "product-1", variantId: null, sku: "SKU", title: "Product", quantity: 100, unitCost: 10, totalCost: 1000 }],
      tax: 100,
      shippingCost: 50,
      subtotal: 1000,
      total: 1150,
    });
    const updated = purchaseOrder({ tax: 100, shippingCost: 200, subtotal: 1000, total: 1300 });
    h.repository.findByIdInTransaction.mockResolvedValueOnce(current);
    h.repository.update.mockResolvedValue(updated);

    await h.service.update(current.id, { shippingCost: 200, subtotal: 1, total: 1 } as never);

    expect(h.repository.update.mock.calls[0]?.[2]).toEqual(expect.objectContaining({ subtotal: expect.anything(), total: expect.anything() }));
    expect(Number(h.repository.update.mock.calls[0]?.[2].subtotal)).toBe(1000);
    expect(Number(h.repository.update.mock.calls[0]?.[2].total)).toBe(1300);
  });
});

function harness() {
  const repository = { create: jest.fn(), findById: jest.fn(), findByIdInTransaction: jest.fn(), list: jest.fn(), update: jest.fn(), updateStatus: jest.fn(), updateStatusIfCurrent: jest.fn(), transaction: jest.fn((callback: (transaction: object) => Promise<unknown>) => callback({})) };
  const inventory = { incrementStockForItems: jest.fn() };
  return { inventory, repository, service: new PurchaseOrdersService(repository as unknown as PurchaseOrdersRepository, inventory as unknown as InventoryRepository) };
}

function purchaseOrder(overrides: Partial<{ status: PurchaseOrderStatus; receivedAt: Date; subtotal: number; tax: number; shippingCost: number; total: number; items: Array<{ id: string; purchaseOrderId: string; productId: string; variantId: string | null; sku: string; title: string; quantity: number; unitCost: number; totalCost: number }> }> = {}) {
  return { id: "po-1", orderNumber: "PO-1", supplierId: "supplier-1", status: PurchaseOrderStatus.DRAFT, notes: null, subtotal: 30, tax: 0, shippingCost: 0, total: 30, expectedDate: null, receivedAt: null, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"), supplier: { id: "supplier-1", name: "Supplier", code: "SUP-1", contactName: null, email: null, phone: null, notes: null, status: SupplierStatus.ACTIVE, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") }, items: [{ id: "item-1", purchaseOrderId: "po-1", productId: "product-1", variantId: null, sku: "SKU", title: "Product", quantity: 3, unitCost: 10, totalCost: 30 }], ...overrides };
}
