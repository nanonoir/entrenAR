import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { InventoryOperation, OrderDeliveryType, OrderShippingStatus, OrderStatus, StockMode } from "../src/generated/prisma/enums";

describe("catalog cleanup migration safety", () => {
  const databaseUrl = process.env["DATABASE_URL"];
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl ?? "" }) });

  afterAll(async () => prisma.$disconnect());

  it("keeps active cart variant references and immutable historical null variant IDs", async () => {
    const suffix = randomUUID();
    const productId = `cleanup-product-${suffix}`;
    const variantId = `cleanup-variant-${suffix}`;
    const cartId = `cleanup-cart-${suffix}`;
    const orderId = `cleanup-order-${suffix}`;
    const product = await prisma.product.create({
      data: { id: productId, name: "Cleanup product", price: 100, publicSlug: productId, slug: productId, variants: { create: { id: variantId, name: "Cleanup variant", quantity: 2, sku: `CLEANUP-VARIANT-${suffix}`, stockMode: StockMode.TRACKED } } },
    });
    const cart = await prisma.cart.create({ data: { id: cartId } });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, quantity: 1, variantId } });
    const order = await prisma.order.create({ data: { id: orderId, number: `CLEANUP-ORDER-${suffix}`, customerEmail: `cleanup-${suffix}@example.com`, customerFirstName: "Cleanup", customerLastName: "Test", deliveryType: OrderDeliveryType.SHIPPING, shippingStatus: OrderShippingStatus.TO_PACK, status: OrderStatus.PENDING, subtotal: 100, total: 100, items: { create: { attributes: {}, lineSubtotal: 100, productId: product.id, productName: product.name, quantity: 1, sku: "historical-sku", snapshot: {}, unitPrice: 100, variantId: null } } } });
    await prisma.inventoryHistory.create({ data: { delta: -1, operation: InventoryOperation.SUBTRACT, origin: "cleanup-smoke", productId: product.id, reason: "historical null variant", stockMode: StockMode.TRACKED, variantId: null } });

    await expect(prisma.cartItem.findUnique({ where: { cartId_productId_variantId: { cartId: cart.id, productId: product.id, variantId } } })).resolves.toEqual(expect.objectContaining({ variantId }));
    await expect(prisma.orderItem.findFirst({ where: { orderId: order.id } })).resolves.toEqual(expect.objectContaining({ variantId: null }));
    await expect(prisma.inventoryHistory.findFirst({ where: { productId: product.id } })).resolves.toEqual(expect.objectContaining({ variantId: null }));
  });

  it("rejects a newly-created product without a variant at commit", async () => {
    const suffix = randomUUID();
    await expect(prisma.product.create({ data: { id: `cleanup-invalid-product-${suffix}`, name: "Invalid cleanup product", price: 1, publicSlug: `cleanup-invalid-product-${suffix}`, slug: `cleanup-invalid-product-${suffix}` } })).rejects.toThrow("must have at least one ProductVariant");
  });
});
