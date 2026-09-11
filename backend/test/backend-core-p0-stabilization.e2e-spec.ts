import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  CartStatus,
  CheckoutRecoveryStatus,
  CheckoutSessionStatus,
  CatalogVisibility,
  InventoryMovementKind,
  InventoryOperation,
  InventoryReferenceType,
  OrderDeliveryType,
  OrderInventoryPolicy,
  OrderStatus,
  PaymentStatus,
  PurchaseOrderStatus,
  StockMode,
  SupplierStatus,
} from "../src/generated/prisma/enums";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { AbandonedCartsRepository } from "../src/modules/abandoned-carts/abandoned-carts.repository";
import { AbandonedCartsService } from "../src/modules/abandoned-carts/abandoned-carts.service";
import { InventoryRepository } from "../src/modules/inventory/inventory.repository";
import { PurchaseOrdersRepository } from "../src/modules/purchase-orders/purchase-orders.repository";
import { PurchaseOrdersService } from "../src/modules/purchase-orders/purchase-orders.service";
import { createPurchaseOrderSchema } from "../src/modules/purchase-orders/purchase-orders.schemas";
import { SalesRepository } from "../src/modules/sales/sales.repository";
import { SalesService } from "../src/modules/sales/sales.service";
import { createManualSaleSchema } from "../src/modules/sales/sales.schemas";

const databaseUrl = process.env["DATABASE_URL"];

describe("backend core P0 stabilization acceptance", () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl ?? "" }) });
  const prismaService = prisma as unknown as PrismaService;
  const inventory = new InventoryRepository(prismaService);
  const sales = new SalesService(new SalesRepository(prismaService), inventory);
  const recovery = new AbandonedCartsService(new AbandonedCartsRepository(prismaService), inventory);
  const purchaseOrders = new PurchaseOrdersService(new PurchaseOrdersRepository(prismaService), inventory);
  const productIds: string[] = [];
  const orderIds: string[] = [];
  const sessionIds: string[] = [];
  const cartIds: string[] = [];
  let supplierId = "";
  let purchaseOrderId = "";

  beforeAll(() => {
    if (!databaseUrl) throw new Error("DATABASE_URL is required for P0 acceptance tests.");
  });

  afterAll(async () => {
    if (orderIds.length > 0) await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    if (sessionIds.length > 0) await prisma.checkoutSession.deleteMany({ where: { id: { in: sessionIds } } });
    if (cartIds.length > 0) await prisma.cart.deleteMany({ where: { id: { in: cartIds } } });
    if (purchaseOrderId) await prisma.purchaseOrder.delete({ where: { id: purchaseOrderId } });
    if (supplierId) await prisma.supplier.delete({ where: { id: supplierId } });
    await prisma.$disconnect();
  });

  it("proves the integrated P0 stock, payment, recovery, ownership, and PO invariants", async () => {
    const suffix = randomUUID().replaceAll("-", "");
    const productId = `p0-acceptance-product-${suffix}`;
    productIds.push(productId);
    await prisma.product.create({
      data: {
        id: productId,
        name: "P0 acceptance product",
        publicSlug: `p0-${suffix}`,
        quantity: 10,
        salePrice: 100,
        sku: `P0-${suffix}`,
        slug: `p0-${suffix}`,
        stockMode: StockMode.TRACKED,
        visibility: CatalogVisibility.HIDDEN,
      },
    });

    const sale = await sales.createManualSale(createManualSaleSchema.parse({
      customer: { email: `p0-${suffix}@example.test`, firstName: "P0", lastName: "Acceptance" },
      deliveryType: OrderDeliveryType.SHIPPING,
      items: [{ name: "P0 acceptance product", productId, quantity: 2, unitPrice: 100 }],
      paymentStatus: PaymentStatus.PENDING,
    }));
    orderIds.push(sale.id);
    await expectStock(productId, 8);
    await expectMovements(sale.id, InventoryMovementKind.SALE_DEDUCTION, 1);

    await sales.confirm(sale.id);
    await expect(prisma.order.findUniqueOrThrow({ include: { history: true, payment: true }, where: { id: sale.id } })).resolves.toEqual(expect.objectContaining({
      confirmedAt: expect.any(Date),
      payment: expect.objectContaining({ status: PaymentStatus.PAID }),
      status: OrderStatus.CONFIRMED,
    }));

    await sales.cancelSale(sale.id, { cancellationReason: "P0 acceptance", restoreStock: true });
    await expectStock(productId, 10);
    await sales.reopen(sale.id);
    await expectStock(productId, 8);
    await sales.cancelSale(sale.id, { cancellationReason: "P0 acceptance second cycle", restoreStock: true });
    await expectStock(productId, 10);
    await expectMovements(sale.id, InventoryMovementKind.SALE_CANCELLATION_RESTORATION, 2);
    await expect(prisma.inventoryHistory.count({ where: { referenceId: sale.id, compensatesMovementId: { not: null } } })).resolves.toBe(2);

    const recoveryProductId = `p0-recovery-product-${suffix}`;
    productIds.push(recoveryProductId);
    await prisma.product.create({ data: { id: recoveryProductId, name: "P0 recovery product", publicSlug: `p0-recovery-${suffix}`, quantity: 1, salePrice: 100, sku: `P0-R-${suffix}`, slug: `p0-recovery-${suffix}`, stockMode: StockMode.TRACKED, visibility: CatalogVisibility.HIDDEN } });
    const cartId = `p0-recovery-cart-${suffix}`;
    const sessionId = `p0-recovery-session-${suffix}`;
    cartIds.push(cartId);
    sessionIds.push(sessionId);
    await prisma.cart.create({ data: { id: cartId, items: { create: { productId: recoveryProductId, quantity: 1 } }, status: CartStatus.ABANDONED } });
    await prisma.checkoutSession.create({ data: { abandonedAt: new Date(), cartId, id: sessionId, lastActivityAt: new Date(), recoveryStatus: CheckoutRecoveryStatus.PENDING, snapshotData: { currency: "ARS", customer: { email: `recovery-${suffix}@example.test`, firstName: "P0", lastName: "Recovery" }, items: [{ lineSubtotal: 100, name: "P0 recovery product", productId: recoveryProductId, quantity: 1, sku: `P0-R-${suffix}`, unitPrice: 100 }], subtotal: 100, total: 100 }, status: CheckoutSessionStatus.ABANDONED, tokenHash: `p0-token-${suffix}` } });
    const converted = await recovery.convertAbandonedCart(sessionId, {}, "p0-admin", "ADMIN");
    orderIds.push(converted.orderId);
    await expectStock(recoveryProductId, 0);
    await expect(prisma.checkoutSession.findUniqueOrThrow({ where: { id: sessionId } })).resolves.toEqual(expect.objectContaining({ recoveryStatus: CheckoutRecoveryStatus.RECOVERED, status: CheckoutSessionStatus.COMPLETED }));
    await expectMovements(converted.orderId, InventoryMovementKind.CHECKOUT_DEDUCTION, 1);

    const sourceProductId = `p0-transfer-product-${suffix}`;
    productIds.push(sourceProductId);
    const effectId = `p0-transfer-effect-${suffix}`;
    const sourceOrderId = `p0-transfer-source-${suffix}`;
    await prisma.product.create({ data: { id: sourceProductId, name: "P0 transfer product", publicSlug: `p0-transfer-${suffix}`, quantity: 9, salePrice: 100, sku: `P0-T-${suffix}`, slug: `p0-transfer-${suffix}`, stockMode: StockMode.TRACKED, visibility: CatalogVisibility.HIDDEN } });
    await prisma.order.create({ data: { confirmedAt: new Date(), customerEmail: `transfer-${suffix}@example.test`, customerFirstName: "P0", customerLastName: "Transfer", deliveryType: OrderDeliveryType.SHIPPING, id: sourceOrderId, inventoryEffectId: effectId, inventoryPolicy: OrderInventoryPolicy.LEDGER_MANAGED, number: `P0-TRANSFER-${suffix}`, status: OrderStatus.PENDING, subtotal: 100, total: 100, payment: { create: { amount: 100, paymentMethodId: "manual", status: PaymentStatus.PENDING } }, items: { create: { lineSubtotal: 100, productId: sourceProductId, productName: "P0 transfer product", quantity: 1, sku: `P0-T-${suffix}`, unitPrice: 100 } } } });
    orderIds.push(sourceOrderId);
    await prisma.inventoryHistory.create({ data: { delta: -1, inventoryEffectId: effectId, movementKind: InventoryMovementKind.SALE_DEDUCTION, operation: InventoryOperation.SUBTRACT, operationId: `p0-transfer-operation-${suffix}`, origin: "p0_acceptance", productId: sourceProductId, referenceId: sourceOrderId, referenceType: InventoryReferenceType.ORDER, resultingQuantity: 9, stockMode: StockMode.TRACKED } });
    const destination = await sales.convertOrderToSale({ sourceOrderId });
    orderIds.push(destination.id);
    await expect(prisma.order.findMany({ select: { id: true, inventoryEffectId: true, inventoryPolicy: true }, where: { inventoryEffectId: effectId } })).resolves.toEqual([{ id: destination.id, inventoryEffectId: effectId, inventoryPolicy: OrderInventoryPolicy.LEDGER_MANAGED }]);

    supplierId = (await prisma.supplier.create({ data: { code: `P0-${suffix}`, name: "P0 acceptance supplier", status: SupplierStatus.ACTIVE } })).id;
    const purchaseOrder = await purchaseOrders.create(createPurchaseOrderSchema.parse({ supplierId, items: [{ productId: `p0-po-item-a-${suffix}`, quantity: 2, sku: "A", title: "A", unitCost: 100 }, { productId: `p0-po-item-b-${suffix}`, quantity: 3, sku: "B", title: "B", unitCost: 50 }] }));
    purchaseOrderId = purchaseOrder.id;
    const results = await Promise.allSettled([purchaseOrders.update(purchaseOrder.id, { tax: 35 }), purchaseOrders.update(purchaseOrder.id, { shippingCost: 20 })]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const finalPurchaseOrder = await purchaseOrders.get(purchaseOrder.id);
    expect(finalPurchaseOrder.total).toBe(finalPurchaseOrder.subtotal + finalPurchaseOrder.tax + finalPurchaseOrder.shippingCost);
    expect(finalPurchaseOrder.items.map((item) => item.totalCost)).toEqual([200, 150]);
    expect(finalPurchaseOrder.status).toBe(PurchaseOrderStatus.DRAFT);
  });

  async function expectStock(productId: string, quantity: number): Promise<void> {
    await expect(prisma.product.findUniqueOrThrow({ select: { quantity: true }, where: { id: productId } })).resolves.toEqual({ quantity });
  }

  async function expectMovements(referenceId: string, movementKind: InventoryMovementKind, count: number): Promise<void> {
    await expect(prisma.inventoryHistory.count({ where: { movementKind, referenceId } })).resolves.toBe(count);
  }
});
