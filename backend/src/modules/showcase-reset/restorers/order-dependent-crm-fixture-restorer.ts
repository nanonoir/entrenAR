import type { Prisma } from "../../../generated/prisma/client";
import type { ShowcaseResetReport } from "../showcase-reset.report";
import { CHECKOUT_FIXTURE } from "../fixtures/checkout-customer-baseline";
import {
  ABANDONED_CART_FIXTURES,
  CHECKOUT_ORDER_FIXTURE,
  CHECKOUT_ORDER_HISTORY,
  DEFAULT_RECOVERY_SETTINGS,
  SUPPLIERS,
  abandonedSnapshotData,
  hashAbandonedFixtureToken,
} from "../fixtures/order-dependent-crm-baseline";

export class OrderDependentCrmFixtureRestorer {
  readonly family = "sales" as const;

  async restore(transaction: Prisma.TransactionClient, report: ShowcaseResetReport): Promise<void> {
    await this.restoreCheckoutOrder(transaction, report);
    await this.restoreAbandonedCarts(transaction, report);
    await this.restoreSales(transaction, report);
  }

  private async restoreCheckoutOrder(transaction: Prisma.TransactionClient, report: ShowcaseResetReport): Promise<void> {
    const preserved = await this.countCheckoutPreserved(transaction);
    let created = 0;
    let updated = 0;
    const orderExists = await transaction.order.findUnique({ where: { id: CHECKOUT_ORDER_FIXTURE.order.id }, select: { id: true } });
    await transaction.order.upsert({ where: { id: CHECKOUT_ORDER_FIXTURE.order.id }, create: CHECKOUT_ORDER_FIXTURE.order, update: withoutId(CHECKOUT_ORDER_FIXTURE.order) });
    orderExists ? updated++ : created++;

    const itemExists = await transaction.orderItem.findUnique({ where: { id: CHECKOUT_ORDER_FIXTURE.item.id }, select: { id: true } });
    await transaction.orderItem.upsert({ where: { id: CHECKOUT_ORDER_FIXTURE.item.id }, create: CHECKOUT_ORDER_FIXTURE.item, update: withoutId(CHECKOUT_ORDER_FIXTURE.item) });
    itemExists ? updated++ : created++;
    const paymentExists = await transaction.orderPayment.findUnique({ where: { id: CHECKOUT_ORDER_FIXTURE.payment.id }, select: { id: true } });
    await transaction.orderPayment.upsert({ where: { id: CHECKOUT_ORDER_FIXTURE.payment.id }, create: CHECKOUT_ORDER_FIXTURE.payment, update: withoutId(CHECKOUT_ORDER_FIXTURE.payment) });
    paymentExists ? updated++ : created++;
    const redemptionExists = await transaction.couponRedemption.findUnique({ where: { id: CHECKOUT_ORDER_FIXTURE.redemption.id }, select: { id: true } });
    await transaction.couponRedemption.upsert({ where: { id: CHECKOUT_ORDER_FIXTURE.redemption.id }, create: CHECKOUT_ORDER_FIXTURE.redemption, update: withoutId(CHECKOUT_ORDER_FIXTURE.redemption) });
    redemptionExists ? updated++ : created++;
    const idempotencyExists = await transaction.checkoutIdempotencyKey.findUnique({ where: { id: CHECKOUT_ORDER_FIXTURE.idempotency.id }, select: { id: true } });
    await transaction.checkoutIdempotencyKey.upsert({ where: { id: CHECKOUT_ORDER_FIXTURE.idempotency.id }, create: CHECKOUT_ORDER_FIXTURE.idempotency, update: withoutId(CHECKOUT_ORDER_FIXTURE.idempotency) });
    idempotencyExists ? updated++ : created++;
    report.recordFamily("checkout", { created, preserved, updated });
  }

  private async restoreAbandonedCarts(transaction: Prisma.TransactionClient, report: ShowcaseResetReport): Promise<void> {
    const preserved = await this.countAbandonedPreserved(transaction);
    let created = 0;
    let updated = 0;
    const settingsExists = await transaction.cartRecoverySettings.findUnique({ where: { id: DEFAULT_RECOVERY_SETTINGS.id }, select: { id: true } });
    await transaction.cartRecoverySettings.upsert({ where: { id: DEFAULT_RECOVERY_SETTINGS.id }, create: DEFAULT_RECOVERY_SETTINGS, update: withoutId(DEFAULT_RECOVERY_SETTINGS) });
    settingsExists ? updated++ : created++;

    for (const fixture of ABANDONED_CART_FIXTURES) {
      const cart = { id: fixture.cartId, status: "ABANDONED" as const, userId: fixture.userId ?? null };
      const cartExists = await transaction.cart.findUnique({ where: { id: cart.id }, select: { id: true } });
      await transaction.cart.upsert({ where: { id: cart.id }, create: cart, update: withoutId(cart) });
      cartExists ? updated++ : created++;
      for (const item of fixture.lineItems) {
        const data = { cartId: fixture.cartId, id: item.id, productId: item.productId, quantity: item.quantity, variantId: item.variantId };
        const exists = await transaction.cartItem.findUnique({ where: { id: item.id }, select: { id: true } });
        await transaction.cartItem.upsert({ where: { id: item.id }, create: data, update: withoutId(data) });
        exists ? updated++ : created++;
      }
      const session = { abandonedAt: fixture.abandonedAt, cartId: fixture.cartId, completedAt: null, id: fixture.sessionId, lastActivityAt: fixture.lastActivityAt, lastEmailSentAt: fixture.lastEmailSentAt ?? null, recoveryExpiresAt: fixture.recoveryExpiresAt ?? null, recoveryStatus: fixture.recoveryStatus, recoveryTokenHash: fixture.recoveryToken ? hashAbandonedFixtureToken(fixture.recoveryToken) : null, snapshotData: abandonedSnapshotData(fixture), status: "ABANDONED" as const, tokenHash: hashAbandonedFixtureToken(fixture.token), userId: fixture.userId ?? null };
      const sessionExists = await transaction.checkoutSession.findUnique({ where: { id: session.id }, select: { id: true } });
      await transaction.checkoutSession.upsert({ where: { id: session.id }, create: session, update: withoutId(session) });
      sessionExists ? updated++ : created++;
      for (const event of fixture.history) {
        const data = { actorId: event.actorId ?? null, actorRole: event.actorRole ?? null, checkoutSessionId: fixture.sessionId, createdAt: event.createdAt, eventType: event.eventType, id: event.id, metadata: event.metadata, notes: event.notes ?? null };
        const exists = await transaction.checkoutSessionHistory.findUnique({ where: { id: event.id }, select: { id: true } });
        await transaction.checkoutSessionHistory.upsert({ where: { id: event.id }, create: data, update: withoutId(data) });
        exists ? updated++ : created++;
      }
    }
    report.recordFamily("abandonedCarts", { created, preserved, updated });
  }

  private async restoreSales(transaction: Prisma.TransactionClient, report: ShowcaseResetReport): Promise<void> {
    const preserved = await this.countSalesPreserved(transaction);
    let created = 0;
    let updated = 0;
    for (const supplier of SUPPLIERS) {
      const exists = await transaction.supplier.findUnique({ where: { id: supplier.id }, select: { id: true } });
      await transaction.supplier.upsert({ where: { id: supplier.id }, create: supplier, update: withoutId(supplier) });
      exists ? updated++ : created++;
    }
    const historyExists = await transaction.orderHistory.findUnique({ where: { id: CHECKOUT_ORDER_HISTORY.id }, select: { id: true } });
    await transaction.orderHistory.upsert({ where: { id: CHECKOUT_ORDER_HISTORY.id }, create: CHECKOUT_ORDER_HISTORY, update: withoutId(CHECKOUT_ORDER_HISTORY) });
    historyExists ? updated++ : created++;
    report.recordFamily("sales", { created, preserved, updated });
  }

  private async countCheckoutPreserved(transaction: Prisma.TransactionClient): Promise<number> {
    const [orders, items, payments, redemptions, keys] = await Promise.all([
      transaction.order.count({ where: { id: { not: CHECKOUT_FIXTURE.orderId } } }), transaction.orderItem.count({ where: { id: { not: CHECKOUT_FIXTURE.orderItemId } } }),
      transaction.orderPayment.count({ where: { id: { not: CHECKOUT_FIXTURE.paymentId } } }), transaction.couponRedemption.count({ where: { id: { not: CHECKOUT_ORDER_FIXTURE.redemption.id } } }),
      transaction.checkoutIdempotencyKey.count({ where: { id: { not: CHECKOUT_FIXTURE.idempotencyId } } }),
    ]);
    return orders + items + payments + redemptions + keys;
  }

  private async countAbandonedPreserved(transaction: Prisma.TransactionClient): Promise<number> {
    const cartIds = ABANDONED_CART_FIXTURES.map((fixture) => fixture.cartId);
    const itemIds = ABANDONED_CART_FIXTURES.flatMap((fixture) => fixture.lineItems.map((item) => item.id));
    const sessionIds = ABANDONED_CART_FIXTURES.map((fixture) => fixture.sessionId);
    const historyIds = ABANDONED_CART_FIXTURES.flatMap((fixture) => fixture.history.map((event) => event.id));
    const [carts, items, sessions, history, settings] = await Promise.all([
      transaction.cart.count({ where: { id: { notIn: cartIds } } }), transaction.cartItem.count({ where: { id: { notIn: itemIds } } }),
      transaction.checkoutSession.count({ where: { id: { notIn: sessionIds } } }), transaction.checkoutSessionHistory.count({ where: { id: { notIn: historyIds } } }),
      transaction.cartRecoverySettings.count({ where: { id: { not: DEFAULT_RECOVERY_SETTINGS.id } } }),
    ]);
    return carts + items + sessions + history + settings;
  }

  private async countSalesPreserved(transaction: Prisma.TransactionClient): Promise<number> {
    const supplierIds = SUPPLIERS.map((supplier) => supplier.id);
    const [suppliers, history] = await Promise.all([
      transaction.supplier.count({ where: { id: { notIn: supplierIds } } }), transaction.orderHistory.count({ where: { id: { not: CHECKOUT_ORDER_HISTORY.id } } }),
    ]);
    return suppliers + history;
  }
}

function withoutId<T extends { id: string }>(data: T): Omit<T, "id"> {
  const { id: _id, ...without } = data;
  return without;
}
