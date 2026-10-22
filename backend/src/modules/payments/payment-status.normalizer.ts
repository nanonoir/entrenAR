import { PaymentAttemptStatus, PaymentStatus } from "../../generated/prisma/enums";
import type { MercadoPagoOrder, MercadoPagoTransaction } from "./mercadopago/mercadopago-orders.port";
import { toCents } from "./mercadopago/mercadopago-orders.schemas";

/** What the reducer should do with the internal order once the attempt state is applied. */
export const ORDER_EFFECT = {
  /** Order stays PENDING with stock held. */
  KEEP_PENDING: "keep_pending",
  /** Order becomes CONFIRMED (payment received). */
  CONFIRM: "confirm",
  /** Order may be cancelled once no other attempt is potentially payable. */
  CANCEL_IF_NONPAYABLE: "cancel_if_nonpayable",
  /** Order lifecycle is retained; only the payment summary changes. */
  RETAIN_LIFECYCLE: "retain_lifecycle",
} as const;

export type OrderEffect = (typeof ORDER_EFFECT)[keyof typeof ORDER_EFFECT];

export type FulfillmentHoldReason = "dispute" | "full_refund" | "unverified_provider_state";

export interface ProviderStatusInput {
  /** Amount originally paid (the attempt's expected amount), decimal string; used to classify refunds. */
  paidAmount: string;
  order: Pick<MercadoPagoOrder, "chargebacks" | "refundedAmount" | "status" | "statusDetail" | "transactions">;
}

export interface ProviderStatusOutcome {
  attemptStatus: PaymentAttemptStatus;
  /** Reason the observation is unexpected, when `needsAttention` is set. */
  anomaly?: string;
  fulfillmentHold?: FulfillmentHoldReason;
  /** Opens the 10-minute rejected-retry window. */
  opensRetryWindow: boolean;
  needsAttention: boolean;
  orderEffect: OrderEffect;
  paymentStatus: PaymentStatus;
  /** Stock safety: the provider may still collect money for this attempt. */
  potentiallyPayable: boolean;
}

const LIVE_TRANSACTION_STATUSES = new Set(["created", "processing", "action_required", "processed"]);

/**
 * Pure mapping of a provider observation to the internal attempt/payment state.
 * It never decides persistence or monotonic ordering: the reducer must still reject regressions.
 * Unknown or inconsistent observations are never rejections; they stay potentially payable with attention.
 */
export function normalizeProviderStatus(input: ProviderStatusInput): ProviderStatusOutcome {
  const { order } = input;
  const status = order.status.toLowerCase();
  const detail = order.statusDetail.toLowerCase();
  const transaction = order.transactions[0];
  const transactionStatus = transaction?.status.toLowerCase();
  const transactionDetail = transaction?.statusDetail.toLowerCase();

  if (order.transactions.length > 1) return anomaly("multiple_payment_transactions");

  switch (status) {
    case "created":
      return pending(PaymentAttemptStatus.PROCESSING);
    case "processing":
      return pending(PaymentAttemptStatus.PROCESSING);
    case "action_required":
      return detail === "pending_challenge"
        ? pending(PaymentAttemptStatus.ACTION_REQUIRED)
        : anomaly(`action_required_${detail || "unspecified"}`, PaymentAttemptStatus.ACTION_REQUIRED);
    case "processed":
      return normalizeProcessed(input, detail, transaction);
    case "failed":
      if (detail === "expired" || transactionDetail === "expired") return nonpayable(order, PaymentAttemptStatus.EXPIRED);
      if (transactionStatus !== "failed") return anomaly("failed_order_without_failed_transaction");
      return { ...base(PaymentAttemptStatus.REJECTED, PaymentStatus.PENDING, ORDER_EFFECT.KEEP_PENDING), opensRetryWindow: true, potentiallyPayable: false };
    case "canceled":
    case "cancelled":
      return nonpayable(order, detail === "expired" ? PaymentAttemptStatus.EXPIRED : PaymentAttemptStatus.CANCELLED);
    case "expired":
      return nonpayable(order, PaymentAttemptStatus.EXPIRED);
    case "refunded":
      return normalizeRefund(input, true);
    case "charged_back":
      return {
        ...base(PaymentAttemptStatus.CHARGED_BACK, PaymentStatus.CHARGED_BACK, ORDER_EFFECT.RETAIN_LIFECYCLE),
        fulfillmentHold: "dispute",
        potentiallyPayable: false,
      };
    default:
      return anomaly(`unknown_order_status_${status}`);
  }
}

function normalizeProcessed(input: ProviderStatusInput, detail: string, transaction: MercadoPagoTransaction | undefined): ProviderStatusOutcome {
  if (detail === "partially_refunded") return normalizeRefund(input, false);
  if (detail !== "accredited") return anomaly(`processed_${detail || "unspecified"}`);
  if (!transaction || transaction.status.toLowerCase() !== "processed" || transaction.statusDetail.toLowerCase() !== "accredited") {
    return anomaly("accredited_order_without_accredited_transaction", PaymentAttemptStatus.PROCESSING);
  }

  return { ...base(PaymentAttemptStatus.APPROVED, PaymentStatus.PAID, ORDER_EFFECT.CONFIRM), potentiallyPayable: false };
}

function normalizeRefund(input: ProviderStatusInput, expectFull: boolean): ProviderStatusOutcome {
  const paid = toCents(input.paidAmount);
  const refunded = toCents(input.order.refundedAmount);

  if (refunded <= 0 || refunded > paid) return anomaly("refund_total_unverified");

  if (refunded === paid) {
    return {
      ...base(PaymentAttemptStatus.REFUNDED, PaymentStatus.REFUNDED, ORDER_EFFECT.RETAIN_LIFECYCLE),
      fulfillmentHold: "full_refund",
      potentiallyPayable: false,
    };
  }

  if (expectFull) return anomaly("refunded_status_with_partial_total");

  return { ...base(PaymentAttemptStatus.PARTIALLY_REFUNDED, PaymentStatus.PARTIALLY_REFUNDED, ORDER_EFFECT.RETAIN_LIFECYCLE), potentiallyPayable: false };
}

/** Canceled/expired orders are nonpayable only when no transaction is still live. */
function nonpayable(order: ProviderStatusInput["order"], attemptStatus: PaymentAttemptStatus): ProviderStatusOutcome {
  if (order.transactions.some((transaction) => LIVE_TRANSACTION_STATUSES.has(transaction.status.toLowerCase()))) {
    return anomaly("closed_order_with_live_transaction");
  }

  return { ...base(attemptStatus, PaymentStatus.PENDING, ORDER_EFFECT.CANCEL_IF_NONPAYABLE), potentiallyPayable: false };
}

function pending(attemptStatus: PaymentAttemptStatus): ProviderStatusOutcome {
  return { ...base(attemptStatus, PaymentStatus.PENDING, ORDER_EFFECT.KEEP_PENDING), potentiallyPayable: true };
}

function anomaly(reason: string, attemptStatus: PaymentAttemptStatus = PaymentAttemptStatus.ACTION_REQUIRED): ProviderStatusOutcome {
  return {
    ...base(attemptStatus, PaymentStatus.PENDING, ORDER_EFFECT.KEEP_PENDING),
    anomaly: reason,
    fulfillmentHold: "unverified_provider_state",
    needsAttention: true,
    potentiallyPayable: true,
  };
}

function base(attemptStatus: PaymentAttemptStatus, paymentStatus: PaymentStatus, orderEffect: OrderEffect): ProviderStatusOutcome {
  return { attemptStatus, needsAttention: false, opensRetryWindow: false, orderEffect, paymentStatus, potentiallyPayable: false };
}
