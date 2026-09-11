import { randomUUID } from "node:crypto";

import { HttpException } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { CatalogVisibility, InventoryMovementKind, InventoryOperation, InventoryReferenceType, OrderDeliveryType, OrderInventoryPolicy, OrderShippingStatus, OrderStatus, PaymentStatus, Role, StockMode } from "../src/generated/prisma/enums";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { INVENTORY_ORIGIN } from "../src/modules/inventory/inventory.constants";
import { InventoryRepository } from "../src/modules/inventory/inventory.repository";
import { SalesRepository } from "../src/modules/sales/sales.repository";
import { SalesService } from "../src/modules/sales/sales.service";
import { cancelSaleSchema, createManualSaleSchema } from "../src/modules/sales/sales.schemas";

const databaseUrl = process.env["DATABASE_URL"];

describe("sales CRM inventory integration", () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl ?? "" }) });
  const prismaService = prisma as unknown as PrismaService;
  const service = new SalesService(new SalesRepository(prismaService), new InventoryRepository(prismaService));
  const fixtures: SaleFixture[] = [];

  beforeAll(() => {
    if (!databaseUrl) throw new Error("DATABASE_URL is required for sales CRM integration tests.");
  });

  afterAll(async () => {
    try {
      for (const fixture of fixtures) await deleteFixture(prisma, fixture);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("restores tracked products and variants with cancellation-origin history", async () => {
    const fixture = await createFixture(prisma, "restore");
    fixtures.push(fixture);

    await service.cancelSale(fixture.orderId, cancelSaleSchema.parse({
      cancellationReason: "Customer request",
      restoreStock: true,
    }), { id: "admin-restore", role: Role.ADMIN });

    const [product, variant, infiniteProduct, history, orderHistory] = await Promise.all([
      prisma.product.findUniqueOrThrow({ select: { quantity: true }, where: { id: fixture.productId } }),
      prisma.productVariant.findUniqueOrThrow({ select: { quantity: true }, where: { id: fixture.variantId } }),
      prisma.product.findUniqueOrThrow({ select: { quantity: true }, where: { id: fixture.infiniteProductId } }),
      prisma.inventoryHistory.findMany({ orderBy: { id: "asc" }, where: { origin: INVENTORY_ORIGIN.ADMIN_SALES_CANCELLATION, productId: { in: fixture.productIds } } }),
      prisma.orderHistory.findMany({ where: { orderId: fixture.orderId } }),
    ]);

    expect(product.quantity).toBe(5);
    expect(variant.quantity).toBe(4);
    expect(infiniteProduct.quantity).toBeNull();
    expect(history).toHaveLength(2);
    expect(history).toEqual(expect.arrayContaining([
      expect.objectContaining({ compensatesMovementId: expect.any(String), delta: 2, movementKind: InventoryMovementKind.SALE_CANCELLATION_RESTORATION, operation: InventoryOperation.ADD, productId: fixture.productId, resultingQuantity: 5, variantId: null }),
      expect.objectContaining({ compensatesMovementId: expect.any(String), delta: 1, movementKind: InventoryMovementKind.SALE_CANCELLATION_RESTORATION, operation: InventoryOperation.ADD, productId: fixture.productId, resultingQuantity: 4, variantId: fixture.variantId }),
    ]));
    expect(orderHistory).toEqual(expect.arrayContaining([expect.objectContaining({ type: "ORDER_CANCELLED" })]));
  });

  it("keeps customer, item, delivery, discount, and payment snapshots after catalog changes", async () => {
    const fixture = await createFixture(prisma, "snapshots");
    fixtures.push(fixture);

    await Promise.all([
      prisma.product.update({ data: { name: "Changed live product", salePrice: 999 }, where: { id: fixture.productId } }),
      prisma.productVariant.update({ data: { name: "Changed live variant" }, where: { id: fixture.variantId } }),
    ]);

    const detail = await service.get(fixture.orderId);

    expect(detail.customer).toEqual({
      email: "sales-crm@example.test",
      firstName: "Sales",
      lastName: "Fixture",
      phone: "+54 11 5555-5555",
    });
    expect(detail.customerSnapshot).toEqual({
      email: "sales-crm@example.test",
      firstName: "Sales",
      lastName: "Fixture",
      phone: "+54 11 5555-5555",
    });
    expect(detail.deliverySnapshot).toEqual({ method: "shipping", label: "Original delivery" });
    expect(detail.discountSnapshot).toEqual({ code: "ORIGINAL" });
    expect(detail.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        attributes: { color: "red" },
        productName: "Sales CRM fixture product",
        snapshot: { catalogName: "Original product" },
      }),
      expect.objectContaining({
        productName: "Sales CRM fixture product",
        snapshot: { catalogName: "Original variant" },
        variantName: "Sales CRM fixture variant",
      }),
    ]));
    expect(detail.payment).toEqual(expect.objectContaining({
      paymentMethodSnapshot: { name: "Original payment" },
      status: PaymentStatus.PENDING,
    }));
  });

  it("cancels without changing stock or inventory history when restoration is disabled", async () => {
    const fixture = await createFixture(prisma, "no-restore");
    fixtures.push(fixture);

    await service.cancelSale(fixture.orderId, cancelSaleSchema.parse({
      cancellationReason: "Administrative cancellation",
      restoreStock: false,
    }));

    const [product, variant, history] = await Promise.all([
      prisma.product.findUniqueOrThrow({ select: { quantity: true }, where: { id: fixture.productId } }),
      prisma.productVariant.findUniqueOrThrow({ select: { quantity: true }, where: { id: fixture.variantId } }),
      prisma.inventoryHistory.count({ where: { origin: INVENTORY_ORIGIN.ADMIN_SALES_CANCELLATION, productId: { in: fixture.productIds } } }),
    ]);

    expect(product.quantity).toBe(3);
    expect(variant.quantity).toBe(3);
    expect(history).toBe(0);
  });

  it("rejects a repeated cancellation without a second restoration", async () => {
    const fixture = await createFixture(prisma, "duplicate");
    fixtures.push(fixture);
    const input = cancelSaleSchema.parse({ cancellationReason: "Duplicate protection", restoreStock: true });

    await service.cancelSale(fixture.orderId, input);
    await expect(service.cancelSale(fixture.orderId, input)).rejects.toMatchObject({ status: 409 });

    await expect(prisma.inventoryHistory.count({ where: { origin: INVENTORY_ORIGIN.ADMIN_SALES_CANCELLATION, productId: { in: fixture.productIds } } })).resolves.toBe(2);
    await expect(prisma.product.findUniqueOrThrow({ select: { quantity: true }, where: { id: fixture.productId } })).resolves.toEqual({ quantity: 5 });
  });

  it("allows only one concurrent cancellation to claim restoration", async () => {
    const fixture = await createFixture(prisma, "concurrent");
    fixtures.push(fixture);
    const input = cancelSaleSchema.parse({ cancellationReason: "Concurrent cancellation", restoreStock: true });

    const results = await Promise.allSettled([
      service.cancelSale(fixture.orderId, input, { id: "admin-concurrent", role: Role.ADMIN }),
      service.cancelSale(fixture.orderId, input, { id: "admin-concurrent", role: Role.ADMIN }),
    ]);
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejectionStatus(rejected[0]?.reason)).toBe(409);
    await expect(prisma.product.findUniqueOrThrow({ select: { quantity: true }, where: { id: fixture.productId } })).resolves.toEqual({ quantity: 5 });
    await expect(prisma.productVariant.findUniqueOrThrow({ select: { quantity: true }, where: { id: fixture.variantId } })).resolves.toEqual({ quantity: 4 });
    await expect(prisma.inventoryHistory.count({ where: { origin: INVENTORY_ORIGIN.ADMIN_SALES_CANCELLATION, productId: { in: fixture.productIds } } })).resolves.toBe(2);
  });

  it("re-deducts the latest restored ledger set and supports a second exact restoration", async () => {
    const fixture = await createFixture(prisma, "reopen-cycle");
    fixtures.push(fixture);
    const input = cancelSaleSchema.parse({ cancellationReason: "Cycle", restoreStock: true });

    await service.cancelSale(fixture.orderId, input);
    await service.reopen(fixture.orderId);
    await expect(prisma.product.findUniqueOrThrow({ select: { quantity: true }, where: { id: fixture.productId } })).resolves.toEqual({ quantity: 3 });
    await expect(prisma.productVariant.findUniqueOrThrow({ select: { quantity: true }, where: { id: fixture.variantId } })).resolves.toEqual({ quantity: 3 });

    await service.cancelSale(fixture.orderId, input);
    await expect(prisma.product.findUniqueOrThrow({ select: { quantity: true }, where: { id: fixture.productId } })).resolves.toEqual({ quantity: 5 });
    await expect(prisma.productVariant.findUniqueOrThrow({ select: { quantity: true }, where: { id: fixture.variantId } })).resolves.toEqual({ quantity: 4 });
  });

  it("fails closed for UNKNOWN inventory-changing cancellation and reopen", async () => {
    const fixture = await createFixture(prisma, "unknown");
    fixtures.push(fixture);
    await prisma.order.update({ data: { inventoryEffectId: null, inventoryPolicy: OrderInventoryPolicy.UNKNOWN }, where: { id: fixture.orderId } });
    const input = cancelSaleSchema.parse({ cancellationReason: "Historical", restoreStock: true });

    await expect(service.cancelSale(fixture.orderId, input)).rejects.toMatchObject({ status: 409 });
    await prisma.order.update({ data: { shippingStatus: OrderShippingStatus.CANCELLED, status: OrderStatus.CANCELLED }, where: { id: fixture.orderId } });
    await expect(service.reopen(fixture.orderId)).rejects.toMatchObject({ status: 409 });
    await expect(prisma.product.findUniqueOrThrow({ select: { quantity: true }, where: { id: fixture.productId } })).resolves.toEqual({ quantity: 3 });
  });

  it("marks confirmed pending payments as paid exactly once", async () => {
    const fixture = await createFixture(prisma, "confirm");
    fixtures.push(fixture);

    await service.confirm(fixture.orderId, { id: "admin-confirm", role: Role.ADMIN });

    const order = await prisma.order.findUniqueOrThrow({ include: { history: true, payment: true }, where: { id: fixture.orderId } });
    expect(order.status).toBe(OrderStatus.CONFIRMED);
    expect(order.confirmedAt).not.toBeNull();
    expect(order.payment?.status).toBe(PaymentStatus.PAID);
    expect(order.history.filter((entry) => entry.type === "PAYMENT_RECEIVED")).toHaveLength(1);
    await expect(service.confirm(fixture.orderId)).rejects.toMatchObject({ status: 409 });
  });

  it("confirms pending orders with pending payments", async () => {
    const fixture = await createFixture(prisma, "confirm-pending");
    fixtures.push(fixture);
    await prisma.order.update({ data: { status: OrderStatus.PENDING }, where: { id: fixture.orderId } });

    await service.confirm(fixture.orderId);

    await expect(prisma.order.findUniqueOrThrow({ include: { payment: true }, where: { id: fixture.orderId } })).resolves.toEqual(expect.objectContaining({
      confirmedAt: expect.any(Date),
      payment: expect.objectContaining({ status: PaymentStatus.PAID }),
      status: OrderStatus.CONFIRMED,
    }));
  });

  it("rejects missing, paid, and refunded payments without writing confirmation history", async () => {
    const missing = await createFixture(prisma, "confirm-missing");
    const paid = await createFixture(prisma, "confirm-paid");
    const refunded = await createFixture(prisma, "confirm-refunded");
    fixtures.push(missing, paid, refunded);
    await prisma.orderPayment.delete({ where: { orderId: missing.orderId } });
    await prisma.orderPayment.update({ data: { status: PaymentStatus.PAID }, where: { orderId: paid.orderId } });
    await prisma.orderPayment.update({ data: { status: PaymentStatus.REFUNDED }, where: { orderId: refunded.orderId } });

    for (const fixture of [missing, paid, refunded]) {
      await expect(service.confirm(fixture.orderId)).rejects.toMatchObject({ status: 409 });
      await expect(prisma.orderHistory.count({ where: { orderId: fixture.orderId, type: "PAYMENT_RECEIVED" } })).resolves.toBe(0);
    }
  });

  it("transfers a ledger effect to the converted sale without duplicating deductions", async () => {
    const fixture = await createFixture(prisma, "transfer");
    fixtures.push(fixture);
    await prisma.order.update({ data: { status: OrderStatus.PENDING }, where: { id: fixture.orderId } });

    const sale = await service.convertOrderToSale({ sourceOrderId: fixture.orderId });

    const source = await prisma.order.findUniqueOrThrow({ where: { id: fixture.orderId } });
    const destination = await prisma.order.findUniqueOrThrow({ where: { id: sale.id } });
    expect(source).toMatchObject({ inventoryEffectId: null, inventoryPolicy: OrderInventoryPolicy.TRANSFERRED });
    expect(destination).toMatchObject({ inventoryEffectId: `sales-effect-${fixture.suffix}`, inventoryPolicy: OrderInventoryPolicy.LEDGER_MANAGED });
    await expect(prisma.inventoryHistory.count({ where: { inventoryEffectId: `sales-effect-${fixture.suffix}` } })).resolves.toBe(2);
  });

  it("creates a manual sale with derived money, referenced tracked deductions, and no infinite-stock movement", async () => {
    const fixture = await createManualSaleFixture(prisma, "manual-success", { productQuantity: 10, variantQuantity: 8 });
    fixtures.push(fixture.cleanupFixture);

    const sale = await service.createManualSale(createManualSaleSchema.parse(manualSaleInput(fixture)), { id: "admin-manual", role: Role.ADMIN });

    const [order, product, variant, infiniteProduct, movements] = await Promise.all([
      prisma.order.findUniqueOrThrow({ include: { items: true, payment: true }, where: { id: sale.id } }),
      prisma.product.findUniqueOrThrow({ select: { quantity: true }, where: { id: fixture.productId } }),
      prisma.productVariant.findUniqueOrThrow({ select: { quantity: true }, where: { id: fixture.variantId } }),
      prisma.product.findUniqueOrThrow({ select: { quantity: true }, where: { id: fixture.infiniteProductId } }),
      prisma.inventoryHistory.findMany({ orderBy: { id: "asc" }, where: { referenceId: sale.id } }),
    ]);

    expect(order).toMatchObject({
      discountAmount: expect.objectContaining({ toString: expect.any(Function) }),
      inventoryEffectId: expect.any(String),
      inventoryPolicy: OrderInventoryPolicy.LEDGER_MANAGED,
      shippingCost: expect.objectContaining({ toString: expect.any(Function) }),
      subtotal: expect.objectContaining({ toString: expect.any(Function) }),
      total: expect.objectContaining({ toString: expect.any(Function) }),
    });
    expect(order.discountAmount.toString()).toBe("100");
    expect(order.shippingCost.toString()).toBe("150");
    expect(order.subtotal.toString()).toBe("1000");
    expect(order.total.toString()).toBe("1050");
    expect(order.items.map((item) => item.lineSubtotal.toString())).toEqual(expect.arrayContaining(["500", "400", "100"]));
    expect(order.payment?.amount.toString()).toBe("1050");
    expect(product.quantity).toBe(8);
    expect(variant.quantity).toBe(6);
    expect(infiniteProduct.quantity).toBeNull();
    expect(movements).toEqual(expect.arrayContaining([
      expect.objectContaining({ delta: -2, movementKind: InventoryMovementKind.SALE_DEDUCTION, productId: fixture.productId, referenceType: InventoryReferenceType.ORDER, variantId: null }),
      expect.objectContaining({ delta: -2, movementKind: InventoryMovementKind.SALE_DEDUCTION, productId: fixture.productId, referenceType: InventoryReferenceType.ORDER, variantId: fixture.variantId }),
    ]));
    expect(movements).toHaveLength(2);
  });

  it("rejects forged or invalid manual money and rolls back insufficient stock", async () => {
    const fixture = await createManualSaleFixture(prisma, "manual-rollback", { productQuantity: 1, variantQuantity: 1 });
    fixtures.push(fixture.cleanupFixture);

    expect(() => createManualSaleSchema.parse({ ...manualSaleInput(fixture), subtotal: 1, total: 1 })).toThrow();
    expect(() => createManualSaleSchema.parse({ ...manualSaleInput(fixture), discountAmount: -1 })).toThrow();
    expect(() => createManualSaleSchema.parse({ ...manualSaleInput(fixture), items: [{ ...manualSaleInput(fixture).items[0], unitPrice: 10.001 }] })).toThrow();

    await expect(service.createManualSale(createManualSaleSchema.parse(manualSaleInput(fixture)), { id: "admin-manual", role: Role.ADMIN })).rejects.toMatchObject({ status: 409 });
    await expect(prisma.product.findUniqueOrThrow({ select: { quantity: true }, where: { id: fixture.productId } })).resolves.toEqual({ quantity: 1 });
    await expect(prisma.productVariant.findUniqueOrThrow({ select: { quantity: true }, where: { id: fixture.variantId } })).resolves.toEqual({ quantity: 1 });
    await expect(prisma.order.count({ where: { customerEmail: `manual-${fixture.suffix}@example.test` } })).resolves.toBe(0);
    await expect(prisma.inventoryHistory.count({ where: { productId: { in: [fixture.productId, fixture.infiniteProductId] } } })).resolves.toBe(0);
  });
});

async function createManualSaleFixture(
  prisma: PrismaClient,
  label: string,
  quantities: { productQuantity: number; variantQuantity: number },
): Promise<ManualSaleFixture> {
  const suffix = `${label}-${randomUUID().replaceAll("-", "")}`;
  const productId = `manual-product-${suffix}`;
  const variantId = `manual-variant-${suffix}`;
  const infiniteProductId = `manual-infinite-${suffix}`;

  await prisma.product.create({
    data: {
      id: productId,
      name: "Manual sale fixture product",
      publicSlug: `manual-public-${suffix}`,
      quantity: quantities.productQuantity,
      salePrice: "100.00",
      sku: `MANUAL-PRODUCT-${suffix}`,
      slug: `manual-${suffix}`,
      stockMode: StockMode.TRACKED,
      variants: { create: { id: variantId, name: "Manual sale fixture variant", quantity: quantities.variantQuantity, sku: `MANUAL-VARIANT-${suffix}`, stockMode: StockMode.TRACKED } },
      visibility: CatalogVisibility.HIDDEN,
    },
  });
  await prisma.product.create({
    data: {
      id: infiniteProductId,
      name: "Manual sale infinite fixture",
      publicSlug: `manual-infinite-public-${suffix}`,
      quantity: null,
      salePrice: "100.00",
      sku: `MANUAL-INFINITE-${suffix}`,
      slug: `manual-infinite-${suffix}`,
      stockMode: StockMode.INFINITE,
      visibility: CatalogVisibility.HIDDEN,
    },
  });

  return {
    cleanupFixture: { infiniteProductId, orderId: "", productId, productIds: [productId, infiniteProductId], suffix, variantId },
    infiniteProductId,
    productId,
    suffix,
    variantId,
  };
}

function manualSaleInput(fixture: ManualSaleFixture) {
  return {
    customer: { email: `manual-${fixture.suffix}@example.test`, firstName: "Manual", lastName: "Sale" },
    deliverySnapshot: { method: "shipping" },
    discountAmount: 100,
    discountSnapshot: {},
    items: [
      { name: "Manual tracked product", productId: fixture.productId, quantity: 2, unitPrice: 250 },
      { name: "Manual tracked variant", productId: fixture.productId, quantity: 2, unitPrice: 200, variantId: fixture.variantId },
      { name: "Manual infinite product", productId: fixture.infiniteProductId, quantity: 1, unitPrice: 100 },
    ],
    paymentMethodSnapshot: {},
    shippingCost: 150,
  };
}

async function createFixture(prisma: PrismaClient, label: string): Promise<SaleFixture> {
  const suffix = `${label}-${randomUUID().replaceAll("-", "")}`;
  const productId = `sales-product-${suffix}`;
  const variantId = `sales-variant-${suffix}`;
  const infiniteProductId = `sales-infinite-${suffix}`;
  const orderId = `sales-order-${suffix}`;

  await prisma.product.create({
    data: {
      id: productId,
      name: "Sales CRM fixture product",
      publicSlug: `sales-public-${suffix}`,
      quantity: 3,
      salePrice: "100.00",
      sku: `SALES-PRODUCT-${suffix}`,
      slug: `sales-${suffix}`,
      stockMode: StockMode.TRACKED,
      variants: {
        create: {
          id: variantId,
          name: "Sales CRM fixture variant",
          quantity: 3,
          sku: `SALES-VARIANT-${suffix}`,
          stockMode: StockMode.TRACKED,
        },
      },
      visibility: CatalogVisibility.HIDDEN,
    },
  });
  await prisma.product.create({
    data: {
      id: infiniteProductId,
      name: "Sales CRM infinite fixture",
      publicSlug: `sales-infinite-public-${suffix}`,
      quantity: null,
      salePrice: "100.00",
      sku: `SALES-INFINITE-${suffix}`,
      slug: `sales-infinite-${suffix}`,
      stockMode: StockMode.INFINITE,
      visibility: CatalogVisibility.HIDDEN,
    },
  });
  await prisma.order.create({
    data: {
      customerEmail: "sales-crm@example.test",
      customerFirstName: "Sales",
      customerLastName: "Fixture",
       customerPhone: "+54 11 5555-5555",
       customerSnapshot: { email: "sales-crm@example.test", firstName: "Sales", lastName: "Fixture", phone: "+54 11 5555-5555" },
       deliverySnapshot: { label: "Original delivery", method: "shipping" },
       deliveryType: OrderDeliveryType.SHIPPING,
       discountSnapshot: { code: "ORIGINAL" },
       id: orderId,
       inventoryEffectId: `sales-effect-${suffix}`,
       inventoryPolicy: OrderInventoryPolicy.LEDGER_MANAGED,
      items: {
        create: [
           { attributes: { color: "red" }, lineSubtotal: 200, productId, productName: "Sales CRM fixture product", quantity: 2, sku: `SALES-PRODUCT-${suffix}`, snapshot: { catalogName: "Original product" }, unitPrice: 100, variantId: null },
           { attributes: { color: "blue" }, lineSubtotal: 100, productId, productName: "Sales CRM fixture product", quantity: 1, sku: `SALES-VARIANT-${suffix}`, snapshot: { catalogName: "Original variant" }, unitPrice: 100, variantId, variantName: "Sales CRM fixture variant" },
           { attributes: {}, lineSubtotal: 100, productId: infiniteProductId, productName: "Sales CRM infinite fixture", quantity: 1, sku: `SALES-INFINITE-${suffix}`, snapshot: {}, unitPrice: 100 },
         ],
       },
      number: `EN-SALES-${suffix}`,
       shippingStatus: OrderShippingStatus.TO_PACK,
       status: OrderStatus.CONFIRMED,
       subtotal: 400,
       total: 400,
       payment: { create: { amount: 400, currency: "ARS", paymentMethodId: "manual", paymentMethodSnapshot: { name: "Original payment" }, status: PaymentStatus.PENDING } },
      },
   });
  await prisma.inventoryHistory.createMany({
    data: [
      {
        delta: -2,
        inventoryEffectId: `sales-effect-${suffix}`,
        movementKind: InventoryMovementKind.SALE_DEDUCTION,
        operation: InventoryOperation.SUBTRACT,
        operationId: `sales-initial-${suffix}`,
        origin: "sales_fixture",
        productId,
        referenceId: orderId,
        referenceType: InventoryReferenceType.ORDER,
        resultingQuantity: 3,
        stockMode: StockMode.TRACKED,
      },
      {
        delta: -1,
        inventoryEffectId: `sales-effect-${suffix}`,
        movementKind: InventoryMovementKind.SALE_DEDUCTION,
        operation: InventoryOperation.SUBTRACT,
        operationId: `sales-initial-${suffix}`,
        origin: "sales_fixture",
        productId,
        referenceId: orderId,
        referenceType: InventoryReferenceType.ORDER,
        resultingQuantity: 3,
        stockMode: StockMode.TRACKED,
        variantId,
      },
    ],
  });

  return { infiniteProductId, orderId, productId, productIds: [productId, infiniteProductId], suffix, variantId };
}

async function deleteFixture(prisma: PrismaClient, fixture: SaleFixture): Promise<void> {
  if (fixture.orderId) {
    await prisma.order.deleteMany({ where: { sourceOrderId: fixture.orderId } });
    await prisma.order.delete({ where: { id: fixture.orderId } });
  }
  await prisma.product.delete({ where: { id: fixture.infiniteProductId } });
}

interface SaleFixture {
  infiniteProductId: string;
  orderId: string;
  productId: string;
  productIds: string[];
  suffix: string;
  variantId: string;
}

interface ManualSaleFixture {
  cleanupFixture: SaleFixture;
  infiniteProductId: string;
  productId: string;
  suffix: string;
  variantId: string;
}

function rejectionStatus(error: unknown): number | undefined {
  return error instanceof HttpException ? error.getStatus() : undefined;
}
