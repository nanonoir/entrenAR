import type { PaymentView } from "@/lib/api/payments/payments.mappers";

/** Customer-facing outcome derived only from the backend view, never from query parameters or SDK payloads. */
export const PAYMENT_RESULT_KIND = {
  ACTION_REQUIRED: "action_required",
  APPROVED: "approved",
  ATTENTION: "attention",
  ENDED: "ended",
  PROCESSING: "processing",
  REJECTED: "rejected",
  VERIFYING: "verifying",
} as const;

export type PaymentResultKind = (typeof PAYMENT_RESULT_KIND)[keyof typeof PAYMENT_RESULT_KIND];

/** Payment states in which the money was collected; the only ones that may use success wording. */
const COLLECTED_PAYMENT_STATUSES = new Set(["paid", "partially_refunded"]);
const REVERSED_PAYMENT_STATUSES = new Set(["refunded", "charged_back"]);

export function resolvePaymentResult(view: PaymentView): PaymentResultKind {
  const payment = view.paymentStatus.toLowerCase();
  if (COLLECTED_PAYMENT_STATUSES.has(payment)) return PAYMENT_RESULT_KIND.APPROVED;
  if (REVERSED_PAYMENT_STATUSES.has(payment)) return PAYMENT_RESULT_KIND.ATTENTION;

  if (view.status === "expired" || view.status === "cancelled" || view.orderStatus === "cancelled") {
    return PAYMENT_RESULT_KIND.ENDED;
  }

  switch (view.attempt?.status) {
    case "action_required":
      return view.challenge ? PAYMENT_RESULT_KIND.ACTION_REQUIRED : PAYMENT_RESULT_KIND.VERIFYING;
    case "processing":
      return PAYMENT_RESULT_KIND.PROCESSING;
    case "rejected":
      return PAYMENT_RESULT_KIND.REJECTED;
    // Submitting, unknown and any future state are unresolved: never success wording.
    default:
      return PAYMENT_RESULT_KIND.VERIFYING;
  }
}

/** Kinds for which no further status change is expected. */
export function isFinalPaymentResult(kind: PaymentResultKind): boolean {
  return kind === PAYMENT_RESULT_KIND.APPROVED
    || kind === PAYMENT_RESULT_KIND.ATTENTION
    || kind === PAYMENT_RESULT_KIND.ENDED;
}

/** The cart and draft are released only once money is verified or the payment is accepted for review. */
export function shouldClearSubmittedCart(view: PaymentView): boolean {
  const kind = resolvePaymentResult(view);
  return kind === PAYMENT_RESULT_KIND.APPROVED
    || kind === PAYMENT_RESULT_KIND.ATTENTION
    || (kind === PAYMENT_RESULT_KIND.PROCESSING && view.acceptedPending);
}

export const POLL_FAST_MS = 3_000;
export const POLL_SLOW_MS = 10_000;
export const POLL_FAST_WINDOW_MS = 60_000;

/** Delay before the next status read; `null` when the result is final. The server hint wins when present. */
export function nextPollDelayMs(view: PaymentView, elapsedMs: number): number | null {
  const kind = resolvePaymentResult(view);
  if (isFinalPaymentResult(kind)) return null;

  if (view.nextPollSeconds !== null) {
    return Math.min(60_000, Math.max(1_000, Math.round(view.nextPollSeconds * 1_000)));
  }
  return elapsedMs < POLL_FAST_WINDOW_MS ? POLL_FAST_MS : POLL_SLOW_MS;
}

/** What the checkout page does with an order recovered from the backend. */
export const BOUND_ORDER_MODE = {
  CHALLENGE: "challenge",
  RESULT: "result",
  RETRY: "retry",
} as const;

export type BoundOrderMode = (typeof BOUND_ORDER_MODE)[keyof typeof BOUND_ORDER_MODE];

export function resolveBoundOrderMode(view: PaymentView): BoundOrderMode {
  const kind = resolvePaymentResult(view);
  if (kind === PAYMENT_RESULT_KIND.ACTION_REQUIRED) return BOUND_ORDER_MODE.CHALLENGE;
  if (kind === PAYMENT_RESULT_KIND.REJECTED && view.retry.eligible) return BOUND_ORDER_MODE.RETRY;
  return BOUND_ORDER_MODE.RESULT;
}

/**
 * Identity of a mounted card Brick: the scope (order + attempt for a retry, a constant for a first
 * submit) plus the authoritative amount. Polling, countdown ticks and unchanged quote refreshes
 * never change it, so the Brick is not re-initialized by them.
 */
export function cardBrickKey(scope: string, amount: number): string {
  return `${scope}:${amount}`;
}

/** Brick scope of the same-order retry: changes only with the order or the rejected attempt. */
export function retryBrickScope(view: PaymentView): string {
  return `retry-${view.orderId}-${view.attempt?.id ?? view.retry.until ?? ""}`;
}

/** Seconds left in the rejected-retry window, relative to the server deadline. */
export function retrySecondsRemaining(until: string | null, nowMs: number): number {
  if (!until) return 0;
  const deadline = Date.parse(until);
  return Number.isNaN(deadline) ? 0 : Math.max(0, Math.ceil((deadline - nowMs) / 1_000));
}
