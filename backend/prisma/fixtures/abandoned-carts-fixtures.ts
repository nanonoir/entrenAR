import { PrismaClient } from "../../src/generated/prisma/client";
import { SHOWCASE_FIXTURE_FAMILY, assertShowcaseFixtureIds } from "../../src/modules/showcase-reset/fixtures/showcase-fixture-manifest";
import { ABANDONED_CART_FIXTURES, DEFAULT_RECOVERY_SETTINGS, abandonedSnapshotData, hashAbandonedFixtureToken } from "../../src/modules/showcase-reset/fixtures/order-dependent-crm-baseline";

export { ABANDONED_CART_FIXTURES, DEFAULT_RECOVERY_SETTINGS };

export async function seedAbandonedCarts(prisma: PrismaClient): Promise<void> {
  assertShowcaseFixtureIds(SHOWCASE_FIXTURE_FAMILY.ABANDONED_CARTS, {
    cart: ABANDONED_CART_FIXTURES.map((fixture) => fixture.cartId), cartItem: ABANDONED_CART_FIXTURES.flatMap((fixture) => fixture.lineItems.map((item) => item.id)),
    cartRecoverySettings: [DEFAULT_RECOVERY_SETTINGS.id], checkoutSession: ABANDONED_CART_FIXTURES.map((fixture) => fixture.sessionId), checkoutSessionHistory: ABANDONED_CART_FIXTURES.flatMap((fixture) => fixture.history.map((event) => event.id)),
  });
  await prisma.cartRecoverySettings.upsert({ where: { id: DEFAULT_RECOVERY_SETTINGS.id }, create: DEFAULT_RECOVERY_SETTINGS, update: withoutId(DEFAULT_RECOVERY_SETTINGS) });
  for (const fixture of ABANDONED_CART_FIXTURES) {
    const cart = { id: fixture.cartId, status: "ABANDONED" as const, userId: fixture.userId ?? null };
    await prisma.cart.upsert({ where: { id: cart.id }, create: cart, update: withoutId(cart) });
    for (const item of fixture.lineItems) {
      const data = { cartId: fixture.cartId, id: item.id, productId: item.productId, quantity: item.quantity, variantId: item.variantId };
      await prisma.cartItem.upsert({ where: { id: item.id }, create: data, update: withoutId(data) });
    }
    const session = { abandonedAt: fixture.abandonedAt, cartId: fixture.cartId, completedAt: null, id: fixture.sessionId, lastActivityAt: fixture.lastActivityAt, lastEmailSentAt: fixture.lastEmailSentAt ?? null, recoveryExpiresAt: fixture.recoveryExpiresAt ?? null, recoveryStatus: fixture.recoveryStatus, recoveryTokenHash: fixture.recoveryToken ? hashAbandonedFixtureToken(fixture.recoveryToken) : null, snapshotData: abandonedSnapshotData(fixture), status: "ABANDONED" as const, tokenHash: hashAbandonedFixtureToken(fixture.token), userId: fixture.userId ?? null };
    await prisma.checkoutSession.upsert({ where: { id: session.id }, create: session, update: withoutId(session) });
    for (const event of fixture.history) {
      const data = { actorId: event.actorId ?? null, actorRole: event.actorRole ?? null, checkoutSessionId: fixture.sessionId, createdAt: event.createdAt, eventType: event.eventType, id: event.id, metadata: event.metadata, notes: event.notes ?? null };
      await prisma.checkoutSessionHistory.upsert({ where: { id: event.id }, create: data, update: withoutId(data) });
    }
  }
}

function withoutId<T extends { id: string }>(data: T): Omit<T, "id"> {
  const { id: _id, ...without } = data;
  return without;
}
