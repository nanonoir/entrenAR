import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";

import { PrismaClient } from "../src/generated/prisma/client";
import { MutationGate } from "../src/common/prisma/mutation-gate";
import { CartStatus, CouponCustomerLimitType, CouponDateLimitType, CouponDiscountType, CouponMaxDiscountType, CouponStatus, CouponTargetType, CouponUsageLimitType, RefreshSessionType, Role } from "../src/generated/prisma/enums";
import {
  SHOWCASE_FIXTURE_MANIFEST,
  assertShowcaseFixtureManifest,
  getShowcaseManifestIdentityKeys,
} from "../src/modules/showcase-reset/fixtures/showcase-fixture-manifest";
import {
  SHOWCASE_RESET_FAILURE_CATEGORY,
  ShowcaseResetReport,
} from "../src/modules/showcase-reset/showcase-reset.report";
import { CatalogFixtureRestorer } from "../src/modules/showcase-reset/restorers/catalog-fixture-restorer";
import { CommerceFixtureRestorer } from "../src/modules/showcase-reset/restorers/commerce-fixture-restorer";
import { CheckoutPrerequisitesFixtureRestorer } from "../src/modules/showcase-reset/restorers/checkout-prerequisites-fixture-restorer";
import { OrderDependentCrmFixtureRestorer } from "../src/modules/showcase-reset/restorers/order-dependent-crm-fixture-restorer";
import { InventoryRepository } from "../src/modules/inventory/inventory.repository";
import { InventoryOperation, InventoryReferenceType, StockMode } from "../src/generated/prisma/enums";
import type { FixtureRestorer } from "../src/modules/showcase-reset/fixtures/fixture-restorer";
import { ShowcaseResetRunMutex } from "../src/modules/showcase-reset/showcase-reset.run-mutex";
import { SHOWCASE_RESET_EXIT_CODE, ShowcaseResetService } from "../src/modules/showcase-reset/showcase-reset.service";
import { PrismaService } from "../src/common/prisma/prisma.service";

describe("showcase reset contracts", () => {
  it("keeps canonical fixture identities explicit, unique, and complete", () => {
    const identities = getShowcaseManifestIdentityKeys(SHOWCASE_FIXTURE_MANIFEST);

    expect([...new Set(identities)]).toHaveLength(identities.length);
    expect(SHOWCASE_FIXTURE_MANIFEST.families.catalog.models.product).toContain("p-creatine");
    expect(SHOWCASE_FIXTURE_MANIFEST.families.checkout.models.checkoutSession).toEqual(["checkout-seed-session"]);
    expect(SHOWCASE_FIXTURE_MANIFEST.families.customers.models.customerAddress).toContain("cus_checkout_fixture");
    expect(SHOWCASE_FIXTURE_MANIFEST.families.abandonedCarts.models.checkoutSessionHistory).toContain(
      "abandoned-cart-seed-sent-email",
    );
    expect(SHOWCASE_FIXTURE_MANIFEST.families.sales.models.orderHistory).toEqual(["sales-crm-seed-order-created"]);
    expect(() => assertShowcaseFixtureManifest(SHOWCASE_FIXTURE_MANIFEST)).not.toThrow();
  });

  it("aggregates a bounded report without PII, session identifiers, or secrets", () => {
    const report = new ShowcaseResetReport("run-123");

    report.recordFamily("catalog", { created: 1, preserved: 2, updated: 3 });
    report.recordFailure(new Error("checkout-customer@entrenar.test session=checkout-seed-session token=secret-token"));
    const output = report.complete("failed", "mutex_held");
    const serialized = JSON.stringify(output);

    expect(output.families).toEqual([{ created: 1, name: "catalog", preserved: 2, updated: 3 }]);
    expect(output.failureCategory).toBe(SHOWCASE_RESET_FAILURE_CATEGORY.MUTEX_HELD);
    expect(serialized).not.toContain("checkout-customer@entrenar.test");
    expect(serialized).not.toContain("checkout-seed-session");
    expect(serialized).not.toContain("secret-token");
  });
});

describe("showcase reset mutation gate", () => {
  const databaseUrl = process.env["DATABASE_URL"];
  const gate = new MutationGate();
  const firstClient = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl ?? "" }) });
  const secondClient = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl ?? "" }) });

  beforeAll(() => {
    if (!databaseUrl) throw new Error("DATABASE_URL is required for mutation gate integration tests.");
  });

  afterAll(async () => {
    await Promise.all([firstClient.$disconnect(), secondClient.$disconnect()]);
  });

  it("waits for an exclusive holder, then completes the shared mutation", async () => {
    const holder = holdExclusiveGate();
    await holder.acquired;
    let sharedCompleted = false;
    const shared = gate.runShared(secondClient, async () => {
      sharedCompleted = true;
    });

    await wait(100);
    expect(sharedCompleted).toBe(false);

    holder.release();
    await Promise.all([holder.done, shared]);
    expect(sharedCompleted).toBe(true);
  });

  it("times out after more than ten seconds without cancelling the lock holder", async () => {
    const holder = holdSharedGate();
    await holder.acquired;
    const startedAt = Date.now();

    const timeoutError = await gate.runExclusive(secondClient, async () => undefined)
      .then(() => undefined, (error: unknown) => error);

    expect(timeoutError).toBeInstanceOf(Error);
    expect(timeoutError instanceof Error ? timeoutError.message : "").toContain("lock timeout");
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(10_000);

    holder.release();
    await expect(holder.done).resolves.toBeUndefined();
  }, 15_000);

  it("releases the advisory lock when a transaction callback rolls back", async () => {
    await expect(gate.runShared(firstClient, async () => {
      throw new Error("rollback shared mutation");
    })).rejects.toThrow("rollback shared mutation");

    await expect(gate.runExclusive(secondClient, async () => "exclusive completed")).resolves.toBe("exclusive completed");
  });

  function holdExclusiveGate(): GateHolder {
    return holdGate((callback) => gate.runExclusive(firstClient, callback));
  }

  function holdSharedGate(): GateHolder {
    return holdGate((callback) => gate.runShared(firstClient, callback));
  }
});

describe("showcase catalog and commerce restorers", () => {
  const databaseUrl = process.env["DATABASE_URL"];
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl ?? "" }) });
  const catalog = new CatalogFixtureRestorer();
  const commerce = new CommerceFixtureRestorer();

  beforeAll(() => {
    if (!databaseUrl) throw new Error("DATABASE_URL is required for showcase reset integration tests.");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("restores canonical catalog and commerce records while preserving unknown records and converging", async () => {
    const unknownCategoryId = "showcase-reset-test-unknown-category";
    const unknownProductId = "showcase-reset-test-unknown-product";
    const unknownVariantId = "showcase-reset-test-unknown-variant";
    const unknownProviderId = "showcase-reset-test-unknown-provider";
    const report = new ShowcaseResetReport("catalog-commerce-test");

    await prisma.category.upsert({
      where: { id: unknownCategoryId },
      create: { id: unknownCategoryId, name: "Visitor category", slug: unknownCategoryId, sortOrder: 99 },
      update: { name: "Visitor category", sortOrder: 99 },
    });
    await prisma.shippingProvider.upsert({
      where: { id: unknownProviderId },
      create: { id: unknownProviderId, name: "Visitor provider" },
      update: { name: "Visitor provider" },
    });
    await prisma.product.upsert({
      where: { id: unknownProductId },
      create: { id: unknownProductId, name: "Visitor product", slug: unknownProductId, publicSlug: unknownProductId, sku: unknownProductId, salePrice: "100.00", stockMode: "TRACKED", quantity: 1 },
      update: { name: "Visitor product" },
    });
    await prisma.productVariant.upsert({
      where: { id: unknownVariantId },
      create: { id: unknownVariantId, productId: unknownProductId, name: "Visitor variant", sku: unknownVariantId, stockMode: "TRACKED", quantity: 1 },
      update: { name: "Visitor variant" },
    });

    try {
      await prisma.$transaction(async (transaction) => {
        await catalog.restore(transaction, report);
        await commerce.restore(transaction, report);
        await transaction.product.update({ where: { id: "p-creatine" }, data: { name: "Changed fixture" } });
      });
      await prisma.$transaction(async (transaction) => {
        await catalog.restore(transaction, report);
        await commerce.restore(transaction, report);
      });

      await expect(prisma.product.findUniqueOrThrow({ where: { id: "p-creatine" } })).resolves.toMatchObject({ name: "Creatina Monohidrato 300g" });
      await expect(prisma.productCategory.findUnique({ where: { productId_categoryId: { productId: "p-creatine", categoryId: "cat-creatine-pre" } } })).resolves.not.toBeNull();
      await expect(prisma.productVariant.findUnique({ where: { id: "sin-sabor-300" } })).resolves.toMatchObject({ productId: "p-creatine" });
      await expect(prisma.weightBand.findUnique({ where: { id: "andreani-range-up-to-1kg" } })).resolves.toMatchObject({ shippingProviderId: "andreani", cost: expect.anything() });
      await expect(prisma.category.findUnique({ where: { id: unknownCategoryId } })).resolves.toMatchObject({ name: "Visitor category" });
      await expect(prisma.productVariant.findUnique({ where: { id: unknownVariantId } })).resolves.toMatchObject({ productId: unknownProductId, name: "Visitor variant" });
      await expect(prisma.shippingProvider.findUnique({ where: { id: unknownProviderId } })).resolves.toMatchObject({ name: "Visitor provider" });
    } finally {
      await prisma.productVariant.delete({ where: { id: unknownVariantId } });
      await prisma.product.delete({ where: { id: unknownProductId } });
      await prisma.shippingProvider.delete({ where: { id: unknownProviderId } });
      await prisma.category.delete({ where: { id: unknownCategoryId } });
    }
  });
});

describe("showcase checkout prerequisite restorer", () => {
  const databaseUrl = process.env["DATABASE_URL"];
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl ?? "" }) });
  const catalog = new CatalogFixtureRestorer();
  const checkout = new CheckoutPrerequisitesFixtureRestorer();

  beforeAll(() => {
    if (!databaseUrl) throw new Error("DATABASE_URL is required for showcase reset integration tests.");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("restores only canonical checkout prerequisites and leaves refresh sessions and redemptions untouched", async () => {
    const suffix = randomUUID();
    const visitorUserId = `showcase-reset-visitor-${suffix}`;
    const visitorCartId = `showcase-reset-visitor-cart-${suffix}`;
    const visitorItemId = `showcase-reset-visitor-item-${suffix}`;
    const visitorSessionId = `showcase-reset-visitor-session-${suffix}`;
    const visitorCustomerId = `showcase-reset-visitor-customer-${suffix}`;
    const visitorCouponId = `showcase-reset-visitor-coupon-${suffix}`;
    const adminId = `showcase-reset-admin-${suffix}`;
    const adminSessionId = `showcase-reset-admin-session-${suffix}`;
    const customerSessionId = `showcase-reset-customer-session-${suffix}`;
    const report = new ShowcaseResetReport("checkout-prerequisites-test");

    await prisma.$transaction(async (transaction) => {
      await catalog.restore(transaction, report);
      await checkout.restore(transaction, report);
    });
    const redemptionBefore = await prisma.couponRedemption.findUnique({ where: { id: "checkout-seed-redemption" } });
    await prisma.user.createMany({ data: [
      { email: `${visitorUserId}@example.test`, id: visitorUserId, passwordHash: "visitor", role: Role.CUSTOMER },
      { email: `${adminId}@example.test`, id: adminId, passwordHash: "admin", role: Role.ADMIN },
    ] });
    await prisma.refreshToken.createMany({ data: [
      { expiresAt: new Date("2030-01-01T00:00:00.000Z"), id: adminSessionId, sessionType: RefreshSessionType.ADMIN, tokenHash: `admin-${suffix}`, userId: adminId },
      { expiresAt: new Date("2030-01-01T00:00:00.000Z"), id: customerSessionId, sessionType: RefreshSessionType.CUSTOMER, tokenHash: `customer-${suffix}`, userId: "checkout-seed-customer" },
    ] });
    await prisma.cart.create({ data: { id: visitorCartId, status: CartStatus.ACTIVE, userId: visitorUserId } });
    await prisma.cartItem.create({ data: { cartId: visitorCartId, id: visitorItemId, productId: "p-creatine", quantity: 2, variantId: "sin-sabor-300" } });
    await prisma.checkoutSession.create({ data: { cartId: visitorCartId, id: visitorSessionId, tokenHash: `visitor-${suffix}`, userId: visitorUserId } });
    await prisma.customer.create({ data: { email: `${visitorCustomerId}@example.test`, fullName: "Visitor Customer", id: visitorCustomerId } });
    await prisma.customerAddress.create({ data: { city: "Visitor city", country: "Argentina", customerId: visitorCustomerId, number: "1", postalCode: "1000", provinceOrState: "Visitor province", street: "Visitor street" } });
    await prisma.coupon.create({ data: { canCombineWithPromotions: false, code: `VISITOR-${suffix}`, customerLimitType: CouponCustomerLimitType.UNLIMITED, dateLimitType: CouponDateLimitType.UNLIMITED, discountType: CouponDiscountType.PERCENTAGE, discountValue: "5.00", id: visitorCouponId, includeShippingCost: false, maxDiscountType: CouponMaxDiscountType.NONE, minimumCartAmount: "0.00", status: CouponStatus.ACTIVE, targetType: CouponTargetType.ALL_STORE, totalUsageLimitType: CouponUsageLimitType.UNLIMITED } });
    await prisma.customerAddress.create({ data: { city: "Incorrect", country: "Argentina", customerId: "cus_003", number: "0", postalCode: "0000", provinceOrState: "Incorrect", street: "Incorrect" } });
    await prisma.cart.update({ data: { status: CartStatus.COMPLETED }, where: { id: "checkout-seed-cart" } });
    await prisma.coupon.update({ data: { usageCount: 99 }, where: { id: "checkout-seed-coupon" } });

    try {
      await prisma.$transaction((transaction) => checkout.restore(transaction, report));
      await prisma.$transaction((transaction) => checkout.restore(transaction, report));

      await expect(prisma.cart.findUnique({ where: { id: "checkout-seed-cart" } })).resolves.toMatchObject({ status: CartStatus.ACTIVE, userId: "checkout-seed-customer" });
      await expect(prisma.user.findUnique({ where: { id: "checkout-seed-customer" } })).resolves.toMatchObject({ email: "checkout-customer@entrenar.test", role: Role.CUSTOMER });
      await expect(prisma.customer.findUnique({ where: { id: "cus_checkout_fixture" } })).resolves.toMatchObject({ fullName: "Checkout Fixture", userId: "checkout-seed-customer" });
      await expect(prisma.cartItem.findUnique({ where: { id: "checkout-seed-cart-item" } })).resolves.toMatchObject({ cartId: "checkout-seed-cart", productId: "p-creatine", quantity: 1, variantId: "sin-sabor-300" });
      await expect(prisma.checkoutSession.findUnique({ where: { id: "checkout-seed-session" } })).resolves.toMatchObject({ cartId: "checkout-seed-cart", userId: "checkout-seed-customer" });
      await expect(prisma.customerAddress.findUnique({ where: { customerId: "cus_003" } })).resolves.toBeNull();
      await expect(prisma.coupon.findUnique({ where: { id: "checkout-seed-coupon" } })).resolves.toMatchObject({ code: "CHECKOUT-SEED-10", usageCount: 1 });
      await expect(prisma.refreshToken.findUnique({ where: { id: adminSessionId } })).resolves.toMatchObject({ sessionType: RefreshSessionType.ADMIN, tokenHash: `admin-${suffix}` });
      await expect(prisma.refreshToken.findUnique({ where: { id: customerSessionId } })).resolves.toMatchObject({ sessionType: RefreshSessionType.CUSTOMER, tokenHash: `customer-${suffix}` });
      await expect(prisma.cart.findUnique({ where: { id: visitorCartId } })).resolves.toMatchObject({ userId: visitorUserId });
      await expect(prisma.cartItem.findUnique({ where: { id: visitorItemId } })).resolves.toMatchObject({ cartId: visitorCartId, quantity: 2 });
      await expect(prisma.checkoutSession.findUnique({ where: { id: visitorSessionId } })).resolves.toMatchObject({ userId: visitorUserId });
      await expect(prisma.customerAddress.findUnique({ where: { customerId: visitorCustomerId } })).resolves.toMatchObject({ city: "Visitor city" });
      await expect(prisma.coupon.findUnique({ where: { id: visitorCouponId } })).resolves.toMatchObject({ usageCount: 0 });
      await expect(prisma.couponRedemption.findUnique({ where: { id: "checkout-seed-redemption" } })).resolves.toEqual(redemptionBefore);
    } finally {
      await prisma.refreshToken.deleteMany({ where: { id: { in: [adminSessionId, customerSessionId] } } });
      await prisma.checkoutSession.deleteMany({ where: { id: visitorSessionId } });
      await prisma.cart.deleteMany({ where: { id: visitorCartId } });
      await prisma.customer.deleteMany({ where: { id: visitorCustomerId } });
      await prisma.coupon.deleteMany({ where: { id: visitorCouponId } });
      await prisma.user.deleteMany({ where: { id: { in: [visitorUserId, adminId] } } });
    }
  });
});

describe("showcase order-dependent CRM restorer", () => {
  const databaseUrl = process.env["DATABASE_URL"];
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl ?? "" }) });
  const catalog = new CatalogFixtureRestorer();
  const checkout = new CheckoutPrerequisitesFixtureRestorer();
  const restorer = new OrderDependentCrmFixtureRestorer();

  beforeAll(() => {
    if (!databaseUrl) throw new Error("DATABASE_URL is required for showcase reset integration tests.");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("restores explicit order families in FK order while preserving visitor rows and historical snapshots", async () => {
    const suffix = randomUUID();
    const visitorUserId = `showcase-reset-order-user-${suffix}`;
    const visitorCartId = `showcase-reset-order-cart-${suffix}`;
    const visitorOrderId = `showcase-reset-order-${suffix}`;
    const visitorPaymentId = `showcase-reset-payment-${suffix}`;
    const visitorCouponId = `showcase-reset-coupon-${suffix}`;
    const visitorRedemptionId = `showcase-reset-redemption-${suffix}`;
    const visitorHistoryId = `showcase-reset-history-${suffix}`;
    const visitorKeyId = `showcase-reset-key-${suffix}`;
    const visitorSupplierId = `showcase-reset-supplier-${suffix}`;
    const visitorSessionId = `showcase-reset-session-${suffix}`;
    const report = new ShowcaseResetReport("order-dependent-test");

    await prisma.$transaction(async (transaction) => {
      await catalog.restore(transaction, report);
      await checkout.restore(transaction, report);
      await restorer.restore(transaction, report);
    });
    await prisma.user.create({ data: { email: `${visitorUserId}@example.test`, id: visitorUserId, passwordHash: "visitor", role: Role.CUSTOMER } });
    await prisma.cart.create({ data: { id: visitorCartId, status: CartStatus.ACTIVE, userId: visitorUserId } });
    await prisma.checkoutSession.create({ data: { cartId: visitorCartId, id: visitorSessionId, tokenHash: `visitor-session-${suffix}`, userId: visitorUserId } });
    await prisma.order.create({ data: { cartId: visitorCartId, customerEmail: `${visitorUserId}@example.test`, customerFirstName: "Visitor", customerLastName: "Order", customerSnapshot: { immutable: "visitor" }, deliverySnapshot: { source: "visitor" }, deliveryType: "SHIPPING", id: visitorOrderId, number: `VIS-${suffix}`, shippingStatus: "TO_PACK", status: "PENDING", subtotal: "10.00", total: "10.00", userId: visitorUserId } });
    await prisma.orderPayment.create({ data: { amount: "10.00", id: visitorPaymentId, orderId: visitorOrderId, paymentMethodId: "visitor", paymentMethodSnapshot: { source: "visitor" }, status: "PENDING" } });
    await prisma.coupon.create({ data: { canCombineWithPromotions: false, code: `VIS-${suffix}`, customerLimitType: CouponCustomerLimitType.UNLIMITED, dateLimitType: CouponDateLimitType.UNLIMITED, discountType: CouponDiscountType.PERCENTAGE, discountValue: "5.00", id: visitorCouponId, includeShippingCost: false, maxDiscountType: CouponMaxDiscountType.NONE, minimumCartAmount: "0.00", status: CouponStatus.ACTIVE, targetType: CouponTargetType.ALL_STORE, totalUsageLimitType: CouponUsageLimitType.UNLIMITED } });
    await prisma.couponRedemption.create({ data: { couponCode: `VIS-${suffix}`, couponId: visitorCouponId, discountAmount: "1.00", id: visitorRedemptionId, orderId: visitorOrderId, userId: visitorUserId } });
    await prisma.orderHistory.create({ data: { id: visitorHistoryId, metadata: { immutable: "visitor" }, orderId: visitorOrderId, title: "Visitor history", type: "ORDER_CREATED" } });
    await prisma.checkoutIdempotencyKey.create({ data: { id: visitorKeyId, idempotencyKey: `key-${suffix}`, ownerKey: `user:${visitorUserId}`, requestHash: "visitor", status: "PENDING" } });
    await prisma.supplier.create({ data: { code: `VIS-${suffix}`, id: visitorSupplierId, name: "Visitor Supplier" } });
    try {
      await prisma.$transaction((transaction) => restorer.restore(transaction, report));
      await prisma.$transaction((transaction) => restorer.restore(transaction, report));

      await expect(prisma.order.findUnique({ where: { id: "checkout-seed-order" } })).resolves.toMatchObject({ customerSnapshot: { email: "checkout-customer@entrenar.test" }, deliverySnapshot: { providerId: "andreani" }, total: expect.anything() });
      await expect(prisma.orderItem.findUnique({ where: { id: "checkout-seed-order-item" } })).resolves.toMatchObject({ orderId: "checkout-seed-order", snapshot: { brand: "Star Nutrition" } });
      await expect(prisma.orderPayment.findUnique({ where: { id: "checkout-seed-payment" } })).resolves.toMatchObject({ orderId: "checkout-seed-order", paymentMethodId: "bank-transfer" });
      await expect(prisma.couponRedemption.findUnique({ where: { id: "checkout-seed-redemption" } })).resolves.toMatchObject({ couponId: "checkout-seed-coupon", orderId: "checkout-seed-order" });
      await expect(prisma.checkoutIdempotencyKey.findUnique({ where: { id: "checkout-seed-idempotency" } })).resolves.toMatchObject({ orderId: "checkout-seed-order", status: "COMPLETED" });
      await expect(prisma.orderHistory.findUnique({ where: { id: "sales-crm-seed-order-created" } })).resolves.toMatchObject({ orderId: "checkout-seed-order" });
      await expect(prisma.checkoutSession.findUnique({ where: { id: "abandoned-cart-seed-sent" } })).resolves.toMatchObject({ recoveryStatus: "SENT" });
      await expect(prisma.order.findUnique({ where: { id: visitorOrderId } })).resolves.toMatchObject({ customerSnapshot: { immutable: "visitor" } });
      await expect(prisma.orderPayment.findUnique({ where: { id: visitorPaymentId } })).resolves.toMatchObject({ orderId: visitorOrderId });
      await expect(prisma.couponRedemption.findUnique({ where: { id: visitorRedemptionId } })).resolves.toMatchObject({ orderId: visitorOrderId });
      await expect(prisma.orderHistory.findUnique({ where: { id: visitorHistoryId } })).resolves.toMatchObject({ metadata: { immutable: "visitor" } });
      await expect(prisma.checkoutSession.findUnique({ where: { id: visitorSessionId } })).resolves.toMatchObject({ userId: visitorUserId });
      await expect(prisma.supplier.findUnique({ where: { id: visitorSupplierId } })).resolves.toMatchObject({ name: "Visitor Supplier" });
      expect(report.complete("succeeded").families.map((family) => family.name)).toEqual(expect.arrayContaining(["abandonedCarts", "checkout", "sales"]));
    } finally {
      await prisma.checkoutIdempotencyKey.deleteMany({ where: { id: visitorKeyId } });
      await prisma.couponRedemption.deleteMany({ where: { id: visitorRedemptionId } });
      await prisma.coupon.deleteMany({ where: { id: visitorCouponId } });
      await prisma.order.deleteMany({ where: { id: visitorOrderId } });
      await prisma.checkoutSession.deleteMany({ where: { id: visitorSessionId } });
      await prisma.cart.deleteMany({ where: { id: visitorCartId } });
      await prisma.supplier.deleteMany({ where: { id: visitorSupplierId } });
      await prisma.user.deleteMany({ where: { id: visitorUserId } });
    }
  });
});

describe("showcase reset atomic inventory command", () => {
  const databaseUrl = process.env["DATABASE_URL"];
  const prisma = new PrismaService();
  const catalog = new CatalogFixtureRestorer();
  const commerce = new CommerceFixtureRestorer();
  const checkout = new CheckoutPrerequisitesFixtureRestorer();
  const orderDependent = new OrderDependentCrmFixtureRestorer();
  const mutex = new ShowcaseResetRunMutex();

  beforeAll(() => {
    if (!databaseUrl) throw new Error("DATABASE_URL is required for showcase reset integration tests.");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("reconciles changed canonical stock, preserves unknown targets and history, and makes no-op runs history-free", async () => {
    const unknownProductId = `showcase-reset-unknown-stock-${randomUUID()}`;
    const run = createResetService();
    await restoreBaseline();
    await prisma.product.create({ data: { id: unknownProductId, name: "Visitor stock", publicSlug: unknownProductId, quantity: 7, salePrice: "10.00", sku: unknownProductId, slug: unknownProductId, stockMode: StockMode.TRACKED } });
    await prisma.inventoryHistory.create({ data: { delta: 1, operation: InventoryOperation.ADD, origin: "visitor", productId: "p-creatine", resultingQuantity: 25, stockMode: StockMode.TRACKED } });
    const historyBefore = await prisma.inventoryHistory.count({ where: { productId: "p-creatine" } });
    await prisma.product.update({ data: { quantity: 2 }, where: { id: "p-creatine" } });
    await prisma.productVariant.update({ data: { quantity: 3 }, where: { id: "sin-sabor-300" } });

    try {
      const result = await run.run();
      expect(result.exitCode).toBe(SHOWCASE_RESET_EXIT_CODE.SUCCESS);
      await expect(prisma.product.findUnique({ where: { id: "p-creatine" } })).resolves.toMatchObject({ quantity: 24, stockMode: StockMode.TRACKED });
      await expect(prisma.productVariant.findUnique({ where: { id: "sin-sabor-300" } })).resolves.toMatchObject({ quantity: 24, stockMode: StockMode.TRACKED });
      await expect(prisma.product.findUnique({ where: { id: unknownProductId } })).resolves.toMatchObject({ quantity: 7, stockMode: StockMode.TRACKED });
      const reconciliations = await prisma.inventoryHistory.findMany({ where: { origin: "showcase-reset", productId: "p-creatine" } });
      expect(reconciliations).toEqual(expect.arrayContaining([
        expect.objectContaining({ delta: 22, operation: InventoryOperation.REPLACE, referenceType: InventoryReferenceType.RECONCILIATION, resultingQuantity: 24 }),
        expect.objectContaining({ delta: 21, operation: InventoryOperation.REPLACE, referenceType: InventoryReferenceType.RECONCILIATION, resultingQuantity: 24, variantId: "sin-sabor-300" }),
      ]));
      expect(await prisma.inventoryHistory.count({ where: { productId: "p-creatine" } })).toBeGreaterThan(historyBefore);

      const reconciliationCount = await prisma.inventoryHistory.count({ where: { origin: "showcase-reset" } });
      await expect(run.run()).resolves.toMatchObject({ exitCode: SHOWCASE_RESET_EXIT_CODE.SUCCESS });
      expect(await prisma.inventoryHistory.count({ where: { origin: "showcase-reset" } })).toBe(reconciliationCount);
    } finally {
      await prisma.inventoryHistory.deleteMany({ where: { productId: unknownProductId } });
      await prisma.product.deleteMany({ where: { id: unknownProductId } });
    }
  });

  it("rejects a concurrent reset and maps a shared-gate timeout to the required exit codes", async () => {
    const run = createResetService();
    let releaseMutex: (() => void) | undefined;
    let notifyMutexAcquired: (() => void) | undefined;
    const mutexAcquired = new Promise<void>((resolve) => {
      notifyMutexAcquired = resolve;
    });
    const holder = mutex.run(async () => {
      notifyMutexAcquired?.();
      await new Promise<void>((resolve) => {
        releaseMutex = resolve;
      });
    });
    await mutexAcquired;
    await expect(run.run()).resolves.toMatchObject({ exitCode: SHOWCASE_RESET_EXIT_CODE.CONCURRENT_RUN });
    releaseMutex?.();
    await holder;

    const sharedHolder = holdGate((callback) => new MutationGate().runShared(prisma, callback));
    await sharedHolder.acquired;
    const timeoutResult = await run.run();
    expect(timeoutResult.exitCode).toBe(SHOWCASE_RESET_EXIT_CODE.LOCK_TIMEOUT);
    expect(timeoutResult.report.failureCategory).toBe("lock_timeout");
    sharedHolder.release();
    await sharedHolder.done;
  }, 15_000);

  it("rolls back restored families and reconciliation history when a required family fails", async () => {
    await restoreBaseline();
    await prisma.product.update({ data: { name: "Changed before rollback", quantity: 2 }, where: { id: "p-creatine" } });
    const historyBefore = await prisma.inventoryHistory.count({ where: { origin: "showcase-reset" } });
    const failingRestorer: FixtureRestorer = {
      family: "sales",
      async restore(): Promise<void> {
        throw new Error("injected restorer failure");
      },
    };
    const run = createResetService([catalog, failingRestorer]);

    const result = await run.run();
    expect(result.exitCode).toBe(SHOWCASE_RESET_EXIT_CODE.FAILURE);
    expect(result.report.failureCategory).toBe("restoration_failed");
    await expect(prisma.product.findUnique({ where: { id: "p-creatine" } })).resolves.toMatchObject({ name: "Changed before rollback", quantity: 2 });
    expect(await prisma.inventoryHistory.count({ where: { origin: "showcase-reset" } })).toBe(historyBefore);
    await expect(createResetService().run()).resolves.toMatchObject({ exitCode: SHOWCASE_RESET_EXIT_CODE.SUCCESS });
  });

  function createResetService(restorers: readonly FixtureRestorer[] = [catalog, commerce, checkout, orderDependent]): ShowcaseResetService {
    return new ShowcaseResetService(prisma, new MutationGate(), mutex, new InventoryRepository(prisma), restorers);
  }

  async function restoreBaseline(): Promise<void> {
    const report = new ShowcaseResetReport("atomic-command-baseline");
    await prisma.$transaction(async (transaction) => {
      await catalog.restore(transaction, report);
      await commerce.restore(transaction, report);
      await checkout.restore(transaction, report);
      await orderDependent.restore(transaction, report);
    });
  }
});

interface GateHolder {
  acquired: Promise<void>;
  done: Promise<void>;
  release: () => void;
}

function holdGate(run: (callback: () => Promise<void>) => Promise<void>): GateHolder {
  let resolveAcquired: (() => void) | undefined;
  let release: (() => void) | undefined;
  const acquired = new Promise<void>((resolve) => {
    resolveAcquired = resolve;
  });
  const done = run(async () => {
    resolveAcquired?.();
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  });

  return {
    acquired,
    done,
    release: () => release?.(),
  };
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
