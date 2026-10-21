import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import {
  CheckoutSessionStatus,
  OrderStatus,
  PaymentAttemptStatus,
  PaymentProvider,
  PaymentStatus,
  Role,
} from "../../generated/prisma/enums";
import {
  MERCADOPAGO_ORDERS_PORT,
  type MercadoPagoOrdersPort,
} from "./mercadopago/mercadopago-orders.port";
import { sanitizeChallengeUrl } from "./payment-card";
import { isUnsettledAttempt } from "./payment-reducer";
import { PaymentReducerService } from "./payment-reducer.service";
import { PaymentsRepository, type PaymentOrderRecord } from "./payments.repository";

export const PAYMENT_CHALLENGE_POLL_SECONDS = 3;
export const PAYMENT_UNSETTLED_POLL_SECONDS = 5;
export const PAYMENT_CHALLENGE_LIFETIME_MS = 40 * 60 * 1_000;
export const PAYMENT_REFRESH_CACHE_MS = 3_000;
const REFRESH_CACHE_MAX_ENTRIES = 500;

export interface PaymentOwner {
  role?: Role;
  sessionToken?: string;
  userId?: string;
}

export interface PaymentStatusView {
  acceptedPending: boolean;
  amount: number;
  attempt: { id: string; number: number; status: string } | null;
  cartFinalized: boolean;
  challenge: { createdAt: string; expectedExpiresAt: string; pollAfterSeconds: number; url: string } | null;
  currency: string;
  nextPollSeconds: number | null;
  ok: true;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  reasonCode: string | null;
  reconciling: boolean;
  refundedAmount: number;
  retry: { eligible: boolean; until: string | null };
  status: string;
  version: number;
}

interface RefreshResult {
  at: number;
  challengeUrl?: string;
}

/** Owner-scoped, normalized payment status. Reads cached state and refreshes the provider only when due. */
@Injectable()
export class PaymentStatusService {
  private readonly inflight = new Map<string, Promise<RefreshResult>>();
  private readonly recent = new Map<string, RefreshResult>();

  constructor(
    private readonly repository: PaymentsRepository,
    private readonly reducer: PaymentReducerService,
    @Inject(MERCADOPAGO_ORDERS_PORT) private readonly port: MercadoPagoOrdersPort,
  ) {}

  async statusForOrder(orderId: string, owner: PaymentOwner): Promise<PaymentStatusView> {
    this.assertActor(owner);
    return this.viewOwnedOrder(orderId, owner);
  }

  /** Same view as `statusForOrder` for the order bound to the owner's checkout, or `null` when there is none. */
  async activeForOwner(owner: PaymentOwner): Promise<PaymentStatusView | null> {
    this.assertActor(owner);

    const session = owner.sessionToken ? await this.repository.sessionByToken(owner.sessionToken) : null;
    const sessionValid = session !== null && this.sessionUsable(session, owner);
    if (!owner.userId && !sessionValid) throw this.invalidSession();

    let orderId = sessionValid ? await this.repository.orderIdBySession(session.id) : null;
    if (!orderId && owner.userId) orderId = await this.repository.latestPendingOrderIdByUser(owner.userId);
    if (!orderId) return null;

    return this.viewOwnedOrder(orderId, owner);
  }

  /** Throws 404 for unknown orders and for orders the caller does not own, so existence is not disclosed. */
  async assertOwnedOrder(orderId: string, owner: PaymentOwner): Promise<PaymentOrderRecord> {
    this.assertActor(owner);
    if (!owner.userId && !owner.sessionToken) throw this.invalidSession();

    const order = await this.repository.orderById(orderId);
    if (!order || order.payment?.provider !== PaymentProvider.MERCADOPAGO) throw this.notFound();
    if (!(await this.isOwner(order, owner))) throw this.notFound();
    return order;
  }

  assertActor(owner: PaymentOwner): void {
    if (owner.role === Role.ADMIN) {
      throw new ForbiddenException({ code: ERROR_CODE.FORBIDDEN, message: "Forbidden.", ok: false });
    }
    if (owner.role === Role.CUSTOMER && !owner.userId) {
      throw new UnauthorizedException({ code: ERROR_CODE.UNAUTHORIZED, message: "Unauthorized.", ok: false });
    }
  }

  async viewOwnedOrder(orderId: string, owner: PaymentOwner): Promise<PaymentStatusView> {
    let order = await this.assertOwnedOrder(orderId, owner);
    const refresh = await this.refreshIfDue(order);
    if (refresh.refreshed) order = (await this.repository.orderById(orderId)) ?? order;

    return this.buildView(order, refresh.challengeUrl, refresh.reconciling);
  }

  async buildView(order: PaymentOrderRecord, challengeUrl?: string, reconciling = false): Promise<PaymentStatusView> {
    const payment = order.payment!;
    const attempt = payment.attempts[0] ?? null;
    const now = await this.repository.databaseNow();
    const sessionStatus = order.checkoutSessionId ? await this.repository.sessionStatus(order.checkoutSessionId) : null;
    const unsettled = attempt !== null && isUnsettledAttempt(attempt.status);
    const challengeActive = attempt?.status === PaymentAttemptStatus.ACTION_REQUIRED && challengeUrl !== undefined;
    const createdAt = attempt?.challengeCreatedAt ?? null;
    const retryEligible = order.status === OrderStatus.PENDING
      && payment.status === PaymentStatus.PENDING
      && attempt?.status === PaymentAttemptStatus.REJECTED
      && payment.retryUntil !== null
      && now < payment.retryUntil;

    return {
      acceptedPending: attempt?.status === PaymentAttemptStatus.PROCESSING,
      amount: Number(order.total),
      attempt: attempt ? { id: attempt.id, number: attempt.attemptNumber, status: attempt.status.toLowerCase() } : null,
      cartFinalized: sessionStatus === CheckoutSessionStatus.COMPLETED,
      challenge: challengeActive && createdAt
        ? {
            createdAt: createdAt.toISOString(),
            expectedExpiresAt: new Date(createdAt.getTime() + PAYMENT_CHALLENGE_LIFETIME_MS).toISOString(),
            pollAfterSeconds: PAYMENT_CHALLENGE_POLL_SECONDS,
            url: challengeUrl,
          }
        : null,
      currency: order.currency,
      nextPollSeconds: !unsettled
        ? null
        : attempt.status === PaymentAttemptStatus.ACTION_REQUIRED
          ? PAYMENT_CHALLENGE_POLL_SECONDS
          : PAYMENT_UNSETTLED_POLL_SECONDS,
      ok: true,
      orderId: order.id,
      orderNumber: order.number,
      orderStatus: order.status.toLowerCase(),
      paymentStatus: payment.status.toLowerCase(),
      reasonCode: reasonCode(attempt?.status),
      reconciling,
      refundedAmount: Number(payment.refundedAmount),
      retry: { eligible: retryEligible, until: payment.retryUntil?.toISOString() ?? null },
      status: overallStatus(order.status, payment.status, attempt?.status),
      version: payment.rowVersion,
    };
  }

  private async isOwner(order: PaymentOrderRecord, owner: PaymentOwner): Promise<boolean> {
    if (owner.userId) return order.userId === owner.userId;
    if (!owner.sessionToken || !order.checkoutSessionId) return false;

    const session = await this.repository.sessionByToken(owner.sessionToken);
    return session !== null && session.id === order.checkoutSessionId && this.sessionUsable(session, owner);
  }

  private sessionUsable(session: { expiresAt: Date | null; status: string; userId: string | null }, owner: PaymentOwner): boolean {
    if (session.status !== CheckoutSessionStatus.ACTIVE && session.status !== CheckoutSessionStatus.COMPLETED) return false;
    if (session.expiresAt !== null && session.expiresAt <= new Date()) return false;
    return session.userId === null || session.userId === owner.userId;
  }

  private async refreshIfDue(
    order: PaymentOrderRecord,
  ): Promise<{ challengeUrl?: string; reconciling: boolean; refreshed: boolean }> {
    const attempt = order.payment?.attempts[0];
    if (!attempt || !isUnsettledAttempt(attempt.status)) return { reconciling: false, refreshed: false };
    if (!attempt.providerOrderId) return { reconciling: true, refreshed: false };

    const challenge = attempt.status === PaymentAttemptStatus.ACTION_REQUIRED;
    const cached = this.recent.get(attempt.id);
    if (cached && Date.now() - cached.at < PAYMENT_REFRESH_CACHE_MS) {
      return { ...(cached.challengeUrl ? { challengeUrl: cached.challengeUrl } : {}), reconciling: false, refreshed: false };
    }

    const due = challenge || attempt.nextReconcileAt === null || attempt.nextReconcileAt <= new Date();
    if (!due) return { reconciling: false, refreshed: false };

    try {
      const result = await this.coalescedRefresh(attempt.id, attempt.providerOrderId);
      return { ...(result.challengeUrl ? { challengeUrl: result.challengeUrl } : {}), reconciling: false, refreshed: true };
    } catch {
      // Provider or persistence errors never fail a status read; the cached state is still authoritative enough.
      return { reconciling: true, refreshed: false };
    }
  }

  private coalescedRefresh(attemptId: string, providerOrderId: string): Promise<RefreshResult> {
    const existing = this.inflight.get(attemptId);
    if (existing) return existing;

    const pending = this.refreshFromProvider(attemptId, providerOrderId).finally(() => {
      this.inflight.delete(attemptId);
    });
    this.inflight.set(attemptId, pending);
    return pending;
  }

  private async refreshFromProvider(attemptId: string, providerOrderId: string): Promise<RefreshResult> {
    const observation = await this.port.getOrder(providerOrderId);
    const applied = await this.reducer.applyObservation(attemptId, observation);
    const challengeUrl = applied.attemptStatus === PaymentAttemptStatus.ACTION_REQUIRED
      ? sanitizeChallengeUrl(observation.transactions[0]?.transactionSecurityUrl)
      : undefined;
    const result: RefreshResult = { at: Date.now(), ...(challengeUrl ? { challengeUrl } : {}) };

    if (this.recent.size >= REFRESH_CACHE_MAX_ENTRIES) {
      for (const [key, value] of this.recent) {
        if (Date.now() - value.at >= PAYMENT_REFRESH_CACHE_MS) this.recent.delete(key);
      }
      if (this.recent.size >= REFRESH_CACHE_MAX_ENTRIES) this.recent.clear();
    }
    this.recent.set(attemptId, result);

    return result;
  }

  private invalidSession(): UnauthorizedException {
    return new UnauthorizedException({
      code: ERROR_CODE.CHECKOUT_SESSION_INVALID,
      message: "The checkout session is invalid or expired.",
      ok: false,
    });
  }

  private notFound(): NotFoundException {
    return new NotFoundException({ code: ERROR_CODE.NOT_FOUND, message: "The payment was not found.", ok: false });
  }
}

function reasonCode(status: PaymentAttemptStatus | undefined): string | null {
  switch (status) {
    case PaymentAttemptStatus.REJECTED:
      return "payment_rejected";
    case PaymentAttemptStatus.UNKNOWN:
      return "payment_unavailable";
    case PaymentAttemptStatus.EXPIRED:
      return "payment_expired";
    case PaymentAttemptStatus.CANCELLED:
      return "payment_cancelled";
    default:
      return null;
  }
}

function overallStatus(
  orderStatus: OrderStatus,
  paymentStatus: PaymentStatus,
  attemptStatus: PaymentAttemptStatus | undefined,
): string {
  if (paymentStatus !== PaymentStatus.PENDING) return paymentStatus.toLowerCase();
  if (orderStatus === OrderStatus.CANCELLED) {
    return attemptStatus === PaymentAttemptStatus.EXPIRED ? "expired" : "cancelled";
  }
  return attemptStatus ? attemptStatus.toLowerCase() : "pending";
}
