import { ConflictException } from "@nestjs/common";

import { ERROR_CODE, type ErrorCode } from "../../common/errors/api-error.response";
import { PaymentAttemptStatus, PaymentProvider, PaymentStatus } from "../../generated/prisma/enums";
import { SALE_COMMAND } from "./sales.schemas";
import type { SalesOrderRecord } from "./sales.mapper";

type OrderPayment = NonNullable<SalesOrderRecord["payment"]>;

/** Attempts that can still produce a charge: cancelling or releasing stock under them is unsafe. */
const PAYABLE_ATTEMPT_STATUSES: ReadonlySet<PaymentAttemptStatus> = new Set([
  PaymentAttemptStatus.SUBMITTING,
  PaymentAttemptStatus.UNKNOWN,
  PaymentAttemptStatus.PROCESSING,
  PaymentAttemptStatus.ACTION_REQUIRED,
]);

const REFUND_INSTRUCTION = "Refund the payment from the Mercado Pago panel and wait until the full refund is verified here before cancelling.";

export function isProviderManaged(order: Pick<SalesOrderRecord, "payment">): boolean {
  return order.payment?.provider === PaymentProvider.MERCADOPAGO;
}

export function hasPayableAttempt(payment: OrderPayment): boolean {
  return payment.attempts.some((attempt) => PAYABLE_ATTEMPT_STATUSES.has(attempt.status));
}

export function paymentConflict(code: ErrorCode, message: string): ConflictException {
  return new ConflictException({ code, message, ok: false });
}

/** Commands that would let an operator assert payment truth or move a live gateway order's ledger ownership. */
export function assertManualCommandAllowed(order: SalesOrderRecord, command: typeof SALE_COMMAND.CONFIRM | typeof SALE_COMMAND.REOPEN | typeof SALE_COMMAND.CONVERT_ORDER_TO_SALE): void {
  if (!isProviderManaged(order)) return;
  const messages = {
    [SALE_COMMAND.CONFIRM]: "Mercado Pago payments cannot be marked as received manually; only verified provider state confirms receipt.",
    [SALE_COMMAND.CONVERT_ORDER_TO_SALE]: "Mercado Pago orders cannot be converted into manual sales.",
    [SALE_COMMAND.REOPEN]: "Cancelled Mercado Pago orders cannot be reopened manually.",
  } as const;
  throw paymentConflict(ERROR_CODE.PAYMENT_PROVIDER_MANAGED, messages[command]);
}

/** Pack, ship and deliver need verified paid money and no open risk hold. Call under the order/payment lock. */
export function assertFulfillmentAllowed(order: SalesOrderRecord): void {
  const payment = order.payment;
  if (!payment || !isProviderManaged(order)) return;
  const verified = payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.PARTIALLY_REFUNDED;
  if (!verified) {
    throw paymentConflict(ERROR_CODE.PAYMENT_FULFILLMENT_BLOCKED, `Fulfillment requires a verified Mercado Pago payment (current: ${payment.status}).`);
  }
  if (payment.fulfillmentHoldReasons.length > 0) {
    throw paymentConflict(ERROR_CODE.PAYMENT_FULFILLMENT_BLOCKED, `Fulfillment is on hold: ${payment.fulfillmentHoldReasons.join(", ")}. Review the payment in the Mercado Pago panel.`);
  }
}

/** Cancellation rules for provider-managed orders. Call under the order/payment lock. */
export function assertCancellationAllowed(order: SalesOrderRecord): void {
  const payment = order.payment;
  if (!payment || !isProviderManaged(order)) return;
  if (hasPayableAttempt(payment)) {
    throw paymentConflict(ERROR_CODE.PAYMENT_ATTEMPT_ACTIVE, "A Mercado Pago payment attempt can still succeed; the order cannot be cancelled until it is conclusively closed.");
  }
  if (payment.status === PaymentStatus.PENDING) return;
  if (payment.status !== PaymentStatus.REFUNDED || payment.fulfillmentHoldReasons.includes("unverified_provider_state")) {
    throw paymentConflict(ERROR_CODE.PAYMENT_REFUND_REQUIRED, REFUND_INSTRUCTION);
  }
}
