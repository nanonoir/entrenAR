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
import { checkoutCompleteRequestSchema, checkoutQuoteRequestSchema } from "../src/modules/checkout/checkout.schemas";
import { CheckoutRepository } from "../src/modules/checkout/checkout.repository";
import { CheckoutService } from "../src/modules/checkout/checkout.service";
import { CatalogRepository } from "../src/modules/catalog/catalog.repository";
import { CommerceRepository } from "../src/modules/commerce/commerce.repository";
import { InventoryRepository } from "../src/modules/inventory/inventory.repository";
import { PrismaService } from "../src/common/prisma/prisma.service";
import {
  CHECKOUT_SEED_FIXTURE,
  configureCheckoutCommerce,
  expectCheckoutCode,
  restorePaymentMethod,
  restoreShippingProvider,
  runCheckoutSeed,
  type PaymentMethodSnapshot,
  type ShippingProviderSnapshot,
} from "./support/checkout-database-fixtures";
import {
  createCheckoutDomainFixtureScope,
  createCheckoutDomainCart,
  createCheckoutDomainProduct,
  createCheckoutDomainUser,
  deleteCheckoutDomainFixtures,
} from "./support/checkout-domain-fixtures";

const databaseUrl = process.env["DATABASE_URL"];

describe("checkout persistence and contract foundation integration", () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl ?? "" }) });

  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required for checkout integration tests.");
    }

    await runSeed();
    await runSeed();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("keeps cart, session, order, payment, usage, and replay fixtures repeatable", async () => {
    const [cart, cartItem, session, order, orderItem, payment, idempotency, coupon, redemption] = await Promise.all([
      prisma.cart.findUnique({ where: { id: CHECKOUT_SEED_FIXTURE.cartId } }),
      prisma.cartItem.findUnique({ where: { id: CHECKOUT_SEED_FIXTURE.cartItemId } }),
      prisma.checkoutSession.findUnique({ where: { id: CHECKOUT_SEED_FIXTURE.sessionId } }),
      prisma.order.findUnique({ where: { id: CHECKOUT_SEED_FIXTURE.orderId } }),
      prisma.orderItem.findUnique({ where: { id: CHECKOUT_SEED_FIXTURE.orderItemId } }),
      prisma.orderPayment.findUnique({ where: { id: CHECKOUT_SEED_FIXTURE.paymentId } }),
      prisma.checkoutIdempotencyKey.findUnique({ where: { id: CHECKOUT_SEED_FIXTURE.idempotencyId } }),
      prisma.coupon.findUnique({ where: { id: CHECKOUT_SEED_FIXTURE.couponId } }),
      prisma.couponRedemption.findUnique({ where: { id: CHECKOUT_SEED_FIXTURE.redemptionId } }),
    ]);

    expect(cart).toEqual(expect.objectContaining({ id: CHECKOUT_SEED_FIXTURE.cartId, status: "ACTIVE", userId: "checkout-seed-customer" }));
    expect(cartItem).toEqual(expect.objectContaining({
      cartId: CHECKOUT_SEED_FIXTURE.cartId,
      id: CHECKOUT_SEED_FIXTURE.cartItemId,
      productId: "p-creatine",
      quantity: 1,
      variantId: "sin-sabor-300",
    }));
    expect(session).toEqual(expect.objectContaining({
      cartId: CHECKOUT_SEED_FIXTURE.cartId,
      id: CHECKOUT_SEED_FIXTURE.sessionId,
      status: "ACTIVE",
      userId: "checkout-seed-customer",
    }));
    expect(session?.tokenHash).toHaveLength(64);
    expect(session?.tokenHash).not.toBe("checkout-seed-session-token");
    expect(order).toEqual(expect.objectContaining({
      customerEmail: "checkout-customer@entrenar.test",
      id: CHECKOUT_SEED_FIXTURE.orderId,
      number: "EN-CHK-000001",
      status: "PENDING",
      userId: "checkout-seed-customer",
    }));
    expect(order?.discountAmount.toString()).toBe("3120");
    expect(order?.subtotal.toString()).toBe("31200");
    expect(order?.total.toString()).toBe("28080");
    expect(orderItem).toEqual(expect.objectContaining({
      id: CHECKOUT_SEED_FIXTURE.orderItemId,
      orderId: CHECKOUT_SEED_FIXTURE.orderId,
      productId: "p-creatine",
      productName: "Creatina Monohidrato 300g",
      quantity: 1,
      variantId: "sin-sabor-300",
    }));
    expect(orderItem?.lineSubtotal.toString()).toBe("31200");
    expect(orderItem?.unitPrice.toString()).toBe("31200");
    expect(payment).toEqual(expect.objectContaining({
      id: CHECKOUT_SEED_FIXTURE.paymentId,
      orderId: CHECKOUT_SEED_FIXTURE.orderId,
      paymentMethodId: "bank-transfer",
      status: "PENDING",
    }));
    expect(payment?.amount.toString()).toBe("28080");
    expect(idempotency).toEqual(expect.objectContaining({
      id: CHECKOUT_SEED_FIXTURE.idempotencyId,
      idempotencyKey: CHECKOUT_SEED_FIXTURE.idempotencyKey,
      orderId: CHECKOUT_SEED_FIXTURE.orderId,
      ownerKey: "user:checkout-seed-customer",
      status: "COMPLETED",
    }));
    expect(coupon).toEqual(expect.objectContaining({ code: "CHECKOUT-SEED-10", usageCount: 1 }));
    expect(redemption).toEqual(expect.objectContaining({
      couponCode: "CHECKOUT-SEED-10",
      couponId: CHECKOUT_SEED_FIXTURE.couponId,
      orderId: CHECKOUT_SEED_FIXTURE.orderId,
      userId: "checkout-seed-customer",
    }));
    expect(redemption?.discountAmount.toString()).toBe("3120");
  });

  it("rejects forged totals, prices, stock, and ownership IDs without a database write", async () => {
    const validQuote = {
      items: [{ productId: "p-creatine", quantity: 1, variantId: "sin-sabor-300" }],
      sessionToken: "checkout-seed-session-token",
    };
    const validComplete = {
      ...validQuote,
      customer: {
        email: "checkout-customer@entrenar.test",
        firstName: "Checkout",
        lastName: "Fixture",
      },
      idempotencyKey: "checkout-contract-key",
      paymentMethodId: "bank-transfer",
    };
    const before = await readWriteCounts();

    expect(() => checkoutQuoteRequestSchema.parse({ ...validQuote, total: 1 })).toThrow();
    expect(() => checkoutQuoteRequestSchema.parse({
      ...validQuote,
      items: [{ ...validQuote.items[0], price: 0, quantity: 1, userId: "foreign-user" }],
    })).toThrow();
    expect(() => checkoutCompleteRequestSchema.parse({ ...validComplete, cartId: "foreign-cart" })).toThrow();
    expect(() => checkoutCompleteRequestSchema.parse({ ...validComplete, total: 0, userId: "foreign-user" })).toThrow();

    await expect(readWriteCounts()).resolves.toEqual(before);
  });

  it("enforces positive cart quantities and immutable order snapshots", async () => {
    const beforeCartItems = await prisma.cartItem.count({ where: { cartId: CHECKOUT_SEED_FIXTURE.cartId } });

    await expect(prisma.cartItem.create({
      data: {
        cartId: CHECKOUT_SEED_FIXTURE.cartId,
        id: "checkout-invalid-quantity",
        productId: "p-creatine",
        quantity: 0,
        variantId: "sin-sabor-300",
      },
    })).rejects.toThrow();
    await expect(prisma.cartItem.count({ where: { cartId: CHECKOUT_SEED_FIXTURE.cartId } })).resolves.toBe(beforeCartItems);

    await expect(prisma.orderItem.update({
      data: { productName: "Forged product name" },
      where: { id: CHECKOUT_SEED_FIXTURE.orderItemId },
    })).rejects.toThrow();
    await expect(prisma.orderItem.findUniqueOrThrow({ where: { id: CHECKOUT_SEED_FIXTURE.orderItemId } })).resolves.toEqual(
      expect.objectContaining({ productName: "Creatina Monohidrato 300g" }),
    );

    await expect(prisma.order.update({
      data: { total: "1.00" },
      where: { id: CHECKOUT_SEED_FIXTURE.orderId },
    })).rejects.toThrow();
    await expect(prisma.orderPayment.update({
      data: { paymentMethodSnapshot: { forged: true } },
      where: { id: CHECKOUT_SEED_FIXTURE.paymentId },
    })).rejects.toThrow();
  });

  it("enforces idempotency and coupon-redemption uniqueness at the database boundary", async () => {
    const before = await readWriteCounts();

    await expect(prisma.checkoutIdempotencyKey.create({
      data: {
        id: "checkout-duplicate-idempotency",
        idempotencyKey: CHECKOUT_SEED_FIXTURE.idempotencyKey,
        ownerKey: "user:checkout-seed-customer",
        requestHash: "duplicate-request-hash",
      },
    })).rejects.toMatchObject({ code: "P2002" });
    await expect(prisma.couponRedemption.create({
      data: {
        couponCode: "CHECKOUT-SEED-10",
        couponId: CHECKOUT_SEED_FIXTURE.couponId,
        discountAmount: "3120.00",
        id: "checkout-duplicate-redemption",
        orderId: CHECKOUT_SEED_FIXTURE.orderId,
        userId: "checkout-seed-customer",
      },
    })).rejects.toMatchObject({ code: "P2002" });

    await expect(readWriteCounts()).resolves.toEqual(before);
  });

  async function readWriteCounts(): Promise<WriteCounts> {
    const [cartItems, idempotency, orders, redemptions] = await Promise.all([
      prisma.cartItem.count({ where: { cartId: CHECKOUT_SEED_FIXTURE.cartId } }),
      prisma.checkoutIdempotencyKey.count({ where: { ownerKey: "user:checkout-seed-customer" } }),
      prisma.order.count({ where: { id: CHECKOUT_SEED_FIXTURE.orderId } }),
      prisma.couponRedemption.count({ where: { orderId: CHECKOUT_SEED_FIXTURE.orderId } }),
    ]);

    return { cartItems, idempotency, orders, redemptions };
  }
});

describe("checkout quote domain integration", () => {
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

  it("merges an opaque guest cart into the customer cart without duplicate lines", async () => {
    const suffix = randomUUID().replaceAll("-", "");
    const owner = await createCheckoutDomainUser(prisma, "merge-owner", suffix, fixtures);
    const product = await createCheckoutDomainProduct(prisma, "merge", suffix, 8, fixtures);
    const accountCart = await createCheckoutDomainCart(prisma, owner.id, product, 1, undefined, suffix, fixtures);
    const guestCart = await createCheckoutDomainCart(prisma, undefined, product, 2, `guest-merge-token-${suffix}`, suffix, fixtures);

    const resolution = await checkoutRepository.transaction((transaction) => {
      return checkoutRepository.resolveCart(transaction, {
        sessionToken: guestCart.sessionToken,
        userId: owner.id,
      });
    });

    expect(resolution).toEqual(expect.objectContaining({ ownerKey: `user:${owner.id}` }));
    const merged = await prisma.cart.findUniqueOrThrow({
      include: { items: true },
      where: { id: accountCart.cartId },
    });
    const guest = await prisma.cart.findUniqueOrThrow({ where: { id: guestCart.cartId } });
    const mergedItem = merged.items[0];
    expect(mergedItem).toEqual(expect.objectContaining({ productId: product.productId, quantity: 3, variantId: product.variantId }));
    expect(merged.items).toHaveLength(1);
    expect(guest.status).toBe("ABANDONED");
    expect(resolution?.session.cartId).toBe(accountCart.cartId);
    expect(resolution?.session.userId).toBe(owner.id);
  });

  it("rejects expired coupons before returning a quote", async () => {
    const suffix = randomUUID().replaceAll("-", "");
    const owner = await createCheckoutDomainUser(prisma, "expired-coupon-owner", suffix, fixtures);
    const product = await createCheckoutDomainProduct(prisma, "expired-coupon", suffix, 1, fixtures);
    const couponId = `checkout-domain-expired-coupon-${suffix}`;
    fixtures.couponIds.push(couponId);
    const yesterday = new Date(Date.now() - 86_400_000);
    await prisma.coupon.create({
      data: {
        code: `EXPIRED-${suffix.toLocaleUpperCase()}`,
        customerLimitType: CouponCustomerLimitType.UNLIMITED,
        dateLimitType: CouponDateLimitType.PERIOD,
        discountType: CouponDiscountType.PERCENTAGE,
        discountValue: "10.00",
        endDate: yesterday,
        id: couponId,
        includeShippingCost: false,
        maxDiscountType: CouponMaxDiscountType.NONE,
        minimumCartAmount: "0.00",
        startDate: new Date(yesterday.getTime() - 86_400_000),
        status: CouponStatus.ACTIVE,
        targetType: CouponTargetType.ALL_STORE,
        totalUsageLimitType: CouponUsageLimitType.UNLIMITED,
      },
    });
    await createCheckoutDomainCart(prisma, owner.id, product, 1, undefined, suffix, fixtures, false);

    await expectCheckoutCode(checkoutService.quote(checkoutQuoteRequestSchema.parse({
      couponCode: `expired-${suffix}`,
      items: [{ productId: product.productId, quantity: 1, variantId: product.variantId }],
      shippingMethodId: "andreani:envío-a-domicilio",
    }), { role: Role.CUSTOMER, userId: owner.id }), "COUPON_NOT_VALID");
    await expect(prisma.order.count({ where: { userId: owner.id } })).resolves.toBe(0);
    await expect(prisma.checkoutIdempotencyKey.count({ where: { order: { userId: owner.id } } })).resolves.toBe(0);
  });
});

interface WriteCounts {
  cartItems: number;
  idempotency: number;
  orders: number;
  redemptions: number;
}

async function runSeed(): Promise<void> {
  await runCheckoutSeed("checkout-seed-admin@example.test", "checkout-seed-admin-password", "Checkout seed");
}
