import { createHash, randomUUID } from "node:crypto";

import { PrismaClient } from "../../src/generated/prisma/client";
import { CatalogVisibility, Role, StockMode } from "../../src/generated/prisma/enums";

export function hashCheckoutToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export interface CheckoutDomainFixtureScope {
  categoryIds: string[];
  couponIds: string[];
  cartIds: string[];
  productIds: string[];
  sessionIds: string[];
  userIds: string[];
}

export function createCheckoutDomainFixtureScope(): CheckoutDomainFixtureScope {
  return {
    categoryIds: [],
    couponIds: [],
    cartIds: [],
    productIds: [],
    sessionIds: [],
    userIds: [],
  };
}

export interface DomainFixtureUser {
  email: string;
  id: string;
}

export interface DomainProductFixture {
  productId: string;
  variantId: string;
}

export interface DomainCartFixture {
  cartId: string;
  sessionId: string;
  sessionToken: string;
}

export async function createCheckoutDomainUser(
  prisma: PrismaClient,
  label: string,
  suffix: string,
  scope: CheckoutDomainFixtureScope,
): Promise<DomainFixtureUser> {
  const id = `checkout-domain-${label}-${suffix}`;
  const email = `${id}@example.test`;
  await prisma.user.create({ data: { email, id, passwordHash: "integration-fixture", role: Role.CUSTOMER } });
  scope.userIds.push(id);
  return { email, id };
}

export async function createCheckoutDomainProduct(
  prisma: PrismaClient,
  label: string,
  suffix: string,
  quantity: number,
  scope: CheckoutDomainFixtureScope,
): Promise<DomainProductFixture> {
  const categoryId = `checkout-domain-category-${label}-${suffix}`;
  const productId = `checkout-domain-product-${label}-${suffix}`;
  const variantId = `checkout-domain-variant-${label}-${suffix}`;
  await prisma.category.create({ data: { id: categoryId, name: `Checkout ${label} category`, slug: `${categoryId}-slug`, visibility: CatalogVisibility.VISIBLE } });
  await prisma.product.create({
    data: {
      id: productId,
      name: `${label[0]?.toLocaleUpperCase() ?? "C"}${label.slice(1)} fixture product`,
      publicSlug: `${productId}-public`,
      quantity,
      salePrice: "100.00",
      sku: `CHECKOUT-DOMAIN-${label.toLocaleUpperCase()}-${suffix}`,
      slug: `${productId}-admin`,
      stockMode: StockMode.TRACKED,
      variants: {
        create: {
          id: variantId,
          isDefault: true,
          name: "Fixture variant",
          price: "50.00",
          quantity,
          sku: `CHECKOUT-DOMAIN-VARIANT-${label.toLocaleUpperCase()}-${suffix}`,
          stockMode: StockMode.TRACKED,
        },
      },
      visibility: CatalogVisibility.VISIBLE,
      weightGrams: 100,
    },
  });
  await prisma.productCategory.create({ data: { categoryId, productId } });
  scope.categoryIds.push(categoryId);
  scope.productIds.push(productId);
  return { productId, variantId };
}

export async function createCheckoutDomainCart(
  prisma: PrismaClient,
  userId: string | undefined,
  product: DomainProductFixture,
  quantity: number,
  sessionToken: string | undefined,
  suffix: string,
  scope: CheckoutDomainFixtureScope,
  createSession = true,
): Promise<DomainCartFixture> {
  const cartId = `checkout-domain-cart-${suffix}-${randomUUID()}`;
  const token = sessionToken ?? `checkout-domain-token-${suffix}-${randomUUID()}`;
  const sessionId = `checkout-domain-session-${suffix}-${randomUUID()}`;
  await prisma.cart.create({
    data: {
      id: cartId,
      items: { create: { productId: product.productId, quantity, variantId: product.variantId } },
      ...(userId ? { userId } : {}),
    },
  });
  if (createSession) {
    await prisma.checkoutSession.create({ data: { cartId, id: sessionId, tokenHash: hashCheckoutToken(token), ...(userId ? { userId } : {}) } });
  }
  scope.cartIds.push(cartId);
  if (createSession) scope.sessionIds.push(sessionId);
  return { cartId, sessionId, sessionToken: token };
}

export async function deleteCheckoutDomainFixtures(prisma: PrismaClient, scope: CheckoutDomainFixtureScope): Promise<void> {
  if (scope.userIds.length > 0) {
    await prisma.couponRedemption.deleteMany({ where: { order: { userId: { in: scope.userIds } } } });
    await prisma.checkoutIdempotencyKey.deleteMany({ where: { order: { userId: { in: scope.userIds } } } });
    await prisma.order.deleteMany({ where: { userId: { in: scope.userIds } } });
  }
  if (scope.couponIds.length > 0) await prisma.coupon.deleteMany({ where: { id: { in: scope.couponIds } } });
  if (scope.sessionIds.length > 0) await prisma.checkoutSession.deleteMany({ where: { id: { in: scope.sessionIds } } });
  if (scope.cartIds.length > 0) {
    await prisma.cartItem.deleteMany({ where: { cartId: { in: scope.cartIds } } });
    await prisma.cart.deleteMany({ where: { id: { in: scope.cartIds } } });
  }
  if (scope.productIds.length > 0) {
    await prisma.productCategory.deleteMany({ where: { productId: { in: scope.productIds } } });
  }
  if (scope.categoryIds.length > 0) await prisma.category.deleteMany({ where: { id: { in: scope.categoryIds } } });
  if (scope.userIds.length > 0) await prisma.user.deleteMany({ where: { id: { in: scope.userIds } } });
}
