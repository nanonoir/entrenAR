import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { CatalogVisibility, InventoryOperation, PurchaseOrderStatus, SupplierStatus, StockMode } from "../src/generated/prisma/enums";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { InventoryRepository } from "../src/modules/inventory/inventory.repository";
import { PurchaseOrdersRepository } from "../src/modules/purchase-orders/purchase-orders.repository";
import { PurchaseOrdersService } from "../src/modules/purchase-orders/purchase-orders.service";
import { createPurchaseOrderSchema } from "../src/modules/purchase-orders/purchase-orders.schemas";
import { SuppliersRepository } from "../src/modules/suppliers/suppliers.repository";
import { SuppliersService } from "../src/modules/suppliers/suppliers.service";
import { INVENTORY_ORIGIN } from "../src/modules/inventory/inventory.constants";

const databaseUrl = process.env["DATABASE_URL"];

describe("purchase order inventory integration", () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl ?? "" }) });
  const prismaService = prisma as unknown as PrismaService;
  const suppliers = new SuppliersService(new SuppliersRepository(prismaService));
  const service = new PurchaseOrdersService(new PurchaseOrdersRepository(prismaService), new InventoryRepository(prismaService));

  beforeAll(() => { if (!databaseUrl) throw new Error("DATABASE_URL is required for purchase-order integration tests."); });
  afterAll(() => prisma.$disconnect());

  it("receives ordered items atomically and writes exactly one purchase-order movement per item", async () => {
    const suffix = randomUUID().replaceAll("-", ""); const supplier = await suppliers.create({ code: `TEST-${suffix}`, name: "Integration Supplier", status: SupplierStatus.ACTIVE });
    const productId = `po-product-${suffix}`; const variantId = `po-variant-${suffix}`;
    await prisma.product.create({ data: { id: productId, name: "PO fixture", publicSlug: `po-public-${suffix}`, quantity: 2, salePrice: 100, sku: `PO-P-${suffix}`, slug: `po-${suffix}`, stockMode: StockMode.TRACKED, visibility: CatalogVisibility.HIDDEN, variants: { create: { id: variantId, name: "PO variant", quantity: 4, sku: `PO-V-${suffix}`, stockMode: StockMode.TRACKED } } } });
    const input = createPurchaseOrderSchema.parse({ supplierId: supplier.id, items: [{ productId, quantity: 3, sku: `PO-P-${suffix}`, title: "PO fixture", unitCost: 10 }, { productId, variantId, quantity: 2, sku: `PO-V-${suffix}`, title: "PO variant", unitCost: 12 }] });
    const created = await service.create(input); await service.submit(created.id); await service.receive(created.id, { id: "integration-admin" });
    const [order, product, variant, history] = await Promise.all([
      prisma.purchaseOrder.findUniqueOrThrow({ select: { status: true, receivedAt: true }, where: { id: created.id } }),
      prisma.product.findUniqueOrThrow({ select: { quantity: true }, where: { id: productId } }),
      prisma.productVariant.findUniqueOrThrow({ select: { quantity: true }, where: { id: variantId } }),
      prisma.inventoryHistory.findMany({ orderBy: { id: "asc" }, where: { origin: INVENTORY_ORIGIN.PURCHASE_ORDER, productId } }),
    ]);
    expect(order.status).toBe(PurchaseOrderStatus.RECEIVED); expect(order.receivedAt).toBeInstanceOf(Date); expect(product.quantity).toBe(5); expect(variant.quantity).toBe(6);
    expect(history).toHaveLength(2); expect(history).toEqual(expect.arrayContaining([expect.objectContaining({ delta: 3, operation: InventoryOperation.ADD, variantId: null }), expect.objectContaining({ delta: 2, operation: InventoryOperation.ADD, variantId })]));
    await prisma.purchaseOrder.delete({ where: { id: created.id } }); await prisma.supplier.delete({ where: { id: supplier.id } });
  });

  it("rolls back the status and prior stock increment when one item is invalid", async () => {
    const suffix = randomUUID().replaceAll("-", ""); const supplier = await suppliers.create({ code: `ROLLBACK-${suffix}`, name: "Rollback Supplier", status: SupplierStatus.ACTIVE }); const productId = `po-rollback-${suffix}`;
    await prisma.product.create({ data: { id: productId, name: "Rollback fixture", publicSlug: `po-rollback-public-${suffix}`, quantity: 1, salePrice: 100, sku: `PO-R-${suffix}`, slug: `po-rollback-${suffix}`, stockMode: StockMode.TRACKED, visibility: CatalogVisibility.HIDDEN } });
    const created = await service.create(createPurchaseOrderSchema.parse({ supplierId: supplier.id, items: [{ productId, quantity: 2, sku: "VALID", title: "Valid", unitCost: 10 }, { productId: `missing-${suffix}`, quantity: 1, sku: "MISSING", title: "Missing", unitCost: 10 }] })); await service.submit(created.id);
    await expect(service.receive(created.id)).rejects.toThrow();
    await expect(prisma.purchaseOrder.findUniqueOrThrow({ select: { status: true, receivedAt: true }, where: { id: created.id } })).resolves.toEqual({ receivedAt: null, status: PurchaseOrderStatus.ORDERED }); await expect(prisma.product.findUniqueOrThrow({ select: { quantity: true }, where: { id: productId } })).resolves.toEqual({ quantity: 1 });
    await prisma.purchaseOrder.delete({ where: { id: created.id } }); await prisma.supplier.delete({ where: { id: supplier.id } });
  });

  it("claims a receipt once when two transactions receive the same order concurrently", async () => {
    const suffix = randomUUID().replaceAll("-", "");
    const supplier = await suppliers.create({ code: `CONCURRENT-${suffix}`, name: "Concurrent Supplier", status: SupplierStatus.ACTIVE });
    const productId = `po-concurrent-${suffix}`;
    await prisma.product.create({ data: { id: productId, name: "Concurrent PO fixture", publicSlug: `po-concurrent-public-${suffix}`, quantity: 0, salePrice: 100, sku: `PO-C-${suffix}`, slug: `po-concurrent-${suffix}`, stockMode: StockMode.TRACKED, visibility: CatalogVisibility.HIDDEN } });
    const created = await service.create(createPurchaseOrderSchema.parse({ supplierId: supplier.id, items: [{ productId, quantity: 2, sku: "PO-C", title: "Concurrent PO fixture", unitCost: 10 }] }));
    await service.submit(created.id);

    const results = await Promise.allSettled([
      service.receive(created.id, { id: "concurrent-admin" }),
      service.receive(created.id, { id: "concurrent-admin" }),
    ]);
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({ status: 409 });
    await expect(prisma.product.findUniqueOrThrow({ select: { quantity: true }, where: { id: productId } })).resolves.toEqual({ quantity: 2 });
    await expect(prisma.inventoryHistory.count({ where: { origin: INVENTORY_ORIGIN.PURCHASE_ORDER, productId } })).resolves.toBe(1);
    await expect(prisma.purchaseOrder.findUniqueOrThrow({ select: { status: true }, where: { id: created.id } })).resolves.toEqual({ status: PurchaseOrderStatus.RECEIVED });

    await prisma.purchaseOrder.delete({ where: { id: created.id } });
    await prisma.supplier.delete({ where: { id: supplier.id } });
  });
});
