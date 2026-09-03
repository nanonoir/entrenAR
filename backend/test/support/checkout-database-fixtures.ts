import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

import * as bcrypt from "bcrypt";
import { HttpException } from "@nestjs/common";

import { PrismaService } from "../../src/common/prisma/prisma.service";
import { Prisma, PrismaClient } from "../../src/generated/prisma/client";
import {
  CatalogVisibility,
  PaymentMethodStatus,
  Role,
  ShippingProviderStatus,
  StockMode,
} from "../../src/generated/prisma/enums";

import { hashCheckoutToken } from "./checkout-domain-fixtures";
import {
  type CartFixture,
  type CheckoutFixtures,
  type FixtureUser,
  type ProductFixture,
} from "./checkout-http.types";

const execFileAsync = promisify(execFile);

export const CHECKOUT_SEED_FIXTURE = {
  cartId: "checkout-seed-cart",
  cartItemId: "checkout-seed-cart-item",
  couponId: "checkout-seed-coupon",
  idempotencyId: "checkout-seed-idempotency",
  idempotencyKey: "checkout-seed-key",
  orderId: "checkout-seed-order",
  orderItemId: "checkout-seed-order-item",
  paymentId: "checkout-seed-payment",
  redemptionId: "checkout-seed-redemption",
  sessionId: "checkout-seed-session",
} as const;

export interface CheckoutState {
  cartItemCount: number;
  orderCount: number;
  variantQuantity: number | null;
}

export type PaymentMethodSnapshot = Prisma.PaymentMethodConfigGetPayload<Record<string, never>>;
export type ShippingProviderSnapshot = Prisma.ShippingProviderGetPayload<{ include: { weightBands: true } }>;

export async function runCheckoutSeed(
  adminEmail: string,
  adminPassword: string,
  errorPrefix = "Checkout seed",
): Promise<void> {
  const { stderr } = await execFileAsync(process.execPath, ["./node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ADMIN_EMAIL: adminEmail,
      ADMIN_PASSWORD: adminPassword,
    },
    timeout: 60_000,
  });

  if (stderr) throw new Error(`${errorPrefix} wrote to stderr: ${stderr}`);
}

export async function createCheckoutFixtures(prisma: PrismaService): Promise<CheckoutFixtures> {
  const suffix = randomUUID().replaceAll("-", "");
  const categoryId = `checkout-api-category-${suffix}`;
  await prisma.category.create({ data: { id: categoryId, name: "Checkout API category", slug: `checkout-api-category-${suffix}`, visibility: CatalogVisibility.VISIBLE } });

  const owner = await createCheckoutUser(prisma, "owner", Role.CUSTOMER, suffix);
  const foreign = await createCheckoutUser(prisma, "foreign", Role.CUSTOMER, suffix);
  const admin = await createCheckoutUser(prisma, "admin", Role.ADMIN, suffix);
  const guestOwner = await createCheckoutUser(prisma, "guest", Role.CUSTOMER, suffix);
  const raceFirst = await createCheckoutUser(prisma, "race-first", Role.CUSTOMER, suffix);
  const raceSecond = await createCheckoutUser(prisma, "race-second", Role.CUSTOMER, suffix);
  const replayOwner = await createCheckoutUser(prisma, "replay", Role.CUSTOMER, suffix);
  const staleOwner = await createCheckoutUser(prisma, "stale", Role.CUSTOMER, suffix);
  const validationOwner = await createCheckoutUser(prisma, "validation", Role.CUSTOMER, suffix);
  const customerProduct = await createCheckoutProduct(prisma, categoryId, "customer", suffix, 2);
  const guestProduct = await createCheckoutProduct(prisma, categoryId, "guest", suffix, 3);
  const raceProduct = await createCheckoutProduct(prisma, categoryId, "race", suffix, 1);
  const replayProduct = await createCheckoutProduct(prisma, categoryId, "replay", suffix, 2);
  const staleProduct = await createCheckoutProduct(prisma, categoryId, "stale", suffix, 1);
  const validationProduct = await createCheckoutProduct(prisma, categoryId, "validation", suffix, 2);
  const hiddenProduct = await createCheckoutProduct(prisma, categoryId, "hidden", suffix, 1, CatalogVisibility.HIDDEN);
  const customerCart = await createCheckoutCart(prisma, owner.id, customerProduct, 1, `customer-session-${suffix}`, suffix);
  const guestCart = await createCheckoutCart(prisma, undefined, guestProduct, 1, `guest-session-${suffix}`, suffix);
  const raceFirstCart = await createCheckoutCart(prisma, raceFirst.id, raceProduct, 1, `race-first-session-${suffix}`, suffix);
  const raceSecondCart = await createCheckoutCart(prisma, raceSecond.id, raceProduct, 1, `race-second-session-${suffix}`, suffix);
  const replayCart = await createCheckoutCart(prisma, replayOwner.id, replayProduct, 1, `replay-session-${suffix}`, suffix);
  const staleCart = await createCheckoutCart(prisma, staleOwner.id, staleProduct, 1, undefined, suffix, false);
  const validationCart = await createCheckoutCart(prisma, validationOwner.id, validationProduct, 1, `validation-session-${suffix}`, suffix);

  return {
    admin,
    categoryId,
    customerCart,
    customerProduct,
    foreign,
    guestCart,
    guestOwner,
    guestProduct,
    hiddenProduct,
    owner,
    raceFirst,
    raceFirstCart,
    raceProduct,
    raceSecond,
    raceSecondCart,
    replayCart,
    replayOwner,
    replayProduct,
    staleCart,
    staleOwner,
    staleProduct,
    suffix,
    validationCart,
    validationOwner,
    validationProduct,
  };
}

export async function deleteCheckoutFixtures(prisma: PrismaClient, fixtures: CheckoutFixtures): Promise<void> {
  const userIds = [
    fixtures.owner.id,
    fixtures.foreign.id,
    fixtures.admin.id,
    fixtures.guestOwner.id,
    fixtures.raceFirst.id,
    fixtures.raceSecond.id,
    fixtures.replayOwner.id,
    fixtures.staleOwner.id,
    fixtures.validationOwner.id,
  ];
  await prisma.couponRedemption.deleteMany({ where: { order: { userId: { in: userIds } } } });
  await prisma.checkoutIdempotencyKey.deleteMany({ where: { order: { userId: { in: userIds } } } });
  await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.checkoutSession.deleteMany({ where: { userId: { in: userIds } } });
  const cartIds = [
    fixtures.customerCart.cartId,
    fixtures.guestCart.cartId,
    fixtures.raceFirstCart.cartId,
    fixtures.raceSecondCart.cartId,
    fixtures.replayCart.cartId,
    fixtures.staleCart.cartId,
    fixtures.validationCart.cartId,
  ];
  await prisma.checkoutSession.deleteMany({ where: { cartId: { in: cartIds } } });
  await prisma.cart.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.cart.deleteMany({ where: { id: { in: cartIds } } });
  const productIds = [
    fixtures.customerProduct.productId,
    fixtures.guestProduct.productId,
    fixtures.raceProduct.productId,
    fixtures.replayProduct.productId,
    fixtures.staleProduct.productId,
    fixtures.validationProduct.productId,
    fixtures.hiddenProduct.productId,
  ];
  await prisma.productCategory.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.category.deleteMany({ where: { id: fixtures.categoryId } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

export async function configureCheckoutCommerce(prisma: PrismaClient): Promise<void> {
  await prisma.paymentMethodConfig.update({
    data: {
      bankConfig: {
        alias: "ENTRENAR.TEST",
        bankName: "Banco Test",
        cbuCvu: "0000000000000000000000",
        cuitCuil: "20-00000000-0",
        holderName: "EntrenAR Test",
      },
      selectedOptionId: "direct-transfer",
      status: PaymentMethodStatus.ACTIVE,
    },
    where: { id: "bank-transfer" },
  });
  const provider = await prisma.shippingProvider.findUniqueOrThrow({ include: { weightBands: true }, where: { id: "andreani" } });
  await prisma.shippingProvider.update({
    data: {
      enabledModalities: ["home_delivery"],
      freeShippingThreshold: null,
      originCity: "Buenos Aires",
      originEmail: "origin@example.test",
      originNumber: "123",
      originPhone: "+54 11 5555-5555",
      originPostalCode: "C1000",
      originProvince: "Buenos Aires",
      originSenderName: "EntrenAR",
      originStreet: "Main Street",
      status: ShippingProviderStatus.ACTIVE,
    },
    where: { id: provider.id },
  });
  for (const band of provider.weightBands) await prisma.weightBand.update({ data: { cost: "100.00" }, where: { id: band.id } });
}

export async function restorePaymentMethod(prisma: PrismaClient, snapshot: PaymentMethodSnapshot): Promise<void> {
  await prisma.paymentMethodConfig.update({
    data: {
      bankConfig: snapshot.bankConfig === null ? Prisma.DbNull : snapshot.bankConfig,
      selectedOptionId: snapshot.selectedOptionId,
      status: snapshot.status,
    },
    where: { id: snapshot.id },
  });
}

export async function restoreShippingProvider(prisma: PrismaClient, snapshot: ShippingProviderSnapshot): Promise<void> {
  await prisma.shippingProvider.update({
    data: {
      enabledModalities: jsonInput(snapshot.enabledModalities),
      freeShippingThreshold: snapshot.freeShippingThreshold,
      originApartment: snapshot.originApartment,
      originCity: snapshot.originCity,
      originCuitCuil: snapshot.originCuitCuil,
      originEmail: snapshot.originEmail,
      originFloor: snapshot.originFloor,
      originNumber: snapshot.originNumber,
      originPhone: snapshot.originPhone,
      originPostalCode: snapshot.originPostalCode,
      originProvince: snapshot.originProvince,
      originReference: snapshot.originReference,
      originSenderName: snapshot.originSenderName,
      originStreet: snapshot.originStreet,
      status: snapshot.status,
    },
    where: { id: snapshot.id },
  });
  for (const band of snapshot.weightBands) await prisma.weightBand.update({ data: { cost: band.cost }, where: { id: band.id } });
}

export async function readCheckoutState(
  prisma: PrismaClient,
  cart: CartFixture,
  product: ProductFixture,
  userId: string,
): Promise<CheckoutState> {
  const [variant, cartRecord, orderCount] = await Promise.all([
    prisma.productVariant.findUniqueOrThrow({ select: { quantity: true }, where: { id: product.variantId } }),
    prisma.cart.findUniqueOrThrow({ include: { items: true }, where: { id: cart.cartId } }),
    prisma.order.count({ where: { userId } }),
  ]);
  return { cartItemCount: cartRecord.items.length, orderCount, variantQuantity: variant.quantity };
}

export function jsonInput(value: Prisma.JsonValue): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
}

export async function expectCheckoutCode(operation: Promise<unknown>, expected: string): Promise<void> {
  try {
    await operation;
  } catch (error) {
    expect(checkoutErrorCode(error)).toBe(expected);
    return;
  }
  throw new Error(`Expected ${expected}.`);
}

export function checkoutErrorCode(error: unknown): string | undefined {
  if (!(error instanceof HttpException)) return undefined;
  const response = error.getResponse();
  return typeof response === "object" && response !== null && "code" in response && typeof response.code === "string"
    ? response.code
    : undefined;
}

function createCheckoutUser(prisma: PrismaService, label: string, role: Role, suffix: string): Promise<FixtureUser> {
  const id = `checkout-api-${label}-${suffix}`;
  const password = `Checkout-${label}-${suffix}-A1!`;
  const email = `${id}@example.test`;
  return bcrypt.hash(password, 4).then(async (passwordHash) => {
    await prisma.user.create({ data: { email, id, passwordHash, role } });
    return { email, id, password };
  });
}

async function createCheckoutProduct(
  prisma: PrismaService,
  categoryId: string,
  label: string,
  suffix: string,
  quantity: number,
  visibility: CatalogVisibility = CatalogVisibility.VISIBLE,
): Promise<ProductFixture> {
  const productId = `checkout-api-product-${label}-${suffix}`;
  const variantId = `checkout-api-variant-${label}-${suffix}`;
  await prisma.product.create({
    data: {
      id: productId,
      name: `${label[0]?.toLocaleUpperCase() ?? "C"}${label.slice(1)} fixture product`,
      publicSlug: `${productId}-public`,
      quantity,
      salePrice: "100.00",
      sku: `CHECKOUT-API-${label.toLocaleUpperCase()}-${suffix}`,
      slug: `${productId}-admin`,
      stockMode: StockMode.TRACKED,
      variants: {
        create: {
          id: variantId,
          isDefault: true,
          name: "Fixture variant",
          price: "50.00",
          quantity,
          sku: `CHECKOUT-API-VARIANT-${label.toLocaleUpperCase()}-${suffix}`,
          stockMode: StockMode.TRACKED,
        },
      },
      visibility,
      weightGrams: 100,
    },
  });
  await prisma.productCategory.create({ data: { categoryId, productId } });
  return { productId, variantId };
}

async function createCheckoutCart(
  prisma: PrismaService,
  userId: string | undefined,
  product: ProductFixture,
  quantity: number,
  token: string | undefined,
  suffix: string,
  createSession = true,
): Promise<CartFixture> {
  const cartId = `checkout-api-cart-${suffix}-${randomUUID()}`;
  const sessionToken = token ?? `checkout-api-token-${suffix}-${randomUUID()}`;
  await prisma.cart.create({
    data: {
      id: cartId,
      items: { create: { productId: product.productId, quantity, variantId: product.variantId } },
      ...(userId ? { userId } : {}),
    },
  });
  if (createSession) {
    await prisma.checkoutSession.create({
      data: {
        cartId,
        id: `checkout-api-session-${suffix}-${randomUUID()}`,
        tokenHash: hashCheckoutToken(sessionToken),
        ...(userId ? { userId } : {}),
      },
    });
  }
  return { cartId, sessionToken };
}
