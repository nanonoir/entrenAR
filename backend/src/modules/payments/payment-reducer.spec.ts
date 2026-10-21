import { PaymentAttemptStatus } from "../../generated/prisma/enums";
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
import { decideTransition, type ReducerInput } from "./payment-reducer";
import { ORDER_EFFECT } from "./payment-status.normalizer";

const EXPECTED = "12345.67";

function input(
  fixture: unknown,
  status: PaymentAttemptStatus,
  overrides: {
    attempt?: Partial<ReducerInput["attempt"]>;
    observation?: Record<string, unknown>;
    otherSuccessExists?: boolean;
  } = {},
): ReducerInput {
  return {
    attempt: {
      providerOrderId: null,
      providerTransactionId: null,
      providerUpdatedAt: null,
      refundedCents: 0,
      status,
      ...overrides.attempt,
    },
    currency: "ARS",
    expectedAmount: EXPECTED,
    observation: toMercadoPagoOrder({ ...(fixture as object), ...overrides.observation }),
    orderId: "order_internal_1",
    otherSuccessExists: overrides.otherSuccessExists ?? false,
  };
}

describe("decideTransition", () => {
  it("approves a verified accredited order and confirms it", () => {
    expect(decideTransition(input(processedAccreditedOrder, PaymentAttemptStatus.SUBMITTING))).toMatchObject({
      attemptStatus: PaymentAttemptStatus.APPROVED,
      kind: "apply",
      orderEffect: ORDER_EFFECT.CONFIRM,
    });
  });

  it.each([
    ["external reference", { external_reference: "someone_elses_order" }, "external_reference_mismatch"],
    ["currency", { currency: "USD" }, "currency_mismatch"],
    ["total amount", { total_amount: "12345.68" }, "total_amount_mismatch"],
  ])("holds for attention instead of approving on %s mismatch", (_label, observation, reason) => {
    expect(decideTransition(input(processedAccreditedOrder, PaymentAttemptStatus.SUBMITTING, { observation })))
      .toEqual({ kind: "attention", reason });
  });

  it("holds for attention when the transaction amount differs from the order total", () => {
    const transactions = {
      payments: [{ ...processedAccreditedOrder.transactions.payments[0], amount: "1.00", paid_amount: "1.00" }],
    };

    expect(decideTransition(input(processedAccreditedOrder, PaymentAttemptStatus.SUBMITTING, { observation: { transactions } })))
      .toEqual({ kind: "attention", reason: "transaction_amount_mismatch" });
  });

  it("holds for attention when the paid amount differs from the order total", () => {
    const transactions = {
      payments: [{ ...processedAccreditedOrder.transactions.payments[0], paid_amount: "10.00" }],
    };

    expect(decideTransition(input(processedAccreditedOrder, PaymentAttemptStatus.SUBMITTING, {
      observation: { total_paid_amount: "10.00", transactions },
    }))).toEqual({ kind: "attention", reason: "paid_amount_mismatch" });
  });

  it("holds for attention when the observation belongs to another provider order", () => {
    expect(decideTransition(input(processedAccreditedOrder, PaymentAttemptStatus.PROCESSING, {
      attempt: { providerOrderId: "ORD_OTHER" },
    }))).toEqual({ kind: "attention", reason: "provider_order_mismatch" });
  });

  it("never turns an unknown outcome into a rejection from a missing or stale observation", () => {
    const decision = decideTransition(input(processingOrder, PaymentAttemptStatus.UNKNOWN));

    expect(decision).toMatchObject({ attemptStatus: PaymentAttemptStatus.PROCESSING, kind: "apply" });
    expect(decision.kind === "apply" && decision.opensRetryWindow).toBe(false);
  });

  it("opens the retry window only for a verified rejection", () => {
    expect(decideTransition(input(failedOrder, PaymentAttemptStatus.PROCESSING))).toMatchObject({
      attemptStatus: PaymentAttemptStatus.REJECTED,
      opensRetryWindow: true,
    });
    expect(decideTransition(input(pendingChallengeOrder, PaymentAttemptStatus.SUBMITTING))).toMatchObject({
      attemptStatus: PaymentAttemptStatus.ACTION_REQUIRED,
      opensRetryWindow: false,
    });
  });

  it("ignores observations older than the stored provider version", () => {
    expect(decideTransition(input(processingOrder, PaymentAttemptStatus.PROCESSING, {
      attempt: { providerUpdatedAt: new Date("2026-10-21T15:00:10.000Z") },
    }))).toEqual({ kind: "ignore", reason: "stale" });
  });

  it("flags a different status at the same provider version on a settled attempt", () => {
    expect(decideTransition(input(refundedOrder, PaymentAttemptStatus.APPROVED, {
      attempt: { providerUpdatedAt: new Date("2026-10-21T15:00:05.000Z") },
    }))).toEqual({ kind: "attention", reason: "same_version_conflict" });
  });

  it("keeps terminal non-paid attempts closed", () => {
    expect(decideTransition(input(processingOrder, PaymentAttemptStatus.REJECTED)))
      .toEqual({ kind: "ignore", reason: "terminal" });
    expect(decideTransition(input(canceledOrder, PaymentAttemptStatus.EXPIRED)))
      .toEqual({ kind: "ignore", reason: "terminal" });
  });

  it("records a success on a closed attempt as an incident, without approving the order", () => {
    expect(decideTransition(input(processedAccreditedOrder, PaymentAttemptStatus.REJECTED)))
      .toEqual({ kind: "incident", reason: "success_on_closed_attempt", recordAttemptStatus: PaymentAttemptStatus.APPROVED });
    expect(decideTransition(input(processedAccreditedOrder, PaymentAttemptStatus.REJECTED, { otherSuccessExists: true })))
      .toEqual({ kind: "incident", reason: "success_on_closed_attempt" });
  });

  it("flags a second success for the same payment", () => {
    expect(decideTransition(input(processedAccreditedOrder, PaymentAttemptStatus.PROCESSING, { otherSuccessExists: true })))
      .toEqual({ kind: "incident", reason: "second_success_for_payment" });
  });

  it("never regresses settled financial state", () => {
    expect(decideTransition(input(processingOrder, PaymentAttemptStatus.APPROVED)))
      .toEqual({ kind: "ignore", reason: "regression" });
    expect(decideTransition(input(processedAccreditedOrder, PaymentAttemptStatus.APPROVED)))
      .toEqual({ kind: "ignore", reason: "duplicate" });
    expect(decideTransition(input(partiallyRefundedOrder, PaymentAttemptStatus.REFUNDED)))
      .toEqual({ kind: "ignore", reason: "regression" });
  });

  it("moves approved payments forward to refunds and chargebacks", () => {
    expect(decideTransition(input(partiallyRefundedOrder, PaymentAttemptStatus.APPROVED)))
      .toMatchObject({ attemptStatus: PaymentAttemptStatus.PARTIALLY_REFUNDED, kind: "apply", refundedCents: 34567 });
    expect(decideTransition(input(refundedOrder, PaymentAttemptStatus.PARTIALLY_REFUNDED)))
      .toMatchObject({ attemptStatus: PaymentAttemptStatus.REFUNDED, kind: "apply" });
    expect(decideTransition(input(chargedBackOrder, PaymentAttemptStatus.APPROVED)))
      .toMatchObject({ attemptStatus: PaymentAttemptStatus.CHARGED_BACK, kind: "apply" });
  });

  it("cancels the order for definitive non-payable outcomes", () => {
    expect(decideTransition(input(canceledOrder, PaymentAttemptStatus.PROCESSING)))
      .toMatchObject({ attemptStatus: PaymentAttemptStatus.CANCELLED, orderEffect: ORDER_EFFECT.CANCEL_IF_NONPAYABLE });
    expect(decideTransition(input(expiredOrder, PaymentAttemptStatus.ACTION_REQUIRED)))
      .toMatchObject({ attemptStatus: PaymentAttemptStatus.EXPIRED, orderEffect: ORDER_EFFECT.CANCEL_IF_NONPAYABLE });
  });
});
