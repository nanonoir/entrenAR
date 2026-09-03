import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  CouponCustomerLimitType,
  CouponDateLimitType,
  CouponDiscountType,
  CouponMaxDiscountType,
  CouponStatus,
  CouponTargetType,
  CouponUsageLimitType,
  Role,
} from "../src/generated/prisma/enums";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { CatalogRepository } from "../src/modules/catalog/catalog.repository";
import { CommerceRepository } from "../src/modules/commerce/commerce.repository";
import { InventoryRepository } from "../src/modules/inventory/inventory.repository";
import { CheckoutRepository } from "../src/modules/checkout/checkout.repository";
import { CheckoutService } from "../src/modules/checkout/checkout.service";
import { checkoutCompleteRequestSchema, checkoutQuoteRequestSchema } from "../src/modules/checkout/checkout.schemas";
import {
  configureCheckoutCommerce,
  checkoutErrorCode,
  expectCheckoutCode,
  restorePaymentMethod,
  restoreShippingProvider,
  runCheckoutSeed,
  type PaymentMethodSnapshot,
  type ShippingProviderSnapshot,
} from "./support/checkout-database-fixtures";
import {
  createCheckoutDomainCart,
  createCheckoutDomainFixtureScope,
  createCheckoutDomainProduct,
  createCheckoutDomainUser,
  deleteCheckoutDomainFixtures,
} from "./support/checkout-domain-fixtures";

const databaseUrl = process.env["DATABASE_URL"];

describe("checkout completion domain integration", () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl ?? "" }) });
  const prismaService = prisma as unknown as PrismaService;
  const inventoryRepository = new InventoryRepository(prismaService);
  const checkoutRepository = new CheckoutRepository(prismaService, inventoryRepository);
  const catalogRepository = new CatalogRepository(prismaService);
  const commerceRepository = new CommerceRepository(prismaService);
  const checkoutService = new CheckoutService(checkoutRepository, catalogRepository, commerceRepository);
  const fixtures = createCheckoutDomainFixtureScope();
  let paymentSnapshot: PaymentMethodSnapshot | undefined;
  let shippingSnapshot: ShippingProviderSnapshot | undefined;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error("DATABASE_URL is required for checkout domain integration tests.");

    await runCheckoutSeed("checkout-domain-admin@example.test", "checkout-domain-admin-password", "Checkout domain seed");
    await runCheckoutSeed("checkout-domain-admin@example.test", "checkout-domain-admin-password", "Checkout domain seed");
    paymentSnapshot = await prisma.paymentMethodConfig.findUniqueOrThrow({ where: { id: "bank-transfer" } });
    shippingSnapshot = await prisma.shippingProvider.findUniqueOrThrow({ include: { weightBands: true }, where: { id: "andreani" } });
    await configureCheckoutCommerce(prisma);
  });

  afterAll(async () => {
    try {
      await deleteCheckoutDomainFixtures(prisma, fixtures);
      if (paymentSnapshot) await restorePaymentMethod(prisma, paymentSnapshot);
      if (shippingSnapshot) await restoreShippingProvider(prisma, shippingSnapshot);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("quotes and completes from current catalog/commerce state, then replays without duplicate writes", async () => {
    const suffix = randomUUID().replaceAll("-", "");
    const owner = await createCheckoutDomainUser(prisma, "complete-owner", suffix, fixtures);
    const product = await createCheckoutDomainProduct(prisma, "complete", suffix, 2, fixtures);
    await createCheckoutDomainCart(prisma, owner.id, product, 1, undefined, suffix, fixtures, false);
    const quoteInput = checkoutQuoteRequestSchema.parse({
      items: [{ productId: product.productId, quantity: 1, variantId: product.variantId }],
      shippingMethodId: "andreani:envío-a-domicilio",
    });

    const quote = await checkoutService.quote(quoteInput, { role: Role.CUSTOMER, userId: owner.id });
    expect(quote).toEqual(expect.objectContaining({ discount: 0, ok: true, shipping: 100, subtotal: 50, total: 150 }));
    expect(quote.items[0]).toEqual(expect.objectContaining({ unitPrice: 50, variantId: product.variantId }));
    expect(quote.sessionToken).toEqual(expect.any(String));

    const completeInput = checkoutCompleteRequestSchema.parse({
      address: { city: "Buenos Aires", postalCode: "C1000", province: "Buenos Aires", street: "123 Test Street" },
      customer: { email: owner.email, firstName: "Complete", lastName: "Owner" },
      idempotencyKey: `complete-${suffix}`,
      items: [{ productId: product.productId, quantity: 1, variantId: product.variantId }],
      paymentMethodId: "bank-transfer",
      paymentOptionId: "direct-transfer",
      quoteId: quote.quoteId,
      sessionToken: quote.sessionToken,
      shippingMethodId: "andreani:envío-a-domicilio",
    });
    const response = await checkoutService.complete(completeInput, { role: Role.CUSTOMER, userId: owner.id });
    expect(response).toEqual(expect.objectContaining({ number: expect.any(String), ok: true, status: "pending", total: 150 }));

    const [order, variant, history, idempotency, cart, session] = await Promise.all([
      prisma.order.findUniqueOrThrow({ include: { items: true, payment: true }, where: { id: response.orderId } }),
      prisma.productVariant.findUniqueOrThrow({ where: { id: product.variantId } }),
      prisma.inventoryHistory.findMany({ where: { productId: product.productId } }),
      prisma.checkoutIdempotencyKey.findFirstOrThrow({ where: { orderId: response.orderId } }),
      prisma.cart.findFirstOrThrow({ include: { items: true }, where: { userId: owner.id, status: "COMPLETED" } }),
      prisma.checkoutSession.findFirstOrThrow({ orderBy: { createdAt: "desc" }, where: { userId: owner.id } }),
    ]);
    expect(order.status).toBe("PENDING");
    expect(order.userId).toBe(owner.id);
    expect(order.items).toHaveLength(1);
    const orderItem = order.items[0];
    if (!orderItem) throw new Error("Expected a persisted checkout order item.");
    expect(orderItem.productName).toBe("Complete fixture product");
    expect(orderItem.unitPrice.toString()).toBe("50");
    expect(order.payment).toEqual(expect.objectContaining({ paymentMethodId: "bank-transfer", status: "PENDING" }));
    expect(Number(order.payment?.amount)).toBe(150);
    expect(variant?.quantity).toBe(1);
    expect(history).toEqual([expect.objectContaining({ delta: -1, origin: "checkout", variantId: product.variantId })]);
    expect(idempotency.status).toBe("COMPLETED");
    expect(cart.items).toEqual([]);
    expect(session.status).toBe("COMPLETED");

    const beforeReplay = await readMutationCounts(product.productId, response.orderId);
    await expect(checkoutService.complete(completeInput, { role: Role.CUSTOMER, userId: owner.id })).resolves.toEqual(response);
    await expect(readMutationCounts(product.productId, response.orderId)).resolves.toEqual(beforeReplay);

    await prisma.product.update({ data: { name: "Changed after placement", salePrice: "999.00" }, where: { id: product.productId } });
    await expect(prisma.orderItem.findUniqueOrThrow({ where: { id: orderItem.id } })).resolves.toEqual(
      expect.objectContaining({ productName: "Complete fixture product" }),
    );
    const persistedSnapshot = await prisma.orderItem.findUniqueOrThrow({ where: { id: orderItem.id } });
    expect(persistedSnapshot.unitPrice.toString()).toBe("50");
  });

  it("allows only one concurrent completion to consume the final variant unit and rolls back the loser", async () => {
    const suffix = randomUUID().replaceAll("-", "");
    const firstOwner = await createCheckoutDomainUser(prisma, "race-first", suffix, fixtures);
    const secondOwner = await createCheckoutDomainUser(prisma, "race-second", suffix, fixtures);
    const product = await createCheckoutDomainProduct(prisma, "race", suffix, 1, fixtures);
    const firstCart = await createCheckoutDomainCart(prisma, firstOwner.id, product, 1, `race-first-token-${suffix}`, suffix, fixtures);
    const secondCart = await createCheckoutDomainCart(prisma, secondOwner.id, product, 1, `race-second-token-${suffix}`, suffix, fixtures);
    const inputFor = (owner: { email: string }, key: string, session: { sessionToken: string }) => checkoutCompleteRequestSchema.parse({
      address: { city: "Buenos Aires", postalCode: "C1000", province: "Buenos Aires", street: "123 Test Street" },
      customer: { email: owner.email, firstName: "Race", lastName: "Customer" },
      idempotencyKey: key,
      items: [{ productId: product.productId, quantity: 1, variantId: product.variantId }],
      paymentMethodId: "bank-transfer",
      paymentOptionId: "direct-transfer",
      sessionToken: session.sessionToken,
      shippingMethodId: "andreani:envío-a-domicilio",
    });

    const results = await Promise.allSettled([
      checkoutService.complete(inputFor(firstOwner, `race-first-${suffix}`, firstCart), { role: Role.CUSTOMER, userId: firstOwner.id }),
      checkoutService.complete(inputFor(secondOwner, `race-second-${suffix}`, secondCart), { role: Role.CUSTOMER, userId: secondOwner.id }),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const rejectedReason = rejected[0]?.status === "rejected" ? rejected[0].reason : undefined;
    expect(checkoutErrorCode(rejectedReason)).toBe("OUT_OF_STOCK");

    const [variant, history, orders, firstCartState, secondCartState] = await Promise.all([
      prisma.productVariant.findUniqueOrThrow({ where: { id: product.variantId } }),
      prisma.inventoryHistory.count({ where: { productId: product.productId, origin: "checkout" } }),
      prisma.order.count({ where: { userId: { in: [firstOwner.id, secondOwner.id] } } }),
      prisma.cart.findUniqueOrThrow({ include: { items: true }, where: { id: firstCart.cartId } }),
      prisma.cart.findUniqueOrThrow({ include: { items: true }, where: { id: secondCart.cartId } }),
    ]);
    expect(variant.quantity).toBe(0);
    expect(history).toBe(1);
    expect(orders).toBe(1);
    expect([firstCartState.items.length, secondCartState.items.length].sort()).toEqual([0, 1]);
  });

  it("revalidates coupon usage inside completion and records one redemption", async () => {
    const suffix = randomUUID().replaceAll("-", "");
    const owner = await createCheckoutDomainUser(prisma, "coupon-owner", suffix, fixtures);
    const product = await createCheckoutDomainProduct(prisma, "coupon", suffix, 2, fixtures);
    const couponId = `checkout-domain-coupon-${suffix}`;
    fixtures.couponIds.push(couponId);
    await prisma.coupon.create({
      data: {
        code: `CHECKOUT-${suffix.toLocaleUpperCase()}`,
        customerLimitType: CouponCustomerLimitType.UNLIMITED,
        dateLimitType: CouponDateLimitType.UNLIMITED,
        discountType: CouponDiscountType.PERCENTAGE,
        discountValue: "10.00",
        id: couponId,
        includeShippingCost: false,
        maxDiscountType: CouponMaxDiscountType.NONE,
        minimumCartAmount: "0.00",
        status: CouponStatus.ACTIVE,
        targetType: CouponTargetType.ALL_STORE,
        totalUsageLimit: 1,
        totalUsageLimitType: CouponUsageLimitType.LIMITED,
      },
    });
    await createCheckoutDomainCart(prisma, owner.id, product, 1, undefined, suffix, fixtures, false);
    await expect(prisma.coupon.findUniqueOrThrow({ where: { id: couponId } })).resolves.toEqual(
      expect.objectContaining({ code: `CHECKOUT-${suffix.toLocaleUpperCase()}`, deletedAt: null, status: "ACTIVE" }),
    );
    const quote = await checkoutService.quote(checkoutQuoteRequestSchema.parse({
      couponCode: `checkout-${suffix}`,
      items: [{ productId: product.productId, quantity: 1, variantId: product.variantId }],
      shippingMethodId: "andreani:envío-a-domicilio",
    }), { role: Role.CUSTOMER, userId: owner.id });
    expect(quote).toEqual(expect.objectContaining({ discount: 5, shipping: 100, subtotal: 50, total: 145 }));

    const input = checkoutCompleteRequestSchema.parse({
      address: { city: "Buenos Aires", postalCode: "C1000", province: "Buenos Aires", street: "123 Test Street" },
      couponCode: `CHECKOUT-${suffix}`,
      customer: { email: owner.email, firstName: "Coupon", lastName: "Owner" },
      idempotencyKey: `coupon-${suffix}`,
      items: [{ productId: product.productId, quantity: 1, variantId: product.variantId }],
      paymentMethodId: "bank-transfer",
      paymentOptionId: "direct-transfer",
      quoteId: quote.quoteId,
      sessionToken: quote.sessionToken,
      shippingMethodId: "andreani:envío-a-domicilio",
    });
    const response = await checkoutService.complete(input, { role: Role.CUSTOMER, userId: owner.id });
    const [coupon, placedOrder, redemptions] = await Promise.all([
      prisma.coupon.findUniqueOrThrow({ where: { id: couponId } }),
      prisma.order.findUniqueOrThrow({ where: { id: response.orderId } }),
      prisma.couponRedemption.findMany({ where: { couponId, orderId: response.orderId } }),
    ]);
    expect(coupon.usageCount).toBe(1);
    expect(placedOrder.couponCode).toBe(`CHECKOUT-${suffix.toLocaleUpperCase()}`);
    expect(redemptions).toHaveLength(1);
    const redemption = redemptions[0];
    if (!redemption) throw new Error("Expected one coupon redemption.");
    expect(redemption.discountAmount.toString()).toBe("5");
    await expect(checkoutService.complete(input, { role: Role.CUSTOMER, userId: owner.id })).resolves.toEqual(response);
    await expect(prisma.couponRedemption.count({ where: { couponId } })).resolves.toBe(1);
    await expect(prisma.coupon.findUniqueOrThrow({ where: { id: couponId } })).resolves.toEqual(
      expect.objectContaining({ usageCount: 1 }),
    );
  });

  it("rolls back the idempotency claim and cart state when a coupon is no longer eligible", async () => {
    const suffix = randomUUID().replaceAll("-", "");
    const owner = await createCheckoutDomainUser(prisma, "invalid-coupon-owner", suffix, fixtures);
    const product = await createCheckoutDomainProduct(prisma, "invalid-coupon", suffix, 1, fixtures);
    const cart = await createCheckoutDomainCart(prisma, owner.id, product, 1, `invalid-coupon-token-${suffix}`, suffix, fixtures);
    const input = checkoutCompleteRequestSchema.parse({
      address: { city: "Buenos Aires", postalCode: "C1000", province: "Buenos Aires", street: "123 Test Street" },
      couponCode: `MISSING-${suffix.toLocaleUpperCase()}`,
      customer: { email: owner.email, firstName: "Invalid", lastName: "Coupon" },
      idempotencyKey: `invalid-coupon-${suffix}`,
      items: [{ productId: product.productId, quantity: 1, variantId: product.variantId }],
      paymentMethodId: "bank-transfer",
      paymentOptionId: "direct-transfer",
      sessionToken: cart.sessionToken,
      shippingMethodId: "andreani:envío-a-domicilio",
    });

    await expectCheckoutCode(checkoutService.complete(input, { role: Role.CUSTOMER, userId: owner.id }), "COUPON_NOT_VALID");
    const [variant, persistedCart, orders, idempotency] = await Promise.all([
      prisma.productVariant.findUniqueOrThrow({ where: { id: product.variantId } }),
      prisma.cart.findUniqueOrThrow({ include: { items: true }, where: { id: cart.cartId } }),
      prisma.order.count({ where: { userId: owner.id } }),
      prisma.checkoutIdempotencyKey.count({ where: { ownerKey: `user:${owner.id}` } }),
    ]);
    expect(variant.quantity).toBe(1);
    expect(persistedCart.status).toBe("ACTIVE");
    expect(persistedCart.items).toHaveLength(1);
    expect(orders).toBe(0);
    expect(idempotency).toBe(0);
  });

  async function readMutationCounts(productId: string, orderId: string): Promise<MutationCounts> {
    const [orders, history, idempotency] = await Promise.all([
      prisma.order.count({ where: { id: orderId } }),
      prisma.inventoryHistory.count({ where: { productId, origin: "checkout" } }),
      prisma.checkoutIdempotencyKey.count({ where: { orderId } }),
    ]);
    return { history, idempotency, orders };
  }
});

interface MutationCounts {
  history: number;
  idempotency: number;
  orders: number;
}
