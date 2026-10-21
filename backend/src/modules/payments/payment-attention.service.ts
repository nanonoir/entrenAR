import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../../common/prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import {
  OrderStatus,
  PaymentAttemptStatus,
  PaymentNotificationStatus,
  PaymentProvider,
  PaymentStatus,
} from "../../generated/prisma/enums";
import { PAYMENT_THRESHOLDS } from "./payment-reconcile.cadence";
import { PaymentReducerService } from "./payment-reducer.service";
import { PaymentsRepository } from "./payments.repository";

export const PAYMENT_EXPIRY_OVERDUE_MS = 30_000;
export const PAYMENT_SUBMISSION_STALLED_MS = 60_000;
const SWEEP_BATCH = 50;
const SAMPLE_IDS = 10;

export interface AttentionSweepSummary {
  attemptLeasesReclaimed: number;
  challengesOverdue: number;
  expiryOverdue: number;
  flagged: number;
  notificationLeasesReclaimed: number;
  quarantinedRecent: number;
  reviewsOverAlert: number;
  stalledSubmissions: number;
  unknownAlerts: number;
}

/** Stuck-work sweep: reclaims expired leases, raises attention flags and logs structured alerts (no secrets). */
@Injectable()
export class PaymentAttentionService {
  private readonly logger = new Logger(PaymentAttentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: PaymentsRepository,
    private readonly reducer: PaymentReducerService,
  ) {}

  async sweep(): Promise<AttentionSweepSummary> {
    const now = await this.repository.databaseNow();
    const before = (ms: number) => new Date(now.getTime() - ms);
    const summary: AttentionSweepSummary = {
      attemptLeasesReclaimed: 0,
      challengesOverdue: 0,
      expiryOverdue: 0,
      flagged: 0,
      notificationLeasesReclaimed: 0,
      quarantinedRecent: 0,
      reviewsOverAlert: 0,
      stalledSubmissions: 0,
      unknownAlerts: 0,
    };

    // Expired leases: bumping the fence makes a slow previous worker stale, and the rows become claimable again.
    summary.attemptLeasesReclaimed = (await this.prisma.$queryRaw<unknown[]>(Prisma.sql`
      UPDATE "PaymentAttempt"
      SET "reconcileLeaseUntil" = NULL, "reconcileFence" = "reconcileFence" + 1
      WHERE "reconcileLeaseUntil" < (clock_timestamp() AT TIME ZONE 'UTC')
      RETURNING "id"
    `)).length;
    summary.notificationLeasesReclaimed = (await this.prisma.$queryRaw<unknown[]>(Prisma.sql`
      UPDATE "PaymentNotification"
      SET "status" = 'PENDING'::"PaymentNotificationStatus", "leaseUntil" = NULL, "leaseFence" = "leaseFence" + 1,
          "nextRunAt" = (clock_timestamp() AT TIME ZONE 'UTC')
      WHERE "status" = 'PROCESSING'::"PaymentNotificationStatus" AND "leaseUntil" < (clock_timestamp() AT TIME ZONE 'UTC')
      RETURNING "id"
    `)).length;

    // A submission that never resolved holds its stock as UNKNOWN until the provider answers a read.
    const stalled = await this.prisma.paymentAttempt.findMany({
      select: { id: true },
      take: SWEEP_BATCH,
      where: { status: PaymentAttemptStatus.SUBMITTING, submittedAt: { lt: before(PAYMENT_SUBMISSION_STALLED_MS) } },
    });
    for (const attempt of stalled) {
      await this.reducer.markUnknown(attempt.id, { lastError: "submission_stalled" });
      summary.stalledSubmissions += 1;
    }

    const unknown = await this.prisma.paymentAttempt.findMany({
      select: { id: true, payment: { select: { attentionRequiredAt: true } }, providerOrderId: true, submittedAt: true },
      take: SWEEP_BATCH,
      where: { status: PaymentAttemptStatus.UNKNOWN, submittedAt: { lt: before(PAYMENT_THRESHOLDS.unknownAlertMs) } },
    });
    summary.unknownAlerts = unknown.length;
    for (const attempt of unknown) {
      const unresolved = attempt.submittedAt < before(PAYMENT_THRESHOLDS.unknownAttentionMs);
      if (unresolved && !attempt.payment.attentionRequiredAt && await this.reducer.flagAttention(attempt.id, "unresolved_unknown_outcome")) {
        summary.flagged += 1;
      }
    }
    this.alert("payment_unknown_outcome", unknown.map((attempt) => attempt.id), unknown.length);

    const challenges = await this.prisma.paymentAttempt.findMany({
      select: { id: true },
      take: SWEEP_BATCH,
      where: { challengeCreatedAt: { lt: before(PAYMENT_THRESHOLDS.challengeLifetimeMs) }, status: PaymentAttemptStatus.ACTION_REQUIRED },
    });
    summary.challengesOverdue = challenges.length;
    this.alert("payment_challenge_overdue", challenges.map((attempt) => attempt.id), challenges.length);

    const reviews = await this.prisma.paymentAttempt.findMany({
      select: { id: true, payment: { select: { attentionRequiredAt: true, reviewStartedAt: true } } },
      take: SWEEP_BATCH,
      where: {
        payment: { is: { reviewStartedAt: { lt: before(PAYMENT_THRESHOLDS.reviewAttentionMs) } } },
        status: PaymentAttemptStatus.PROCESSING,
      },
    });
    const overAlert: string[] = [];
    for (const attempt of reviews) {
      if (!attempt.payment.attentionRequiredAt && await this.reducer.flagAttention(attempt.id, "review_over_1h")) summary.flagged += 1;
      if (attempt.payment.reviewStartedAt && attempt.payment.reviewStartedAt < before(PAYMENT_THRESHOLDS.reviewAlertMs)) overAlert.push(attempt.id);
    }
    summary.reviewsOverAlert = overAlert.length;
    this.alert("payment_review_over_24h", overAlert, overAlert.length);

    const overdue = await this.prisma.orderPayment.findMany({
      select: { orderId: true },
      take: SWEEP_BATCH,
      where: {
        attempts: { none: { status: { in: [PaymentAttemptStatus.SUBMITTING, PaymentAttemptStatus.UNKNOWN, PaymentAttemptStatus.PROCESSING, PaymentAttemptStatus.ACTION_REQUIRED] } } },
        order: { status: OrderStatus.PENDING },
        provider: PaymentProvider.MERCADOPAGO,
        retryUntil: { lt: before(PAYMENT_EXPIRY_OVERDUE_MS) },
        status: PaymentStatus.PENDING,
      },
    });
    summary.expiryOverdue = overdue.length;
    this.alert("payment_expiry_overdue", overdue.map((payment) => payment.orderId), overdue.length);

    const quarantined = await this.prisma.paymentNotification.findMany({
      select: { id: true, quarantineReason: true },
      take: SWEEP_BATCH,
      where: { processedAt: { gte: before(PAYMENT_SWEEP_QUARANTINE_WINDOW_MS) }, status: PaymentNotificationStatus.QUARANTINED },
    });
    summary.quarantinedRecent = quarantined.length;
    this.alert("payment_notification_quarantined", quarantined.map((row) => row.id), quarantined.length);

    return summary;
  }

  private alert(event: string, ids: readonly string[], count: number): void {
    if (count === 0) return;
    this.logger.warn(JSON.stringify({ count, event, ids: ids.slice(0, SAMPLE_IDS) }));
  }
}

/** Slightly longer than the sweep cadence so each quarantined notification is reported about once. */
export const PAYMENT_SWEEP_QUARANTINE_WINDOW_MS = 90_000;
