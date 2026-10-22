import { Inject, Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../../common/prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { PaymentAttemptStatus, PaymentProvider, PaymentStatus, OrderStatus } from "../../generated/prisma/enums";
import {
  MERCADOPAGO_ORDERS_PORT,
  MercadoPagoOrdersError,
  type MercadoPagoOrdersPort,
} from "./mercadopago/mercadopago-orders.port";
import {
  FINANCIAL_RECONCILE_INTERVAL_MS,
  RECONCILE_LEASE_SECONDS,
  mapWithLimit,
  pendingReconcileDelayMs,
} from "./payment-reconcile.cadence";
import { isUnsettledAttempt } from "./payment-reducer";
import { PaymentReducerService } from "./payment-reducer.service";
import { PaymentsRepository } from "./payments.repository";

export const RECONCILE_HTTP_CONCURRENCY = 4;
const NONPAYABLE_ATTEMPT_STATUSES: readonly PaymentAttemptStatus[] = [PaymentAttemptStatus.REJECTED, PaymentAttemptStatus.CANCELLED, PaymentAttemptStatus.EXPIRED];
const FINANCIAL_ATTEMPT_STATUSES: readonly PaymentAttemptStatus[] = [PaymentAttemptStatus.APPROVED, PaymentAttemptStatus.PARTIALLY_REFUNDED];

export type ReconcileKind = "financial" | "pending";
export type ReconcileOutcome = "applied" | "failed" | "stale" | "unresolved";
export type ExpiryOutcome = "postponed" | "released" | "skipped";

export interface ClaimedAttempt {
  id: string;
  providerOrderId: string | null;
  reconcileFence: number;
}

/**
 * Lease-based authoritative reconciliation of attempts plus retry-window expiry. Due attempts are claimed with
 * `FOR UPDATE SKIP LOCKED` against the database clock (30 s lease, incrementing fence); provider HTTP never runs
 * inside a transaction, and the reducer refuses results carrying a superseded fence.
 */
@Injectable()
export class PaymentReconciliationService {
  private readonly logger = new Logger(PaymentReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: PaymentsRepository,
    private readonly reducer: PaymentReducerService,
    @Inject(MERCADOPAGO_ORDERS_PORT) private readonly port: MercadoPagoOrdersPort,
  ) {}

  async claimDue(kind: ReconcileKind, limit: number): Promise<ClaimedAttempt[]> {
    const bounded = Math.min(Math.max(limit, 1), 20);
    const due = kind === "pending"
      ? Prisma.sql`"status" IN ('PROCESSING'::"PaymentAttemptStatus", 'ACTION_REQUIRED'::"PaymentAttemptStatus", 'UNKNOWN'::"PaymentAttemptStatus")
          AND "nextReconcileAt" <= (clock_timestamp() AT TIME ZONE 'UTC')`
      : Prisma.sql`"status" IN ('APPROVED'::"PaymentAttemptStatus", 'PARTIALLY_REFUNDED'::"PaymentAttemptStatus")
          AND "providerOrderId" IS NOT NULL
          AND ("nextReconcileAt" <= (clock_timestamp() AT TIME ZONE 'UTC')
            OR ("nextReconcileAt" IS NULL
              AND COALESCE("outcomeAt", "submittedAt") <= (clock_timestamp() AT TIME ZONE 'UTC') - make_interval(secs => ${FINANCIAL_RECONCILE_INTERVAL_MS / 1_000})))`;

    return this.prisma.$queryRaw<ClaimedAttempt[]>(Prisma.sql`
      UPDATE "PaymentAttempt"
      SET "reconcileLeaseUntil" = (clock_timestamp() AT TIME ZONE 'UTC') + make_interval(secs => ${RECONCILE_LEASE_SECONDS}),
          "reconcileFence" = "reconcileFence" + 1,
          "updatedAt" = (clock_timestamp() AT TIME ZONE 'UTC')
      WHERE "id" IN (
        SELECT "id" FROM "PaymentAttempt"
        WHERE ${due}
          AND ("reconcileLeaseUntil" IS NULL OR "reconcileLeaseUntil" < (clock_timestamp() AT TIME ZONE 'UTC'))
        ORDER BY "nextReconcileAt" ASC NULLS FIRST
        LIMIT ${bounded}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "providerOrderId", "reconcileFence"
    `);
  }

  /** Claims and reconciles due attempts with a bounded HTTP concurrency. */
  async reconcileDue(kind: ReconcileKind, limit = 10): Promise<ReconcileOutcome[]> {
    const claimed = await this.claimDue(kind, limit);
    return mapWithLimit(claimed, RECONCILE_HTTP_CONCURRENCY, (claim) => this.reconcileClaimed(claim));
  }

  async reconcileClaimed(claim: ClaimedAttempt): Promise<ReconcileOutcome> {
    let outcome: ReconcileOutcome = "failed";
    let retryAfterMs = 0;
    try {
      const providerOrderId = claim.providerOrderId ?? await this.resolveProviderOrderId(claim.id);
      if (!providerOrderId) {
        // Absence is never evidence of non-creation: stock stays held and the attention sweep escalates.
        outcome = "unresolved";
      } else {
        const observation = await this.port.getOrder(providerOrderId);
        const applied = await this.reducer.applyObservation(claim.id, observation, claim.reconcileFence);
        outcome = applied.stale ? "stale" : "applied";
      }
    } catch (error) {
      retryAfterMs = (error instanceof MercadoPagoOrdersError ? error.retryAfterSeconds ?? 0 : 0) * 1_000;
      this.logger.warn(JSON.stringify({ attemptId: claim.id, error: describe(error), event: "payment_reconcile_failed" }));
    }

    if (outcome !== "stale") await this.release(claim, retryAfterMs);
    return outcome;
  }

  /** Unreferenced provider order for an UNKNOWN attempt: bounded search by external reference, never trusting absence. */
  private async resolveProviderOrderId(attemptId: string): Promise<string | null> {
    const attempt = await this.prisma.paymentAttempt.findUnique({
      select: { payment: { select: { orderId: true } } },
      where: { id: attemptId },
    });
    if (!attempt) return null;

    const { orderId } = attempt.payment;
    const found = (await this.port.searchOrders({ externalReference: orderId })).filter((order) => order.externalReference === orderId);
    if (found.length === 0) return null;

    const known = await this.prisma.paymentAttempt.findMany({
      select: { providerOrderId: true },
      where: { providerOrderId: { in: found.map((order) => order.id) } },
    });
    const knownIds = new Set(known.map((row) => row.providerOrderId));
    const unmatched = found.filter((order) => !knownIds.has(order.id));
    if (unmatched.length === 0) return null;

    const unresolved = await this.repository.unresolvedAttemptsWithoutProviderOrder(orderId);
    if (unmatched.length === 1 && unresolved.length === 1 && unresolved[0]!.id === attemptId) return unmatched[0]!.id;

    await this.reducer.flagAttention(attemptId, "ambiguous_provider_orders");
    return null;
  }

  /** Clears the lease and schedules the next read; only the claim that owns the fence may write. */
  private async release(claim: ClaimedAttempt, retryAfterMs: number): Promise<void> {
    try {
      const now = await this.repository.databaseNow();
      const row = await this.prisma.paymentAttempt.findUnique({
        select: { payment: { select: { reviewStartedAt: true } }, status: true, submittedAt: true },
        where: { id: claim.id },
      });
      if (!row) return;

      let nextReconcileAt: Date | undefined;
      if (isUnsettledAttempt(row.status)) {
        const reviewStartedAt = row.status === PaymentAttemptStatus.PROCESSING ? row.payment.reviewStartedAt : null;
        const delay = pendingReconcileDelayMs({
          attemptAgeMs: now.getTime() - row.submittedAt.getTime(),
          reviewAgeMs: reviewStartedAt ? now.getTime() - reviewStartedAt.getTime() : undefined,
        });
        nextReconcileAt = new Date(now.getTime() + Math.max(delay, retryAfterMs));
      } else if (FINANCIAL_ATTEMPT_STATUSES.includes(row.status)) {
        nextReconcileAt = new Date(now.getTime() + Math.max(FINANCIAL_RECONCILE_INTERVAL_MS, retryAfterMs));
      }

      await this.prisma.paymentAttempt.updateMany({
        data: { reconcileLeaseUntil: null, ...(nextReconcileAt ? { nextReconcileAt } : {}) },
        where: { id: claim.id, reconcileFence: claim.reconcileFence },
      });
    } catch (error) {
      // The lease simply expires and the sweep reclaims it.
      this.logger.warn(JSON.stringify({ attemptId: claim.id, error: describe(error), event: "payment_reconcile_release_failed" }));
    }
  }

  /**
   * Releases unpaid orders whose retry window ended. Known provider orders are re-read first (a network failure
   * postpones the release); the cancellation itself is decided under the order lock by the reducer.
   */
  async expireDue(limit = 10): Promise<ExpiryOutcome[]> {
    const now = await this.repository.databaseNow();
    const candidates = await this.prisma.orderPayment.findMany({
      orderBy: { retryUntil: "asc" },
      select: { attempts: { select: { id: true, providerOrderId: true, status: true } }, orderId: true },
      take: Math.min(Math.max(limit, 1), 20),
      where: {
        attempts: { none: { status: { in: [PaymentAttemptStatus.SUBMITTING, PaymentAttemptStatus.UNKNOWN, PaymentAttemptStatus.PROCESSING, PaymentAttemptStatus.ACTION_REQUIRED] } } },
        order: { status: OrderStatus.PENDING },
        provider: PaymentProvider.MERCADOPAGO,
        retryUntil: { lte: now },
        status: PaymentStatus.PENDING,
      },
    });

    return mapWithLimit(candidates, RECONCILE_HTTP_CONCURRENCY, async (candidate): Promise<ExpiryOutcome> => {
      try {
        for (const attempt of candidate.attempts) {
          if (!attempt.providerOrderId || !NONPAYABLE_ATTEMPT_STATUSES.includes(attempt.status)) continue;
          const observation = await this.port.getOrder(attempt.providerOrderId);
          await this.reducer.applyObservation(attempt.id, observation);
        }
        return (await this.reducer.expireUnpaid(candidate.orderId)) ? "released" : "skipped";
      } catch (error) {
        this.logger.warn(JSON.stringify({ error: describe(error), event: "payment_expiry_postponed", orderId: candidate.orderId }));
        return "postponed";
      }
    });
  }
}

function describe(error: unknown): string {
  if (error instanceof MercadoPagoOrdersError) return `provider_${error.category}`;
  return error instanceof Error ? error.name : "unknown";
}
