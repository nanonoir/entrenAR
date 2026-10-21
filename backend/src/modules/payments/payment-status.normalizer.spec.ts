import { PaymentAttemptStatus, PaymentStatus } from "../../generated/prisma/enums";
import {
  canceledOrder,
  chargedBackOrder,
  expiredOrder,
  failedOrder,
  partiallyRefundedOrder,
  pendingChallengeOrder,
  processedAccreditedOrder,
  processingOrder,
  refundedOrder,
} from "./mercadopago/__fixtures__/orders.fixtures";
import { toMercadoPagoOrder } from "./mercadopago/mercadopago-orders.schemas";
import { normalizeProviderStatus, ORDER_EFFECT } from "./payment-status.normalizer";

const PAID_AMOUNT = "12345.67";

function normalize(fixture: unknown, overrides: Record<string, unknown> = {}) {
  return normalizeProviderStatus({ order: toMercadoPagoOrder({ ...(fixture as object), ...overrides }), paidAmount: PAID_AMOUNT });
}

describe("normalizeProviderStatus", () => {
  it("maps processed/accredited with an accredited transaction to APPROVED and confirms the order", () => {
    expect(normalize(processedAccreditedOrder)).toMatchObject({
      attemptStatus: PaymentAttemptStatus.APPROVED,
      needsAttention: false,
      orderEffect: ORDER_EFFECT.CONFIRM,
      paymentStatus: PaymentStatus.PAID,
      potentiallyPayable: false,
    });
  });

  it("does not approve an accredited order whose transaction is not accredited", () => {
    const outcome = normalize(processedAccreditedOrder, {
      transactions: { payments: [{ ...processedAccreditedOrder.transactions.payments[0], status: "processing", status_detail: "in_process" }] },
    });

    expect(outcome.attemptStatus).toBe(PaymentAttemptStatus.PROCESSING);
    expect(outcome.paymentStatus).toBe(PaymentStatus.PENDING);
    expect(outcome.needsAttention).toBe(true);
    expect(outcome.orderEffect).toBe(ORDER_EFFECT.KEEP_PENDING);
  });

  it("maps a final failed order to REJECTED and opens the retry window", () => {
    expect(normalize(failedOrder)).toMatchObject({
      attemptStatus: PaymentAttemptStatus.REJECTED,
      opensRetryWindow: true,
      orderEffect: ORDER_EFFECT.KEEP_PENDING,
      paymentStatus: PaymentStatus.PENDING,
      potentiallyPayable: false,
    });
  });

  it("maps processing and pending_challenge to held states without a retry window", () => {
    expect(normalize(processingOrder)).toMatchObject({ attemptStatus: PaymentAttemptStatus.PROCESSING, opensRetryWindow: false, potentiallyPayable: true });
    expect(normalize(pendingChallengeOrder)).toMatchObject({
      attemptStatus: PaymentAttemptStatus.ACTION_REQUIRED,
      needsAttention: false,
      opensRetryWindow: false,
      potentiallyPayable: true,
    });
  });

  it("flags other action_required variants for attention instead of rejecting them", () => {
    const outcome = normalize(pendingChallengeOrder, { status_detail: "waiting_retry" });

    expect(outcome).toMatchObject({ attemptStatus: PaymentAttemptStatus.ACTION_REQUIRED, needsAttention: true, potentiallyPayable: true });
  });

  it("maps canceled and expired orders to nonpayable cancellation outcomes", () => {
    expect(normalize(canceledOrder)).toMatchObject({
      attemptStatus: PaymentAttemptStatus.CANCELLED,
      orderEffect: ORDER_EFFECT.CANCEL_IF_NONPAYABLE,
      potentiallyPayable: false,
    });
    expect(normalize(expiredOrder)).toMatchObject({ attemptStatus: PaymentAttemptStatus.EXPIRED, orderEffect: ORDER_EFFECT.CANCEL_IF_NONPAYABLE });
    expect(normalize(failedOrder, { status_detail: "expired" }).attemptStatus).toBe(PaymentAttemptStatus.EXPIRED);
    expect(normalize(canceledOrder, { status_detail: "expired" }).attemptStatus).toBe(PaymentAttemptStatus.EXPIRED);
  });

  it("never cancels a closed order that still has a live transaction", () => {
    const outcome = normalize(canceledOrder, {
      transactions: { payments: [{ ...canceledOrder.transactions.payments[0], status: "processed", status_detail: "accredited" }] },
    });

    expect(outcome).toMatchObject({ needsAttention: true, orderEffect: ORDER_EFFECT.KEEP_PENDING, potentiallyPayable: true });
  });

  it("maps verified partial refunds without a fulfillment hold", () => {
    const outcome = normalize(partiallyRefundedOrder);

    expect(outcome).toMatchObject({
      attemptStatus: PaymentAttemptStatus.PARTIALLY_REFUNDED,
      orderEffect: ORDER_EFFECT.RETAIN_LIFECYCLE,
      paymentStatus: PaymentStatus.PARTIALLY_REFUNDED,
    });
    expect(outcome.fulfillmentHold).toBeUndefined();
  });

  it("maps verified full refunds and blocks fulfillment", () => {
    expect(normalize(refundedOrder)).toMatchObject({
      attemptStatus: PaymentAttemptStatus.REFUNDED,
      fulfillmentHold: "full_refund",
      orderEffect: ORDER_EFFECT.RETAIN_LIFECYCLE,
      paymentStatus: PaymentStatus.REFUNDED,
    });
  });

  it("does not trust refund statuses without a verified refund total", () => {
    const unverified = normalize(partiallyRefundedOrder, { transactions: { payments: partiallyRefundedOrder.transactions.payments.map((p) => ({ ...p, refunded_amount: "0.00" })), refunds: [] } });
    const mismatched = normalize(refundedOrder, { transactions: { payments: refundedOrder.transactions.payments, refunds: partiallyRefundedOrder.transactions.refunds } });

    expect(unverified).toMatchObject({ anomaly: "refund_total_unverified", needsAttention: true, potentiallyPayable: true });
    expect(mismatched).toMatchObject({ anomaly: "refunded_status_with_partial_total", needsAttention: true });
  });

  it.each(["in_process", "settled", "reimbursed"])("maps charged_back/%s to CHARGED_BACK with a dispute hold", (detail) => {
    expect(normalize(chargedBackOrder, { status_detail: detail })).toMatchObject({
      attemptStatus: PaymentAttemptStatus.CHARGED_BACK,
      fulfillmentHold: "dispute",
      orderEffect: ORDER_EFFECT.RETAIN_LIFECYCLE,
      paymentStatus: PaymentStatus.CHARGED_BACK,
    });
  });

  it("keeps unknown future statuses potentially payable and never maps them to rejected", () => {
    for (const status of ["pending_review_v2", "on_hold", "", "FAILED_SOON"]) {
      const outcome = normalizeProviderStatus({
        order: { chargebacks: [], refundedAmount: "0.00", status: status || "unknown", statusDetail: "whatever", transactions: [] },
        paidAmount: PAID_AMOUNT,
      });

      expect(outcome.attemptStatus).not.toBe(PaymentAttemptStatus.REJECTED);
      expect(outcome.opensRetryWindow).toBe(false);
      expect(outcome.potentiallyPayable).toBe(true);
      expect(outcome.needsAttention).toBe(true);
      expect(outcome.paymentStatus).toBe(PaymentStatus.PENDING);
    }
  });

  it("does not reject a failed order without a failed transaction", () => {
    const outcome = normalize(failedOrder, { transactions: { payments: [] } });

    expect(outcome.attemptStatus).not.toBe(PaymentAttemptStatus.REJECTED);
    expect(outcome.needsAttention).toBe(true);
  });

  it("flags unexpected extra payable transactions", () => {
    const payment = processedAccreditedOrder.transactions.payments[0];
    const outcome = normalize(processedAccreditedOrder, { transactions: { payments: [payment, { ...payment, id: "PAY01TESTPAYMENT00000000002" }] } });

    expect(outcome).toMatchObject({ anomaly: "multiple_payment_transactions", needsAttention: true });
    expect(outcome.attemptStatus).not.toBe(PaymentAttemptStatus.APPROVED);
  });
});
