import { Inject, Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../../common/prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { OrderHistoryEventType, PaymentNotificationStatus } from "../../generated/prisma/enums";
import {
  MERCADOPAGO_ORDERS_PORT,
  MercadoPagoOrdersError,
  type MercadoPagoOrder,
  type MercadoPagoOrdersPort,
} from "./mercadopago/mercadopago-orders.port";
import { WEBHOOK_TOPIC } from "./payment-notification.service";
import { PaymentReducerService } from "./payment-reducer.service";
import { PaymentsRepository } from "./payments.repository";
import { PaymentsTransaction, lockOrderAndPayment } from "./payments-transaction";

export const NOTIFICATION_LEASE_SECONDS = 30;
export const NOTIFICATION_MAX_PROCESS_ATTEMPTS = 8;
export const NOTIFICATION_BACKOFF_BASE_MS = 15_000;
export const NOTIFICATION_BACKOFF_MAX_MS = 15 * 60 * 1_000;

const PROVIDER_ORDER_ID_PATTERN = /^ORD[0-9A-Za-z]+$/;

interface ClaimedNotification {
  id: string;
  leaseFence: number;
  processAttempts: number;
  resourceId: string;
  topic: string;
}

export type NotificationOutcome = "processed" | "quarantined" | "retry" | "skipped";

/** The authoritative read could not be tied to a known attempt (yet). */
class UnresolvedNotification extends Error {
  constructor(readonly reason: string, readonly terminal = false) {
    super(reason);
  }
}

export function notificationBackoffMs(processAttempts: number): number {
  const exponent = Math.max(processAttempts - 1, 0);
  return Math.min(NOTIFICATION_BACKOFF_BASE_MS * 2 ** exponent, NOTIFICATION_BACKOFF_MAX_MS);
}

/**
 * Applies accepted notifications. The signed resource id is only ever used to GET the order from the fixed
 * provider API; body fields never decide state. Reduction reuses the shared reducer (order then payment lock,
 * version monotonicity), which is idempotent, so a crash before the inbox row is marked processed only repeats it.
 */
@Injectable()
export class PaymentNotificationProcessorService {
  private readonly logger = new Logger(PaymentNotificationProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: PaymentsRepository,
    private readonly reducer: PaymentReducerService,
    private readonly transactions: PaymentsTransaction,
    @Inject(MERCADOPAGO_ORDERS_PORT) private readonly port: MercadoPagoOrdersPort,
  ) {}

  /** Best-effort immediate processing after acceptance; the durable row remains the source of recovery. */
  scheduleProcessing(notificationId: string): void {
    setImmediate(() => {
      this.processById(notificationId).catch((error: unknown) => {
        this.logger.warn(JSON.stringify({ event: "payment_notification_process_failed", notificationId, error: sanitize(error) }));
      });
    });
  }

  async processById(notificationId: string): Promise<NotificationOutcome> {
    const [claimed] = await this.claim(1, notificationId);
    return claimed ? this.process(claimed) : "skipped";
  }

  /** Claims up to `limit` due rows (SKIP LOCKED) and processes them sequentially. Used by the periodic worker. */
  async processDue(limit = 5): Promise<NotificationOutcome[]> {
    const claimed = await this.claim(Math.min(Math.max(limit, 1), 20));
    const outcomes: NotificationOutcome[] = [];
    for (const row of claimed) outcomes.push(await this.process(row));
    return outcomes;
  }

  private async claim(limit: number, notificationId?: string): Promise<ClaimedNotification[]> {
    const idFilter = notificationId ? Prisma.sql`AND "id" = ${notificationId}` : Prisma.empty;
    return this.prisma.$queryRaw<ClaimedNotification[]>(Prisma.sql`
      UPDATE "PaymentNotification"
      SET "status" = 'PROCESSING'::"PaymentNotificationStatus",
          "leaseUntil" = (clock_timestamp() AT TIME ZONE 'UTC') + make_interval(secs => ${NOTIFICATION_LEASE_SECONDS}),
          "leaseFence" = "leaseFence" + 1,
          "processAttempts" = "processAttempts" + 1,
          "updatedAt" = (clock_timestamp() AT TIME ZONE 'UTC')
      WHERE "id" IN (
        SELECT "id" FROM "PaymentNotification"
        WHERE (
          ("status" = 'PENDING'::"PaymentNotificationStatus" AND "nextRunAt" <= (clock_timestamp() AT TIME ZONE 'UTC'))
          OR ("status" = 'PROCESSING'::"PaymentNotificationStatus" AND "leaseUntil" < (clock_timestamp() AT TIME ZONE 'UTC'))
        ) ${idFilter}
        ORDER BY "nextRunAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "leaseFence", "processAttempts", "resourceId", "topic"
    `);
  }

  private async process(row: ClaimedNotification): Promise<NotificationOutcome> {
    try {
      if (row.topic === WEBHOOK_TOPIC.ORDER) {
        const observation = await this.fetchSigned(row.resourceId);
        const attemptId = await this.associate(observation);
        await this.reducer.applyObservation(attemptId, observation);
        return this.finish(row, { attemptId, status: PaymentNotificationStatus.PROCESSED });
      }

      if (row.topic === WEBHOOK_TOPIC.CHARGEBACK || row.topic === WEBHOOK_TOPIC.FRAUD_ALERT) {
        // Optional topics deliver ids that are not Orders ids: only an Orders-style signed id is verifiable here.
        if (!PROVIDER_ORDER_ID_PATTERN.test(row.resourceId)) throw new UnresolvedNotification("unverified_association", true);

        const observation = await this.fetchSigned(row.resourceId);
        const attempt = await this.repository.attemptByProviderOrderId(observation.id);
        if (!attempt) throw new UnresolvedNotification("unknown_provider_order");
        if (observation.externalReference !== attempt.payment.orderId) throw new UnresolvedNotification("external_reference_mismatch", true);

        if (row.topic === WEBHOOK_TOPIC.CHARGEBACK) {
          if (observation.chargebacks.length === 0 && observation.status !== "charged_back") {
            throw new UnresolvedNotification("chargeback_not_confirmed");
          }
          await this.reducer.applyObservation(attempt.id, observation);
          await this.recordRisk(attempt.id, attempt.payment.orderId, "dispute", observation);
        } else {
          await this.recordRisk(attempt.id, attempt.payment.orderId, "fraud_alert", observation);
        }
        return this.finish(row, { attemptId: attempt.id, status: PaymentNotificationStatus.PROCESSED });
      }

      return this.finish(row, { quarantineReason: "unsupported_topic", status: PaymentNotificationStatus.QUARANTINED });
    } catch (error) {
      return this.fail(row, error);
    }
  }

  /** Authoritative GET of the signed id; the response must be that very order. */
  private async fetchSigned(resourceId: string): Promise<MercadoPagoOrder> {
    const observation = await this.port.getOrder(resourceId);
    if (observation.id !== resourceId) throw new UnresolvedNotification("resource_mismatch", true);
    return observation;
  }

  /** Provider order id first; otherwise the validated external reference plus exactly one unresolved candidate. */
  private async associate(observation: MercadoPagoOrder): Promise<string> {
    const known = await this.repository.attemptByProviderOrderId(observation.id);
    if (known) return known.id;

    const order = await this.repository.orderById(observation.externalReference);
    if (!order || order.payment?.provider !== "MERCADOPAGO") throw new UnresolvedNotification("unknown_association");

    const candidates = await this.repository.unresolvedAttemptsWithoutProviderOrder(order.id);
    if (candidates.length !== 1) throw new UnresolvedNotification(candidates.length === 0 ? "no_candidate_attempt" : "ambiguous_candidate_attempt");
    return candidates[0]!.id;
  }

  /** Records the dispute/fraud hold once per attempt under the shared order/payment lock. */
  private async recordRisk(
    attemptId: string,
    orderId: string,
    hold: "dispute" | "fraud_alert",
    observation: MercadoPagoOrder,
  ): Promise<void> {
    await this.transactions.run(async (transaction) => {
      await lockOrderAndPayment(transaction, orderId);
      const payment = await transaction.orderPayment.findUniqueOrThrow({ where: { orderId } });
      const holds = new Set<string>(payment.fulfillmentHoldReasons);

      if (!holds.has(hold)) {
        holds.add(hold);
        await transaction.orderPayment.update({
          data: { fulfillmentHoldReasons: [...holds], rowVersion: { increment: 1 } },
          where: { id: payment.id },
        });
      }
      await transaction.orderHistory.createMany({
        data: [{
          description: hold === "fraud_alert"
            ? "Mercado Pago raised a fraud alert: do not ship; inspect or refund from the Mercado Pago panel."
            : "Mercado Pago reported a chargeback: fulfillment is on hold.",
          effectKey: `payment:${attemptId}:${hold}_notice`,
          metadata: {
            attemptId,
            ...(hold === "dispute" ? { chargebackIds: observation.chargebacks.map((chargeback) => chargeback.id).slice(0, 10) } : {}),
          },
          orderId,
          title: hold === "fraud_alert" ? "Fraud alert received" : "Chargeback received",
          type: OrderHistoryEventType.PAYMENT_ATTENTION_REQUIRED,
        }],
        skipDuplicates: true,
      });
    });
  }

  private async finish(
    row: ClaimedNotification,
    outcome: { attemptId?: string; quarantineReason?: string; status: PaymentNotificationStatus },
  ): Promise<NotificationOutcome> {
    const now = await this.repository.databaseNow();
    const updated = await this.prisma.paymentNotification.updateMany({
      data: {
        ...(outcome.attemptId ? { attemptId: outcome.attemptId } : {}),
        leaseUntil: null,
        processedAt: now,
        quarantineReason: outcome.quarantineReason ?? null,
        status: outcome.status,
      },
      where: { id: row.id, leaseFence: row.leaseFence, status: PaymentNotificationStatus.PROCESSING },
    });
    if (updated.count === 0) return "skipped";
    return outcome.status === PaymentNotificationStatus.PROCESSED ? "processed" : "quarantined";
  }

  private async fail(row: ClaimedNotification, error: unknown): Promise<NotificationOutcome> {
    const unresolved = error instanceof UnresolvedNotification ? error : undefined;
    const reason = unresolved?.reason ?? providerErrorReason(error);
    const exhausted = row.processAttempts >= NOTIFICATION_MAX_PROCESS_ATTEMPTS;

    this.logger.warn(JSON.stringify({ event: "payment_notification_unresolved", notificationId: row.id, reason, attempts: row.processAttempts }));

    if (unresolved?.terminal || exhausted) {
      const now = await this.repository.databaseNow();
      const updated = await this.prisma.paymentNotification.updateMany({
        data: { leaseUntil: null, processedAt: now, quarantineReason: reason, status: PaymentNotificationStatus.QUARANTINED },
        where: { id: row.id, leaseFence: row.leaseFence, status: PaymentNotificationStatus.PROCESSING },
      });
      return updated.count === 0 ? "skipped" : "quarantined";
    }

    const now = await this.repository.databaseNow();
    const updated = await this.prisma.paymentNotification.updateMany({
      data: {
        leaseUntil: null,
        nextRunAt: new Date(now.getTime() + notificationBackoffMs(row.processAttempts)),
        status: PaymentNotificationStatus.PENDING,
      },
      where: { id: row.id, leaseFence: row.leaseFence, status: PaymentNotificationStatus.PROCESSING },
    });
    return updated.count === 0 ? "skipped" : "retry";
  }
}

function providerErrorReason(error: unknown): string {
  return error instanceof MercadoPagoOrdersError ? `provider_${error.category}` : "processing_error";
}

function sanitize(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}
