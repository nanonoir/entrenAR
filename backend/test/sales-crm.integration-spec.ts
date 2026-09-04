import { randomUUID } from "node:crypto";

import { HttpException } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { CatalogVisibility, InventoryOperation, OrderDeliveryType, OrderShippingStatus, OrderStatus, PaymentStatus, Role, StockMode } from "../src/generated/prisma/enums";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { INVENTORY_ORIGIN } from "../src/modules/inventory/inventory.constants";
import { InventoryRepository } from "../src/modules/inventory/inventory.repository";
import { SalesRepository } from "../src/modules/sales/sales.repository";
import { SalesService } from "../src/modules/sales/sales.service";
import { cancelSaleSchema } from "../src/modules/sales/sales.schemas";

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

    expect(product.quantity).toBe(7);
    expect(variant.quantity).toBe(5);
    expect(infiniteProduct.quantity).toBeNull();
    expect(history).toHaveLength(2);
    expect(history).toEqual(expect.arrayContaining([
      expect.objectContaining({ delta: 2, operation: InventoryOperation.ADD, productId: fixture.productId, resultingQuantity: 7, variantId: null }),
      expect.objectContaining({ delta: 1, operation: InventoryOperation.ADD, productId: fixture.productId, resultingQuantity: 5, variantId: fixture.variantId }),
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

    expect(product.quantity).toBe(5);
    expect(variant.quantity).toBe(4);
    expect(history).toBe(0);
  });

  it("rejects a repeated cancellation without a second restoration", async () => {
    const fixture = await createFixture(prisma, "duplicate");
    fixtures.push(fixture);
    const input = cancelSaleSchema.parse({ cancellationReason: "Duplicate protection", restoreStock: true });

    await service.cancelSale(fixture.orderId, input);
    await expect(service.cancelSale(fixture.orderId, input)).rejects.toMatchObject({ status: 409 });

    await expect(prisma.inventoryHistory.count({ where: { origin: INVENTORY_ORIGIN.ADMIN_SALES_CANCELLATION, productId: { in: fixture.productIds } } })).resolves.toBe(2);
    await expect(prisma.product.findUniqueOrThrow({ select: { quantity: true }, where: { id: fixture.productId } })).resolves.toEqual({ quantity: 7 });
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
    await expect(prisma.product.findUniqueOrThrow({ select: { quantity: true }, where: { id: fixture.productId } })).resolves.toEqual({ quantity: 7 });
    await expect(prisma.productVariant.findUniqueOrThrow({ select: { quantity: true }, where: { id: fixture.variantId } })).resolves.toEqual({ quantity: 5 });
    await expect(prisma.inventoryHistory.count({ where: { origin: INVENTORY_ORIGIN.ADMIN_SALES_CANCELLATION, productId: { in: fixture.productIds } } })).resolves.toBe(2);
  });
});

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
      quantity: 5,
      salePrice: "100.00",
      sku: `SALES-PRODUCT-${suffix}`,
      slug: `sales-${suffix}`,
      stockMode: StockMode.TRACKED,
      variants: {
        create: {
          id: variantId,
          name: "Sales CRM fixture variant",
          quantity: 4,
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

  return { infiniteProductId, orderId, productId, productIds: [productId, infiniteProductId], variantId };
}

async function deleteFixture(prisma: PrismaClient, fixture: SaleFixture): Promise<void> {
  await prisma.order.delete({ where: { id: fixture.orderId } });
  await prisma.product.delete({ where: { id: fixture.infiniteProductId } });
}

interface SaleFixture {
  infiniteProductId: string;
  orderId: string;
  productId: string;
  productIds: string[];
  variantId: string;
}

function rejectionStatus(error: unknown): number | undefined {
  return error instanceof HttpException ? error.getStatus() : undefined;
}
