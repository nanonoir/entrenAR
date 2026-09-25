import * as bcrypt from "bcrypt";

import { PrismaClient } from "../../src/generated/prisma/client";
import { SHOWCASE_FIXTURE_FAMILY, assertShowcaseFixtureIds } from "../../src/modules/showcase-reset/fixtures/showcase-fixture-manifest";
import {
  CHECKOUT_FIXTURE,
  CHECKOUT_FIXTURE_PASSWORD,
  CHECKOUT_PASSWORD_SALT_ROUNDS,
  CHECKOUT_PREREQUISITES,
  INDEPENDENT_COUPON,
} from "../../src/modules/showcase-reset/fixtures/checkout-customer-baseline";
import { CHECKOUT_ORDER_FIXTURE } from "../../src/modules/showcase-reset/fixtures/order-dependent-crm-baseline";

export { CHECKOUT_FIXTURE };

export async function seedCheckout(prisma: PrismaClient): Promise<void> {
  assertShowcaseFixtureIds(SHOWCASE_FIXTURE_FAMILY.CHECKOUT, {
    cart: [CHECKOUT_FIXTURE.cartId], cartItem: [CHECKOUT_FIXTURE.cartItemId], checkoutIdempotencyKey: [CHECKOUT_FIXTURE.idempotencyId],
    checkoutSession: [CHECKOUT_FIXTURE.sessionId], coupon: [CHECKOUT_FIXTURE.couponId], couponRedemption: [CHECKOUT_ORDER_FIXTURE.redemption.id],
    order: [CHECKOUT_FIXTURE.orderId], orderItem: [CHECKOUT_FIXTURE.orderItemId], orderPayment: [CHECKOUT_FIXTURE.paymentId], user: [CHECKOUT_FIXTURE.customerId],
  });
  const existing = await prisma.user.findUnique({ where: { id: CHECKOUT_FIXTURE.customerId } });
  const passwordHash = existing && await bcrypt.compare(CHECKOUT_FIXTURE_PASSWORD, existing.passwordHash) ? existing.passwordHash : await bcrypt.hash(CHECKOUT_FIXTURE_PASSWORD, CHECKOUT_PASSWORD_SALT_ROUNDS);
  await prisma.user.upsert({ where: { id: CHECKOUT_FIXTURE.customerId }, create: { ...CHECKOUT_PREREQUISITES.user, passwordHash }, update: { email: CHECKOUT_PREREQUISITES.user.email, firstName: CHECKOUT_PREREQUISITES.user.firstName, lastName: CHECKOUT_PREREQUISITES.user.lastName, passwordHash, role: CHECKOUT_PREREQUISITES.user.role } });
  await prisma.cart.upsert({ where: { id: CHECKOUT_FIXTURE.cartId }, create: CHECKOUT_PREREQUISITES.cart, update: CHECKOUT_PREREQUISITES.cart });
  await prisma.cartItem.upsert({ where: { id: CHECKOUT_FIXTURE.cartItemId }, create: CHECKOUT_PREREQUISITES.cartItem, update: CHECKOUT_PREREQUISITES.cartItem });
  await prisma.checkoutSession.upsert({ where: { id: CHECKOUT_FIXTURE.sessionId }, create: CHECKOUT_PREREQUISITES.session, update: CHECKOUT_PREREQUISITES.session });
  await prisma.coupon.upsert({ where: { id: CHECKOUT_FIXTURE.couponId }, create: INDEPENDENT_COUPON, update: INDEPENDENT_COUPON });
  await prisma.order.upsert({ where: { id: CHECKOUT_ORDER_FIXTURE.order.id }, create: CHECKOUT_ORDER_FIXTURE.order, update: withoutId(CHECKOUT_ORDER_FIXTURE.order) });
  await prisma.orderItem.upsert({ where: { id: CHECKOUT_ORDER_FIXTURE.item.id }, create: CHECKOUT_ORDER_FIXTURE.item, update: withoutId(CHECKOUT_ORDER_FIXTURE.item) });
  await prisma.orderPayment.upsert({ where: { id: CHECKOUT_ORDER_FIXTURE.payment.id }, create: CHECKOUT_ORDER_FIXTURE.payment, update: withoutId(CHECKOUT_ORDER_FIXTURE.payment) });
  await prisma.couponRedemption.upsert({ where: { id: CHECKOUT_ORDER_FIXTURE.redemption.id }, create: CHECKOUT_ORDER_FIXTURE.redemption, update: withoutId(CHECKOUT_ORDER_FIXTURE.redemption) });
  await prisma.checkoutIdempotencyKey.upsert({ where: { id: CHECKOUT_ORDER_FIXTURE.idempotency.id }, create: CHECKOUT_ORDER_FIXTURE.idempotency, update: withoutId(CHECKOUT_ORDER_FIXTURE.idempotency) });
}

function withoutId<T extends { id: string }>(data: T): Omit<T, "id"> {
  const { id: _id, ...without } = data;
  return without;
}
