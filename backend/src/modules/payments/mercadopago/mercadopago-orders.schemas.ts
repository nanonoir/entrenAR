import { z } from "zod";

import type { MercadoPagoOrder } from "./mercadopago-orders.port";

/** Normalizes provider amounts (string or number) to a decimal string with exactly two places. */
const amountSchema = z.union([z.string(), z.number()]).transform((value, context) => {
  const text = typeof value === "number" ? String(value) : value.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  const fraction = match?.[2]?.replace(/0+$/, "") ?? "";

  if (!match || fraction.length > 2) {
    context.addIssue({ code: "custom", message: "Amount must be a non-negative decimal with at most two places." });
    return z.NEVER;
  }

  return `${match[1]}.${fraction.padEnd(2, "0")}`;
});

const optionalString = z.string().optional();

const paymentMethodSchema = z.object({
  id: optionalString,
  installments: z.coerce.number().int().optional(),
  transaction_security: z.object({ url: optionalString }).optional(),
  type: optionalString,
});

const transactionSchema = z.object({
  amount: amountSchema,
  id: z.string().min(1),
  paid_amount: amountSchema.optional(),
  payment_method: paymentMethodSchema.optional(),
  reference_id: z.union([z.string(), z.number()]).transform(String).optional(),
  refunded_amount: amountSchema.optional(),
  status: z.string().min(1),
  status_detail: z.string().default(""),
});

const refundSchema = z.object({
  amount: amountSchema,
  id: optionalString,
  status: optionalString,
});

const chargebackSchema = z.object({
  case_id: z.union([z.string(), z.number()]).transform(String).optional(),
  id: z.string().min(1),
  status: z.string().default(""),
  transaction_id: optionalString,
});

/** Statuses are deliberately free-form strings so future provider values still parse and normalize safely. */
export const mercadoPagoOrderResponseSchema = z.object({
  created_date: optionalString,
  currency: optionalString,
  external_reference: z.string().min(1),
  id: z.string().min(1),
  integration_data: z.object({ application_id: z.union([z.string(), z.number()]).transform(String).optional() }).optional(),
  last_updated_date: optionalString,
  status: z.string().min(1),
  status_detail: z.string().default(""),
  total_amount: amountSchema,
  total_paid_amount: amountSchema.optional(),
  transactions: z.object({
    chargebacks: z.array(chargebackSchema).default([]),
    payments: z.array(transactionSchema).default([]),
    refunds: z.array(refundSchema).default([]),
  }).default({ chargebacks: [], payments: [], refunds: [] }),
  user_id: z.union([z.string(), z.number()]).transform(String).optional(),
});

/** Search responses are `{ data: [orders], paging }`; an empty `data` is valid. */
export const mercadoPagoSearchResponseSchema = z
  .object({ data: z.array(z.unknown()), paging: z.unknown().optional() })
  .transform((value) => value.data);

export const mercadoPagoErrorResponseSchema = z.object({
  code: optionalString,
  data: z.unknown().optional(),
  error: optionalString,
  errors: z.array(z.object({ code: optionalString, details: z.array(z.unknown()).optional() })).optional(),
});

const COMPLETED_REFUND_STATUS = "processed";

export function toMercadoPagoOrder(input: unknown): MercadoPagoOrder {
  const raw = mercadoPagoOrderResponseSchema.parse(input);
  const completedRefunds = raw.transactions.refunds.filter((refund) => refund.status === COMPLETED_REFUND_STATUS);
  const refundedCents = completedRefunds.length > 0
    ? completedRefunds.reduce((sum, refund) => sum + toCents(refund.amount), 0)
    : raw.transactions.payments.reduce((sum, payment) => sum + toCents(payment.refunded_amount ?? "0.00"), 0);

  return {
    applicationId: raw.integration_data?.application_id,
    chargebacks: raw.transactions.chargebacks.map((chargeback) => ({
      caseId: chargeback.case_id,
      id: chargeback.id,
      status: chargeback.status,
      transactionId: chargeback.transaction_id,
    })),
    createdAt: raw.created_date,
    currency: raw.currency,
    externalReference: raw.external_reference,
    id: raw.id,
    lastUpdatedAt: raw.last_updated_date,
    refundedAmount: fromCents(refundedCents),
    status: raw.status,
    statusDetail: raw.status_detail,
    totalAmount: raw.total_amount,
    totalPaidAmount: raw.total_paid_amount,
    transactions: raw.transactions.payments.map((payment) => ({
      amount: payment.amount,
      id: payment.id,
      paidAmount: payment.paid_amount,
      paymentMethod: payment.payment_method
        ? { id: payment.payment_method.id, installments: payment.payment_method.installments, type: payment.payment_method.type }
        : undefined,
      referenceId: payment.reference_id,
      refundedAmount: payment.refunded_amount,
      status: payment.status,
      statusDetail: payment.status_detail,
      transactionSecurityUrl: payment.payment_method?.transaction_security?.url,
    })),
    userId: raw.user_id,
  };
}

export function toCents(amount: string): number {
  const [whole = "0", fraction = "00"] = amount.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));
}

export function fromCents(cents: number): string {
  const whole = Math.floor(cents / 100);
  return `${whole}.${String(cents % 100).padStart(2, "0")}`;
}
