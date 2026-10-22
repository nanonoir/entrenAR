import { PaymentAttemptStatus, PaymentStatus } from "../../generated/prisma/enums";
import type { MercadoPagoOrder } from "./mercadopago/mercadopago-orders.port";
import { toCents } from "./mercadopago/mercadopago-orders.schemas";
import {
  normalizeProviderStatus,
  type FulfillmentHoldReason,
  type OrderEffect,
} from "./payment-status.normalizer";

export const PAYMENT_RETRY_WINDOW_MS = 10 * 60 * 1_000;
export const PAYMENT_CURRENCY = "ARS";

const UNSETTLED_STATUSES: ReadonlySet<PaymentAttemptStatus> = new Set([
  PaymentAttemptStatus.SUBMITTING,
  PaymentAttemptStatus.UNKNOWN,
  PaymentAttemptStatus.PROCESSING,
  PaymentAttemptStatus.ACTION_REQUIRED,
]);
const FINAL_NONPAY_STATUSES: ReadonlySet<PaymentAttemptStatus> = new Set([
  PaymentAttemptStatus.REJECTED,
  PaymentAttemptStatus.CANCELLED,
  PaymentAttemptStatus.EXPIRED,
]);
const SUCCESS_STATUSES: ReadonlySet<PaymentAttemptStatus> = new Set([
  PaymentAttemptStatus.APPROVED,
  PaymentAttemptStatus.PARTIALLY_REFUNDED,
  PaymentAttemptStatus.REFUNDED,
  PaymentAttemptStatus.CHARGED_BACK,
]);

export const isUnsettledAttempt = (status: PaymentAttemptStatus): boolean => UNSETTLED_STATUSES.has(status);
export const isFinalNonPayAttempt = (status: PaymentAttemptStatus): boolean => FINAL_NONPAY_STATUSES.has(status);
export const isSuccessAttempt = (status: PaymentAttemptStatus): boolean => SUCCESS_STATUSES.has(status);

export interface ReducerAttemptState {
  providerOrderId: string | null;
  providerTransactionId: string | null;
  providerUpdatedAt: Date | null;
  refundedCents: number;
  status: PaymentAttemptStatus;
}

export interface ReducerInput {
  attempt: ReducerAttemptState;
  /** Decimal string with two places: the frozen order total this attempt must charge. */
  expectedAmount: string;
  currency: string;
  observation: MercadoPagoOrder;
  orderId: string;
  /** True when another attempt of the same payment already holds a success-family status. */
  otherSuccessExists: boolean;
}

export interface ApplyDecision {
  attemptStatus: PaymentAttemptStatus;
  attentionReason?: string;
  holds: FulfillmentHoldReason[];
  kind: "apply";
  observedAt: Date | null;
  opensRetryWindow: boolean;
  orderEffect: OrderEffect;
  paymentStatus: PaymentStatus;
  refundedCents: number;
}

export type ReducerDecision =
  | ApplyDecision
  /** Observation cannot be reconciled with the frozen order: hold for attention, change no financial state. */
  | { kind: "attention"; reason: string }
  /** Contradictory success: record what is safe, block fulfillment and flag it. */
  | { kind: "incident"; reason: string; recordAttemptStatus?: PaymentAttemptStatus }
  | { kind: "ignore"; reason: "duplicate" | "regression" | "stale" | "terminal" };

/** Returns the first identity/amount mismatch between the provider order and the frozen order, if any. */
export function validateObservation(input: ReducerInput): string | undefined {
  const { attempt, observation } = input;
  const transaction = observation.transactions[0];

  if (observation.externalReference !== input.orderId) return "external_reference_mismatch";
  if (input.currency !== PAYMENT_CURRENCY || observation.currency?.toUpperCase() !== PAYMENT_CURRENCY) return "currency_mismatch";
  if (observation.totalAmount !== input.expectedAmount) return "total_amount_mismatch";
  if (observation.transactions.length !== 1 || !transaction) return "transaction_count_mismatch";
  if (transaction.amount !== input.expectedAmount) return "transaction_amount_mismatch";
  if (attempt.providerOrderId && attempt.providerOrderId !== observation.id) return "provider_order_mismatch";
  if (attempt.providerTransactionId && attempt.providerTransactionId !== transaction.id) return "provider_transaction_mismatch";

  return undefined;
}

/**
 * Pure transition decision. Monotonic: settled financial state never regresses, unknown or inconsistent
 * observations never become rejections or approvals, and stale observations are ignored.
 */
export function decideTransition(input: ReducerInput): ReducerDecision {
  const mismatch = validateObservation(input);
  if (mismatch) return { kind: "attention", reason: mismatch };

  const { attempt, observation } = input;
  const outcome = normalizeProviderStatus({ order: observation, paidAmount: input.expectedAmount });
  const transaction = observation.transactions[0]!;

  if (outcome.attemptStatus === PaymentAttemptStatus.APPROVED) {
    const paid = transaction.paidAmount ?? observation.totalPaidAmount;
    if (paid !== input.expectedAmount) return { kind: "attention", reason: "paid_amount_mismatch" };
  }

  const observedAt = parseObservedAt(observation.lastUpdatedAt);
  if (observedAt && attempt.providerUpdatedAt) {
    if (observedAt.getTime() < attempt.providerUpdatedAt.getTime()) return { kind: "ignore", reason: "stale" };
    if (
      observedAt.getTime() === attempt.providerUpdatedAt.getTime()
      && !isUnsettledAttempt(attempt.status)
      && outcome.attemptStatus !== attempt.status
    ) {
      return { kind: "attention", reason: "same_version_conflict" };
    }
  }

  const from = attempt.status;
  const to = outcome.attemptStatus;
  const refundedCents = toCents(observation.refundedAmount);

  if (isFinalNonPayAttempt(from)) {
    if (isSuccessAttempt(to)) {
      return {
        kind: "incident",
        reason: "success_on_closed_attempt",
        ...(input.otherSuccessExists ? {} : { recordAttemptStatus: to }),
      };
    }
    return { kind: "ignore", reason: "terminal" };
  }

  if (isSuccessAttempt(from)) {
    if (!isAllowedSuccessTransition(from, to, attempt.refundedCents, refundedCents)) {
      return { kind: "ignore", reason: from === to ? "duplicate" : "regression" };
    }
  } else if (isSuccessAttempt(to) && input.otherSuccessExists) {
    return { kind: "incident", reason: "second_success_for_payment" };
  }

  return {
    attemptStatus: to,
    ...(outcome.needsAttention && outcome.anomaly ? { attentionReason: outcome.anomaly } : {}),
    holds: outcome.fulfillmentHold ? [outcome.fulfillmentHold] : [],
    kind: "apply",
    observedAt,
    opensRetryWindow: outcome.opensRetryWindow,
    orderEffect: outcome.orderEffect,
    paymentStatus: outcome.paymentStatus,
    refundedCents,
  };
}

function isAllowedSuccessTransition(
  from: PaymentAttemptStatus,
  to: PaymentAttemptStatus,
  currentRefundedCents: number,
  nextRefundedCents: number,
): boolean {
  switch (from) {
    case PaymentAttemptStatus.APPROVED:
      return to === PaymentAttemptStatus.PARTIALLY_REFUNDED
        || to === PaymentAttemptStatus.REFUNDED
        || to === PaymentAttemptStatus.CHARGED_BACK;
    case PaymentAttemptStatus.PARTIALLY_REFUNDED:
      return (to === PaymentAttemptStatus.PARTIALLY_REFUNDED && nextRefundedCents > currentRefundedCents)
        || to === PaymentAttemptStatus.REFUNDED
        || to === PaymentAttemptStatus.CHARGED_BACK;
    default:
      return false;
  }
}

function parseObservedAt(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
