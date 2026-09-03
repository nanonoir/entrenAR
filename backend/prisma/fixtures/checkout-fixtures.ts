import * as bcrypt from "bcrypt";
import { createHash } from "node:crypto";

import { PrismaClient } from "../../src/generated/prisma/client";
import {
  CartStatus,
  CheckoutIdempotencyStatus,
  CheckoutRecoveryStatus,
  CheckoutSessionStatus,
  CouponCustomerLimitType,
  CouponDateLimitType,
  CouponDiscountType,
  CouponMaxDiscountType,
  CouponStatus,
  CouponTargetType,
  CouponUsageLimitType,
  OrderDeliveryType,
  OrderStatus,
  PaymentStatus,
  Role,
} from "../../src/generated/prisma/enums";

const CHECKOUT_PASSWORD_SALT_ROUNDS = 12;
const CHECKOUT_FIXTURE_PASSWORD = process.env["CHECKOUT_FIXTURE_PASSWORD"] ?? "checkout_fixture_password_123";
const CHECKOUT_FIXTURE = {
  cartId: "checkout-seed-cart",
  cartItemId: "checkout-seed-cart-item",
  couponCode: "CHECKOUT-SEED-10",
  couponId: "checkout-seed-coupon",
  customerEmail: "checkout-customer@entrenar.test",
  customerId: "checkout-seed-customer",
  idempotencyId: "checkout-seed-idempotency",
  idempotencyKey: "checkout-seed-key",
  orderId: "checkout-seed-order",
  orderItemId: "checkout-seed-order-item",
  orderNumber: "EN-CHK-000001",
  paymentId: "checkout-seed-payment",
  sessionId: "checkout-seed-session",
  sessionToken: "checkout-seed-session-token",
} as const;

export async function seedCheckout(prisma: PrismaClient): Promise<void> {
  const existingCustomer = await prisma.user.findUnique({ where: { id: CHECKOUT_FIXTURE.customerId } });
  const passwordHash = existingCustomer && await bcrypt.compare(CHECKOUT_FIXTURE_PASSWORD, existingCustomer.passwordHash)
    ? existingCustomer.passwordHash
    : await bcrypt.hash(CHECKOUT_FIXTURE_PASSWORD, CHECKOUT_PASSWORD_SALT_ROUNDS);

  await prisma.user.upsert({
    where: { id: CHECKOUT_FIXTURE.customerId },
    create: {
      email: CHECKOUT_FIXTURE.customerEmail,
      firstName: "Checkout",
      id: CHECKOUT_FIXTURE.customerId,
      lastName: "Fixture",
      passwordHash,
      role: Role.CUSTOMER,
    },
    update: {
      email: CHECKOUT_FIXTURE.customerEmail,
      firstName: "Checkout",
      lastName: "Fixture",
      passwordHash,
      role: Role.CUSTOMER,
    },
  });

  await prisma.cart.upsert({
    where: { id: CHECKOUT_FIXTURE.cartId },
    create: {
      id: CHECKOUT_FIXTURE.cartId,
      status: CartStatus.ACTIVE,
      userId: CHECKOUT_FIXTURE.customerId,
    },
    update: {
      status: CartStatus.ACTIVE,
      userId: CHECKOUT_FIXTURE.customerId,
    },
  });

  await prisma.cartItem.upsert({
    where: { id: CHECKOUT_FIXTURE.cartItemId },
    create: {
      cartId: CHECKOUT_FIXTURE.cartId,
      id: CHECKOUT_FIXTURE.cartItemId,
      productId: "p-creatine",
      quantity: 1,
      variantId: "sin-sabor-300",
    },
    update: {
      cartId: CHECKOUT_FIXTURE.cartId,
      productId: "p-creatine",
      quantity: 1,
      variantId: "sin-sabor-300",
    },
  });

  await prisma.checkoutSession.upsert({
    where: { id: CHECKOUT_FIXTURE.sessionId },
    create: {
      cartId: CHECKOUT_FIXTURE.cartId,
      id: CHECKOUT_FIXTURE.sessionId,
      recoveryStatus: CheckoutRecoveryStatus.PENDING,
      snapshotData: {
        items: [{ productId: "p-creatine", quantity: 1, variantId: "sin-sabor-300" }],
        total: 31200,
      },
      status: CheckoutSessionStatus.ACTIVE,
      tokenHash: hashFixtureToken(CHECKOUT_FIXTURE.sessionToken),
      userId: CHECKOUT_FIXTURE.customerId,
    },
    update: {
      cartId: CHECKOUT_FIXTURE.cartId,
      recoveryStatus: CheckoutRecoveryStatus.PENDING,
      snapshotData: {
        items: [{ productId: "p-creatine", quantity: 1, variantId: "sin-sabor-300" }],
        total: 31200,
      },
      status: CheckoutSessionStatus.ACTIVE,
      tokenHash: hashFixtureToken(CHECKOUT_FIXTURE.sessionToken),
      userId: CHECKOUT_FIXTURE.customerId,
    },
  });

  await prisma.coupon.upsert({
    where: { id: CHECKOUT_FIXTURE.couponId },
    create: {
      code: CHECKOUT_FIXTURE.couponCode,
      customerLimitType: CouponCustomerLimitType.UNLIMITED,
      dateLimitType: CouponDateLimitType.UNLIMITED,
      discountType: CouponDiscountType.PERCENTAGE,
      discountValue: "10.00",
      id: CHECKOUT_FIXTURE.couponId,
      includeShippingCost: false,
      maxDiscountType: CouponMaxDiscountType.NONE,
      minimumCartAmount: "0.00",
      status: CouponStatus.ACTIVE,
      targetType: CouponTargetType.ALL_STORE,
      totalUsageLimitType: CouponUsageLimitType.UNLIMITED,
      usageCount: 1,
    },
    update: {
      code: CHECKOUT_FIXTURE.couponCode,
      customerLimitType: CouponCustomerLimitType.UNLIMITED,
      customerUsageLimit: null,
      dateLimitType: CouponDateLimitType.UNLIMITED,
      discountType: CouponDiscountType.PERCENTAGE,
      discountValue: "10.00",
      endDate: null,
      includeShippingCost: false,
      maxDiscountAmount: null,
      maxDiscountType: CouponMaxDiscountType.NONE,
      minimumCartAmount: "0.00",
      status: CouponStatus.ACTIVE,
      startDate: null,
      targetType: CouponTargetType.ALL_STORE,
      totalUsageLimit: null,
      totalUsageLimitType: CouponUsageLimitType.UNLIMITED,
      usageCount: 1,
      deletedAt: null,
    },
  });

  await prisma.order.upsert({
    where: { id: CHECKOUT_FIXTURE.orderId },
    create: {
      couponCode: CHECKOUT_FIXTURE.couponCode,
      currency: "ARS",
      customerDni: "20123456789",
      customerEmail: CHECKOUT_FIXTURE.customerEmail,
      customerFirstName: "Checkout",
      customerLastName: "Fixture",
      customerPhone: "+54 11 5555-5555",
      customerSnapshot: {
        dni: "20123456789",
        email: CHECKOUT_FIXTURE.customerEmail,
        firstName: "Checkout",
        lastName: "Fixture",
        phone: "+54 11 5555-5555",
      },
      deliverySnapshot: {
        methodId: "andreani:envío-a-domicilio",
        providerId: "andreani",
        providerName: "Andreani",
      },
      deliveryType: OrderDeliveryType.SHIPPING,
      discountAmount: "3120.00",
      discountSnapshot: {
        couponCode: CHECKOUT_FIXTURE.couponCode,
        couponDiscount: 3120,
        couponType: "percentage",
      },
      id: CHECKOUT_FIXTURE.orderId,
      number: CHECKOUT_FIXTURE.orderNumber,
      shippingAddressSnapshot: {
        city: "Buenos Aires",
        postalCode: "C1000",
        province: "Buenos Aires",
        recipient: "Checkout Fixture",
        street: "123 Test Street",
      },
      shippingCost: "0.00",
      status: OrderStatus.PENDING,
      subtotal: "31200.00",
      total: "28080.00",
      userId: CHECKOUT_FIXTURE.customerId,
    },
    update: {
      couponCode: CHECKOUT_FIXTURE.couponCode,
      currency: "ARS",
      customerDni: "20123456789",
      customerEmail: CHECKOUT_FIXTURE.customerEmail,
      customerFirstName: "Checkout",
      customerLastName: "Fixture",
      customerPhone: "+54 11 5555-5555",
      customerSnapshot: {
        dni: "20123456789",
        email: CHECKOUT_FIXTURE.customerEmail,
        firstName: "Checkout",
        lastName: "Fixture",
        phone: "+54 11 5555-5555",
      },
      deliverySnapshot: {
        methodId: "andreani:envío-a-domicilio",
        providerId: "andreani",
        providerName: "Andreani",
      },
      deliveryType: OrderDeliveryType.SHIPPING,
      discountAmount: "3120.00",
      discountSnapshot: {
        couponCode: CHECKOUT_FIXTURE.couponCode,
        couponDiscount: 3120,
        couponType: "percentage",
      },
      number: CHECKOUT_FIXTURE.orderNumber,
      shippingAddressSnapshot: {
        city: "Buenos Aires",
        postalCode: "C1000",
        province: "Buenos Aires",
        recipient: "Checkout Fixture",
        street: "123 Test Street",
      },
      shippingCost: "0.00",
      status: OrderStatus.PENDING,
      subtotal: "31200.00",
      total: "28080.00",
      userId: CHECKOUT_FIXTURE.customerId,
    },
  });

  await prisma.orderItem.upsert({
    where: { id: CHECKOUT_FIXTURE.orderItemId },
    create: {
      attributes: { option: "sin-sabor-300" },
      compareAtPrice: null,
      id: CHECKOUT_FIXTURE.orderItemId,
      lineSubtotal: "31200.00",
      orderId: CHECKOUT_FIXTURE.orderId,
      productId: "p-creatine",
      productName: "Creatina Monohidrato 300g",
      quantity: 1,
      sku: "SUP-CREA-300-SIN-SABOR-300",
      snapshot: {
        brand: "Star Nutrition",
        name: "Creatina Monohidrato 300g",
        weightGrams: null,
      },
      unitPrice: "31200.00",
      variantId: "sin-sabor-300",
      variantName: "Sin sabor",
      weightGrams: null,
    },
    update: {
      attributes: { option: "sin-sabor-300" },
      compareAtPrice: null,
      lineSubtotal: "31200.00",
      orderId: CHECKOUT_FIXTURE.orderId,
      productId: "p-creatine",
      productName: "Creatina Monohidrato 300g",
      quantity: 1,
      sku: "SUP-CREA-300-SIN-SABOR-300",
      snapshot: {
        brand: "Star Nutrition",
        name: "Creatina Monohidrato 300g",
        weightGrams: null,
      },
      unitPrice: "31200.00",
      variantId: "sin-sabor-300",
      variantName: "Sin sabor",
      weightGrams: null,
    },
  });

  await prisma.orderPayment.upsert({
    where: { id: CHECKOUT_FIXTURE.paymentId },
    create: {
      amount: "28080.00",
      bankTransferSnapshot: {
        alias: "ENTRENAR.DEMO",
        bankName: "Banco Demo",
        cbuCvu: "0000000000000000000000",
        holderName: "EntrenAR Demo",
      },
      currency: "ARS",
      id: CHECKOUT_FIXTURE.paymentId,
      orderId: CHECKOUT_FIXTURE.orderId,
      paymentMethodId: "bank-transfer",
      paymentMethodSnapshot: {
        id: "bank-transfer",
        name: "Transferencia Bancaria",
        optionId: "direct-transfer",
      },
      paymentOptionId: "direct-transfer",
      status: PaymentStatus.PENDING,
    },
    update: {
      amount: "28080.00",
      bankTransferSnapshot: {
        alias: "ENTRENAR.DEMO",
        bankName: "Banco Demo",
        cbuCvu: "0000000000000000000000",
        holderName: "EntrenAR Demo",
      },
      currency: "ARS",
      orderId: CHECKOUT_FIXTURE.orderId,
      paymentMethodId: "bank-transfer",
      paymentMethodSnapshot: {
        id: "bank-transfer",
        name: "Transferencia Bancaria",
        optionId: "direct-transfer",
      },
      paymentOptionId: "direct-transfer",
      status: PaymentStatus.PENDING,
    },
  });

  await prisma.couponRedemption.upsert({
    where: { id: "checkout-seed-redemption" },
    create: {
      couponCode: CHECKOUT_FIXTURE.couponCode,
      couponId: CHECKOUT_FIXTURE.couponId,
      customerKeyHash: hashFixtureToken(CHECKOUT_FIXTURE.customerEmail),
      discountAmount: "3120.00",
      id: "checkout-seed-redemption",
      orderId: CHECKOUT_FIXTURE.orderId,
      userId: CHECKOUT_FIXTURE.customerId,
    },
    update: {
      couponCode: CHECKOUT_FIXTURE.couponCode,
      couponId: CHECKOUT_FIXTURE.couponId,
      customerKeyHash: hashFixtureToken(CHECKOUT_FIXTURE.customerEmail),
      discountAmount: "3120.00",
      orderId: CHECKOUT_FIXTURE.orderId,
      userId: CHECKOUT_FIXTURE.customerId,
    },
  });

  await prisma.checkoutIdempotencyKey.upsert({
    where: { id: CHECKOUT_FIXTURE.idempotencyId },
    create: {
      completedAt: new Date("2026-08-31T00:00:00.000Z"),
      id: CHECKOUT_FIXTURE.idempotencyId,
      idempotencyKey: CHECKOUT_FIXTURE.idempotencyKey,
      orderId: CHECKOUT_FIXTURE.orderId,
      ownerKey: `user:${CHECKOUT_FIXTURE.customerId}`,
      requestHash: hashFixtureToken(`${CHECKOUT_FIXTURE.orderId}:${CHECKOUT_FIXTURE.idempotencyKey}`),
      responseSnapshot: {
        number: CHECKOUT_FIXTURE.orderNumber,
        ok: true,
        orderId: CHECKOUT_FIXTURE.orderId,
      },
      status: CheckoutIdempotencyStatus.COMPLETED,
    },
    update: {
      completedAt: new Date("2026-08-31T00:00:00.000Z"),
      idempotencyKey: CHECKOUT_FIXTURE.idempotencyKey,
      orderId: CHECKOUT_FIXTURE.orderId,
      ownerKey: `user:${CHECKOUT_FIXTURE.customerId}`,
      requestHash: hashFixtureToken(`${CHECKOUT_FIXTURE.orderId}:${CHECKOUT_FIXTURE.idempotencyKey}`),
      responseSnapshot: {
        number: CHECKOUT_FIXTURE.orderNumber,
        ok: true,
        orderId: CHECKOUT_FIXTURE.orderId,
      },
      status: CheckoutIdempotencyStatus.COMPLETED,
    },
  });
}

function hashFixtureToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
