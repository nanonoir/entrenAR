import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import type { Prisma } from "../../generated/prisma/client";
import {
  CartStatus,
  CheckoutRecoveryStatus,
  CheckoutSessionStatus,
  InventoryMovementKind,
  InventoryReferenceType,
  OrderHistoryEventType,
  OrderInventoryPolicy,
  OrderShippingStatus,
  OrderStatus,
  PaymentAttemptStatus,
  PaymentProvider,
  PaymentStatus,
  type Role,
} from "../../generated/prisma/enums";
import { INVENTORY_ORIGIN } from "../inventory/inventory.constants";
import { InventoryRepository } from "../inventory/inventory.repository";
import type { MercadoPagoOrder } from "./mercadopago/mercadopago-orders.port";
import { fromCents, toCents } from "./mercadopago/mercadopago-orders.schemas";
import {
  PAYMENT_RETRY_WINDOW_MS,
  decideTransition,
  isSuccessAttempt,
  isUnsettledAttempt,
  type ApplyDecision,
  type ReducerDecision,
} from "./payment-reducer";
import { ORDER_EFFECT, type FulfillmentHoldReason } from "./payment-status.normalizer";
import { PaymentsTransaction, databaseNow, lockOrderAndPayment } from "./payments-transaction";

export const PAYMENT_RECONCILE_DELAY_MS = 30_000;
export const PAYMENT_UNKNOWN_RECONCILE_DELAY_MS = 15_000;
export const PAYMENT_ATTENTION_RECONCILE_DELAY_MS = 60_000;

const SUCCESS_ATTEMPT_STATUSES = [
  PaymentAttemptStatus.APPROVED,
  PaymentAttemptStatus.PARTIALLY_REFUNDED,
  PaymentAttemptStatus.REFUNDED,
  PaymentAttemptStatus.CHARGED_BACK,
];

export interface PaymentApplyResult {
  attemptStatus: PaymentAttemptStatus;
  decision: ReducerDecision["kind"];
  orderCancelled: boolean;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  /** Set when a reconciliation fence was supplied and no longer matches: nothing was committed. */
  stale?: true;
}

export interface UnknownOutcomeDetails {
  /** Idempotency conflicts mean another request may still be in flight: also flag attention. */
  attentionReason?: string;
  lastError: string;
  providerOrderId?: string;
  providerTransactionId?: string;
}

export interface CancelUncreatedOptions {
  /** Admin who resolved the attempt; recorded on the history entry. */
  actor?: { id?: string; role: Role };
  orderReason?: string;
  /** Re-validated under the order/payment lock: only an UNKNOWN attempt may be closed. */
  requireUnknown?: boolean;
}

interface HistoryEntry {
  actorId?: string | undefined;
  actorRole?: Role;
  description?: string;
  effectKey: string;
  metadata?: Prisma.InputJsonValue;
  title: string;
  type: OrderHistoryEventType;
}

type ReductionContext = Awaited<ReturnType<PaymentReducerService["load"]>>;

/**
 * Persistence-applying payment reducer. Every transition runs in one short transaction that locks the order
 * and then the payment, applies monotonic transitions idempotently and appends history keyed by `effectKey`.
 */
@Injectable()
export class PaymentReducerService {
  constructor(
    private readonly transactions: PaymentsTransaction,
    private readonly inventoryRepository: InventoryRepository,
  ) {}

  /** `fence` (reconciliation claims) makes a superseded worker's result a no-op: it is checked under the order lock. */
  async applyObservation(attemptId: string, observation: MercadoPagoOrder, fence?: number): Promise<PaymentApplyResult> {
    return this.transactions.run(async (transaction) => {
      const context = await this.load(transaction, attemptId);
      if (fence !== undefined && context.attempt.reconcileFence !== fence) {
        return { ...this.result(context, "ignore"), stale: true };
      }
      const now = await databaseNow(transaction);
      const decision = decideTransition({
        attempt: {
          providerOrderId: context.attempt.providerOrderId,
          providerTransactionId: context.attempt.providerTransactionId,
          providerUpdatedAt: context.attempt.providerUpdatedAt,
          refundedCents: toCents(context.attempt.refundedAmount.toFixed(2)),
          status: context.attempt.status,
        },
        currency: context.payment.currency,
        expectedAmount: context.attempt.expectedAmount.toFixed(2),
        observation,
        orderId: context.order.id,
        otherSuccessExists: context.otherSuccessExists,
      });

      switch (decision.kind) {
        case "ignore":
          return this.result(context, decision.kind);
        case "attention":
          return this.recordAttention(transaction, context, decision.reason, now);
        case "incident":
          return this.recordIncident(transaction, context, decision, observation, now);
        case "apply":
          return this.applyDecision(transaction, context, decision, observation, now);
      }
    });
  }

  /** Outcome of a create call could not be determined: hold stock and let reconciliation resolve it. */
  async markUnknown(attemptId: string, details: UnknownOutcomeDetails): Promise<PaymentApplyResult> {
    return this.transactions.run(async (transaction) => {
      const context = await this.load(transaction, attemptId);
      const now = await databaseNow(transaction);
      const { attempt } = context;
      if (attempt.status !== PaymentAttemptStatus.SUBMITTING && attempt.status !== PaymentAttemptStatus.UNKNOWN) {
        return this.result(context, "ignore");
      }

      await transaction.paymentAttempt.update({
        data: {
          lastError: details.lastError,
          localVersion: { increment: 1 },
          nextReconcileAt: new Date(now.getTime() + PAYMENT_UNKNOWN_RECONCILE_DELAY_MS),
          ...(details.providerOrderId && !attempt.providerOrderId ? { providerOrderId: details.providerOrderId } : {}),
          ...(details.providerTransactionId && !attempt.providerTransactionId
            ? { providerTransactionId: details.providerTransactionId }
            : {}),
          status: PaymentAttemptStatus.UNKNOWN,
        },
        where: { id: attempt.id },
      });

      if (details.attentionReason) {
        return this.recordAttention(transaction, { ...context, attempt: { ...attempt, status: PaymentAttemptStatus.UNKNOWN } }, details.attentionReason, now);
      }

      return this.result({ ...context, attempt: { ...attempt, status: PaymentAttemptStatus.UNKNOWN } }, "apply");
    });
  }

  /** The provider definitively did not create the charge (e.g. validation failure): open the retry window. */
  async rejectWithoutCharge(attemptId: string, reason: string): Promise<PaymentApplyResult> {
    return this.transactions.run(async (transaction) => {
      const context = await this.load(transaction, attemptId);
      const now = await databaseNow(transaction);
      const { attempt, payment } = context;
      if (!isUnsettledAttempt(attempt.status) || attempt.providerOrderId) return this.result(context, "ignore");

      await transaction.paymentAttempt.update({
        data: {
          lastError: reason,
          localVersion: { increment: 1 },
          nextReconcileAt: null,
          outcomeAt: now,
          status: PaymentAttemptStatus.REJECTED,
        },
        where: { id: attempt.id },
      });
      await transaction.orderPayment.update({
        data: {
          activeAttemptId: null,
          retryUntil: new Date(now.getTime() + PAYMENT_RETRY_WINDOW_MS),
          rowVersion: { increment: 1 },
        },
        where: { id: payment.id },
      });
      await this.appendHistory(transaction, context.order.id, [{
        description: `Attempt ${attempt.attemptNumber} was not charged.`,
        effectKey: `payment:${attempt.id}:rejected`,
        metadata: { attemptNumber: attempt.attemptNumber },
        title: "Payment rejected",
        type: OrderHistoryEventType.PAYMENT_REJECTED,
      }]);

      return this.result({ ...context, attempt: { ...attempt, status: PaymentAttemptStatus.REJECTED } }, "apply");
    });
  }

  /**
   * The provider definitively did not create the order and the failure is ours (credentials/configuration), not the
   * card's: close the attempt and cancel the order without a retry window. Stock returns through the same
   * idempotent compensation as any other cancellation, so it is returned exactly once.
   */
  async cancelUncreated(attemptId: string, reason: string, options: CancelUncreatedOptions = {}): Promise<PaymentApplyResult> {
    return this.transactions.run(async (transaction) => {
      const context = await this.load(transaction, attemptId);
      const now = await databaseNow(transaction);
      const { attempt, order, payment } = context;
      if (!isUnsettledAttempt(attempt.status) || attempt.providerOrderId) return this.result(context, "ignore");
      if (options.requireUnknown && attempt.status !== PaymentAttemptStatus.UNKNOWN) return this.result(context, "ignore");

      const cancellable = order.status === OrderStatus.PENDING
        && payment.status === PaymentStatus.PENDING
        && !context.otherSuccessExists;
      if (cancellable) await this.cancelOrder(transaction, context, options.orderReason ?? "Payment unavailable", now);

      await transaction.paymentAttempt.update({
        data: {
          lastError: reason,
          localVersion: { increment: 1 },
          nextReconcileAt: null,
          outcomeAt: now,
          status: PaymentAttemptStatus.CANCELLED,
        },
        where: { id: attempt.id },
      });
      await transaction.orderPayment.update({
        data: { activeAttemptId: null, retryUntil: null, rowVersion: { increment: 1 } },
        where: { id: payment.id },
      });
      if (cancellable || options.actor) {
        await this.appendHistory(transaction, order.id, [{
          ...(options.actor ? { actorId: options.actor.id, actorRole: options.actor.role } : {}),
          description: options.actor
            ? `Attempt ${attempt.attemptNumber} had an unconfirmed outcome; the provider confirmed no order exists, so an admin closed it${cancellable ? " and cancelled the order" : ""}.`
            : `Attempt ${attempt.attemptNumber} was not created at the provider.`,
          effectKey: `payment:${attempt.id}:order_cancelled`,
          metadata: { attemptNumber: attempt.attemptNumber },
          title: cancellable ? "Order cancelled" : "Payment attempt closed",
          type: OrderHistoryEventType.ORDER_CANCELLED,
        }]);
      }

      return {
        attemptStatus: PaymentAttemptStatus.CANCELLED,
        decision: "apply",
        orderCancelled: cancellable || order.status === OrderStatus.CANCELLED,
        orderStatus: cancellable ? OrderStatus.CANCELLED : order.status,
        paymentStatus: payment.status,
      };
    });
  }

  /**
   * Retry-window expiry: cancels an unpaid order and returns its stock exactly once. Every precondition is
   * re-checked under the order/payment lock against the database clock, so a customer retry, a webhook or an
   * admin action that won the lock first makes this a no-op. Returns whether the order was released.
   */
  async expireUnpaid(orderId: string): Promise<boolean> {
    return this.transactions.run(async (transaction) => {
      await lockOrderAndPayment(transaction, orderId);
      const now = await databaseNow(transaction);
      const payment = await transaction.orderPayment.findUnique({
        include: { attempts: { select: { status: true } } },
        where: { orderId },
      });
      const order = await transaction.order.findUnique({ include: { items: true }, where: { id: orderId } });
      if (!payment || !order || payment.provider !== PaymentProvider.MERCADOPAGO) return false;

      const dueForRelease = order.status === OrderStatus.PENDING
        && payment.status === PaymentStatus.PENDING
        && payment.retryUntil !== null
        && payment.retryUntil.getTime() <= now.getTime()
        && payment.attempts.length > 0
        && payment.attempts.every((attempt) => attempt.status === PaymentAttemptStatus.REJECTED
          || attempt.status === PaymentAttemptStatus.CANCELLED
          || attempt.status === PaymentAttemptStatus.EXPIRED);
      if (!dueForRelease) return false;

      const attempt = await transaction.paymentAttempt.findFirstOrThrow({
        orderBy: { attemptNumber: "desc" },
        where: { paymentId: payment.id },
      });
      const context = { attempt, order, otherSuccessExists: false, payment } as ReductionContext;
      await this.cancelOrder(transaction, context, "Payment expired", now);
      await transaction.orderPayment.update({
        data: { activeAttemptId: null, retryUntil: null, rowVersion: { increment: 1 } },
        where: { id: payment.id },
      });
      await this.appendHistory(transaction, orderId, [{
        description: "The payment retry window ended without a successful payment.",
        effectKey: `payment:${payment.id}:retry_expired_cancelled`,
        metadata: { attemptNumber: attempt.attemptNumber },
        title: "Order cancelled",
        type: OrderHistoryEventType.ORDER_CANCELLED,
      }]);
      return true;
    });
  }

  /**
   * Raises the payment attention flag without changing attempt state or fulfillment holds (stock stays held).
   * Idempotent: the first reason wins and the history entry is keyed by reason.
   */
  async flagAttention(attemptId: string, reason: string): Promise<boolean> {
    return this.transactions.run(async (transaction) => {
      const context = await this.load(transaction, attemptId);
      const now = await databaseNow(transaction);
      const { attempt, payment } = context;
      if (payment.attentionRequiredAt && payment.attentionReason === reason) return false;

      if (!payment.attentionRequiredAt) {
        await transaction.orderPayment.update({
          data: { attentionReason: reason, attentionRequiredAt: now, rowVersion: { increment: 1 } },
          where: { id: payment.id },
        });
      }
      await this.appendHistory(transaction, context.order.id, [attentionEntry(attempt.id, reason)]);
      return true;
    });
  }

  async load(transaction: Prisma.TransactionClient, attemptId: string) {
    const head = await transaction.paymentAttempt.findUnique({
      select: { payment: { select: { orderId: true } } },
      where: { id: attemptId },
    });
    if (!head) throw new Error("Payment attempt was not found.");

    await lockOrderAndPayment(transaction, head.payment.orderId);
    const attempt = await transaction.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    const payment = await transaction.orderPayment.findUniqueOrThrow({ where: { id: attempt.paymentId } });
    const order = await transaction.order.findUniqueOrThrow({ include: { items: true }, where: { id: head.payment.orderId } });
    const otherSuccessExists = (await transaction.paymentAttempt.count({
      where: { id: { not: attemptId }, paymentId: payment.id, status: { in: SUCCESS_ATTEMPT_STATUSES } },
    })) > 0;

    return { attempt, order, otherSuccessExists, payment };
  }

  private async applyDecision(
    transaction: Prisma.TransactionClient,
    context: ReductionContext,
    decision: ApplyDecision,
    observation: MercadoPagoOrder,
    now: Date,
  ): Promise<PaymentApplyResult> {
    const { attempt, order, payment } = context;
    const providerTransaction = observation.transactions[0]!;
    const to = decision.attemptStatus;
    const unsettled = isUnsettledAttempt(to);
    const success = isSuccessAttempt(to);
    const holds = new Set<string>(payment.fulfillmentHoldReasons);
    decision.holds.forEach((hold: FulfillmentHoldReason) => holds.add(hold));
    let attentionReason = decision.attentionReason;
    let orderStatus: OrderStatus = order.status;
    let cancelled = false;
    const history: HistoryEntry[] = [];
    const eventMetadata: Prisma.InputJsonValue = { attemptNumber: attempt.attemptNumber };

    if (success && isUnsettledAttempt(attempt.status)) {
      history.push({
        effectKey: `payment:${attempt.id}:received`,
        metadata: eventMetadata,
        title: "Payment received",
        type: OrderHistoryEventType.PAYMENT_RECEIVED,
      });
    }
    if (to === PaymentAttemptStatus.PARTIALLY_REFUNDED) {
      history.push({
        effectKey: `payment:${attempt.id}:partially_refunded:${decision.refundedCents}`,
        metadata: { ...eventMetadata as object, refundedAmount: fromCents(decision.refundedCents) },
        title: "Payment partially refunded",
        type: OrderHistoryEventType.PAYMENT_PARTIALLY_REFUNDED,
      });
    }
    if (to === PaymentAttemptStatus.REFUNDED) {
      history.push({ effectKey: `payment:${attempt.id}:refunded`, metadata: eventMetadata, title: "Payment refunded", type: OrderHistoryEventType.PAYMENT_REFUNDED });
    }
    if (to === PaymentAttemptStatus.CHARGED_BACK) {
      history.push({ effectKey: `payment:${attempt.id}:charged_back`, metadata: eventMetadata, title: "Payment charged back", type: OrderHistoryEventType.PAYMENT_CHARGED_BACK });
    }
    if (to === PaymentAttemptStatus.REJECTED) {
      history.push({ effectKey: `payment:${attempt.id}:rejected`, metadata: eventMetadata, title: "Payment rejected", type: OrderHistoryEventType.PAYMENT_REJECTED });
    }
    if (to === PaymentAttemptStatus.EXPIRED) {
      history.push({ effectKey: `payment:${attempt.id}:expired`, metadata: eventMetadata, title: "Payment expired", type: OrderHistoryEventType.PAYMENT_EXPIRED });
    }

    if (decision.orderEffect === ORDER_EFFECT.CONFIRM) {
      if (order.status === OrderStatus.PENDING) {
        await transaction.order.update({ data: { confirmedAt: now, status: OrderStatus.CONFIRMED }, where: { id: order.id } });
        orderStatus = OrderStatus.CONFIRMED;
      } else if (order.status === OrderStatus.CANCELLED) {
        holds.add("unverified_provider_state");
        attentionReason ??= "paid_cancelled_order";
      }
    }

    if (
      decision.orderEffect === ORDER_EFFECT.CANCEL_IF_NONPAYABLE
      && order.status === OrderStatus.PENDING
      && payment.status === PaymentStatus.PENDING
      && !context.otherSuccessExists
    ) {
      cancelled = true;
      orderStatus = OrderStatus.CANCELLED;
      await this.cancelOrder(transaction, context, to === PaymentAttemptStatus.EXPIRED ? "Payment expired" : "Payment cancelled", now);
      history.push({
        effectKey: `payment:${attempt.id}:order_cancelled`,
        metadata: eventMetadata,
        title: "Order cancelled",
        type: OrderHistoryEventType.ORDER_CANCELLED,
      });
    }

    if (attentionReason) {
      history.push(attentionEntry(attempt.id, attentionReason));
    }

    await transaction.paymentAttempt.update({
      data: {
        challengeCreatedAt: to === PaymentAttemptStatus.ACTION_REQUIRED ? attempt.challengeCreatedAt ?? now : attempt.challengeCreatedAt,
        lastError: attentionReason ?? null,
        localVersion: { increment: 1 },
        nextReconcileAt: unsettled ? new Date(now.getTime() + PAYMENT_RECONCILE_DELAY_MS) : null,
        outcomeAt: unsettled ? attempt.outcomeAt : attempt.outcomeAt ?? now,
        providerOrderId: observation.id,
        providerTransactionId: providerTransaction.id,
        ...(providerTransaction.referenceId ? { providerReferenceIds: { paymentReferenceId: providerTransaction.referenceId } } : {}),
        providerUpdatedAt: decision.observedAt ?? attempt.providerUpdatedAt,
        providerVersion: observation.lastUpdatedAt ?? attempt.providerVersion,
        rawOrderStatus: observation.status,
        rawOrderStatusDetail: observation.statusDetail,
        rawTransactionStatus: providerTransaction.status,
        rawTransactionStatusDetail: providerTransaction.statusDetail,
        refundedAmount: fromCents(decision.refundedCents),
        status: to,
      },
      where: { id: attempt.id },
    });

    await transaction.orderPayment.update({
      data: {
        activeAttemptId: unsettled || success ? attempt.id : null,
        ...(attentionReason && !payment.attentionRequiredAt ? { attentionReason, attentionRequiredAt: now } : {}),
        fulfillmentHoldReasons: [...holds],
        retryUntil: to === PaymentAttemptStatus.REJECTED && decision.opensRetryWindow
          ? new Date(now.getTime() + PAYMENT_RETRY_WINDOW_MS)
          : null,
        ...(to === PaymentAttemptStatus.PROCESSING && !payment.reviewStartedAt ? { reviewStartedAt: now } : {}),
        rowVersion: { increment: 1 },
        ...(success ? { refundedAmount: fromCents(decision.refundedCents), status: decision.paymentStatus } : {}),
      },
      where: { id: payment.id },
    });

    await this.appendHistory(transaction, order.id, history);

    if (!cancelled && !attentionReason && (to === PaymentAttemptStatus.PROCESSING || success)) {
      await this.finalizeCheckout(transaction, context, now);
    }

    return {
      attemptStatus: to,
      decision: "apply",
      orderCancelled: cancelled,
      orderStatus,
      paymentStatus: success ? decision.paymentStatus : payment.status,
    };
  }

  private async recordAttention(
    transaction: Prisma.TransactionClient,
    context: ReductionContext,
    reason: string,
    now: Date,
  ): Promise<PaymentApplyResult> {
    const { attempt, payment } = context;
    const holds = new Set<string>(payment.fulfillmentHoldReasons);
    holds.add("unverified_provider_state");

    await transaction.paymentAttempt.update({
      data: {
        lastError: reason,
        localVersion: { increment: 1 },
        nextReconcileAt: new Date(now.getTime() + PAYMENT_ATTENTION_RECONCILE_DELAY_MS),
        status: attempt.status === PaymentAttemptStatus.SUBMITTING ? PaymentAttemptStatus.UNKNOWN : attempt.status,
      },
      where: { id: attempt.id },
    });
    if (holds.size !== payment.fulfillmentHoldReasons.length || !payment.attentionRequiredAt) {
      await transaction.orderPayment.update({
        data: {
          attentionReason: payment.attentionReason ?? reason,
          attentionRequiredAt: payment.attentionRequiredAt ?? now,
          fulfillmentHoldReasons: [...holds],
          rowVersion: { increment: 1 },
        },
        where: { id: payment.id },
      });
    }
    await this.appendHistory(transaction, context.order.id, [attentionEntry(attempt.id, reason)]);

    return this.result(context, "attention");
  }

  private async recordIncident(
    transaction: Prisma.TransactionClient,
    context: ReductionContext,
    decision: Extract<ReducerDecision, { kind: "incident" }>,
    observation: MercadoPagoOrder,
    now: Date,
  ): Promise<PaymentApplyResult> {
    const { attempt } = context;
    const providerTransaction = observation.transactions[0];

    if (decision.recordAttemptStatus && providerTransaction) {
      await transaction.paymentAttempt.update({
        data: {
          outcomeAt: attempt.outcomeAt ?? now,
          rawOrderStatus: observation.status,
          rawOrderStatusDetail: observation.statusDetail,
          rawTransactionStatus: providerTransaction.status,
          rawTransactionStatusDetail: providerTransaction.statusDetail,
          refundedAmount: observation.refundedAmount,
          status: decision.recordAttemptStatus,
        },
        where: { id: attempt.id },
      });
    }

    return this.recordAttention(transaction, context, decision.reason, now);
  }

  /** Mirrors the sales cancellation patch so admin views and reopening semantics stay uniform. */
  private async cancelOrder(
    transaction: Prisma.TransactionClient,
    context: ReductionContext,
    reason: string,
    now: Date,
  ): Promise<void> {
    const { order, payment } = context;

    await transaction.order.update({
      data: {
        cancelledAt: now,
        cancellationReason: reason,
        previousPaymentStatus: payment.status,
        previousShippingStatus: order.shippingStatus,
        previousStatus: order.status,
        shippingStatus: OrderShippingStatus.CANCELLED,
        status: OrderStatus.CANCELLED,
      },
      where: { id: order.id },
    });

    if (order.inventoryPolicy === OrderInventoryPolicy.LEDGER_MANAGED && order.inventoryEffectId) {
      await this.inventoryRepository.restoreUncompensatedDeductions(transaction, {
        inventoryEffectId: order.inventoryEffectId,
        movementKind: InventoryMovementKind.SALE_CANCELLATION_RESTORATION,
        operationId: randomUUID(),
        origin: INVENTORY_ORIGIN.PAYMENT_EXPIRY,
        reason: `Order ${order.number} payment ${reason.toLowerCase()}`,
        referenceId: order.id,
        referenceType: InventoryReferenceType.ORDER,
      });
    }
  }

  /**
   * Clears only the submitted cart generation and completes the checkout session, once. The session guard
   * makes repeated finalization a no-op, and items added after placement survive.
   */
  private async finalizeCheckout(
    transaction: Prisma.TransactionClient,
    context: ReductionContext,
    now: Date,
  ): Promise<void> {
    const { order } = context;
    if (!order.checkoutSessionId) return;

    const completed = await transaction.checkoutSession.updateMany({
      data: {
        completedAt: now,
        lastActivityAt: now,
        recoveryStatus: CheckoutRecoveryStatus.RECOVERED,
        status: CheckoutSessionStatus.COMPLETED,
      },
      where: { id: order.checkoutSessionId, status: CheckoutSessionStatus.ACTIVE },
    });
    if (completed.count === 0 || !order.cartId) return;

    for (const item of order.items) {
      const rows = await transaction.cartItem.findMany({
        select: { id: true, quantity: true },
        where: {
          cartId: order.cartId,
          productId: item.productId,
          ...(item.variantId ? { variantId: item.variantId } : {}),
        },
      });
      for (const row of rows) {
        const left = row.quantity - item.quantity;
        if (left > 0) await transaction.cartItem.update({ data: { quantity: left }, where: { id: row.id } });
        else await transaction.cartItem.delete({ where: { id: row.id } });
      }
    }
    const remaining = await transaction.cartItem.count({ where: { cartId: order.cartId } });
    if (remaining === 0) {
      await transaction.cart.updateMany({
        data: { status: CartStatus.COMPLETED },
        where: { id: order.cartId, status: CartStatus.ACTIVE },
      });
    }
  }

  private async appendHistory(
    transaction: Prisma.TransactionClient,
    orderId: string,
    entries: readonly HistoryEntry[],
  ): Promise<void> {
    if (entries.length === 0) return;

    await transaction.orderHistory.createMany({
      data: entries.map((entry) => ({
        ...(entry.actorRole ? { actorId: entry.actorId ?? null, actorRole: entry.actorRole } : {}),
        description: entry.description ?? null,
        effectKey: entry.effectKey,
        ...(entry.metadata === undefined ? {} : { metadata: entry.metadata }),
        orderId,
        title: entry.title,
        type: entry.type,
      })),
      skipDuplicates: true,
    });
  }

  private result(context: ReductionContext, decision: ReducerDecision["kind"]): PaymentApplyResult {
    return {
      attemptStatus: context.attempt.status,
      decision,
      orderCancelled: context.order.status === OrderStatus.CANCELLED,
      orderStatus: context.order.status,
      paymentStatus: context.payment.status,
    };
  }
}

function attentionEntry(attemptId: string, reason: string): HistoryEntry {
  return {
    description: `Payment needs review: ${reason}.`,
    effectKey: `payment:${attemptId}:attention:${reason}`,
    title: "Payment needs attention",
    type: OrderHistoryEventType.PAYMENT_ATTENTION_REQUIRED,
  };
}
