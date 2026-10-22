/** Sanitized fixtures modeled on the official Mercado Pago Orders API reference. No real identifiers or tokens. */

const base = {
  country_code: "ARG",
  created_date: "2026-10-21T15:00:00.000Z",
  currency: "ARS",
  external_reference: "order_internal_1",
  id: "ORD01TESTORDER000000000000001",
  integration_data: { application_id: "1234567890" },
  last_updated_date: "2026-10-21T15:00:05.000Z",
  processing_mode: "automatic",
  total_amount: "12345.67",
  type: "online",
  user_id: "1000001",
};

const payment = {
  amount: "12345.67",
  id: "PAY01TESTPAYMENT00000000001",
  payment_method: { id: "master", installments: 1, statement_descriptor: "ENTRENAR", type: "credit_card" },
  reference_id: "1234567890",
};

export const processedAccreditedOrder = {
  ...base,
  status: "processed",
  status_detail: "accredited",
  total_paid_amount: "12345.67",
  transactions: { payments: [{ ...payment, paid_amount: "12345.67", status: "processed", status_detail: "accredited" }] },
};

export const failedOrder = {
  ...base,
  status: "failed",
  status_detail: "failed",
  transactions: { payments: [{ ...payment, status: "failed", status_detail: "rejected_by_issuer" }] },
};

/** HTTP 402 body observed in the sandbox for a rejected card: the failed order travels in `data`. */
export const cardRejected402Body = {
  data: {
    ...base,
    status: "failed",
    status_detail: "failed",
    transactions: { payments: [{ ...payment, status: "failed", status_detail: "invalid_card_token" }] },
  },
  errors: [{ code: "failed", details: ["PAY01TESTPAYMENT00000000001: invalid_card_token"], message: "The following transactions failed" }],
};

export const pendingChallengeOrder = {
  ...base,
  status: "action_required",
  status_detail: "pending_challenge",
  transactions: { payments: [{ ...payment, status: "action_required", status_detail: "pending_challenge" }] },
};

export const processingOrder = {
  ...base,
  status: "processing",
  status_detail: "in_process",
  transactions: { payments: [{ ...payment, status: "processing", status_detail: "in_process" }] },
};

export const partiallyRefundedOrder = {
  ...base,
  status: "processed",
  status_detail: "partially_refunded",
  total_paid_amount: "12345.67",
  transactions: {
    payments: [{ ...payment, paid_amount: "12345.67", refunded_amount: "345.67", status: "processed", status_detail: "partially_refunded" }],
    refunds: [{ amount: "345.67", id: "REF01TESTREFUND0000000001", status: "processed", transaction_id: payment.id }],
  },
};

export const refundedOrder = {
  ...base,
  status: "refunded",
  status_detail: "refunded",
  transactions: {
    payments: [{ ...payment, paid_amount: "12345.67", refunded_amount: "12345.67", status: "refunded", status_detail: "refunded" }],
    refunds: [{ amount: "12345.67", id: "REF01TESTREFUND0000000002", status: "processed", transaction_id: payment.id }],
  },
};

export const chargedBackOrder = {
  ...base,
  status: "charged_back",
  status_detail: "in_process",
  transactions: {
    chargebacks: [{ case_id: "1234567890", id: "CBK01TESTCHARGEBACK00000001", status: "in_process", transaction_id: payment.id }],
    payments: [{ ...payment, paid_amount: "12345.67", status: "charged_back", status_detail: "in_process" }],
  },
};

export const canceledOrder = {
  ...base,
  status: "canceled",
  status_detail: "canceled",
  transactions: { payments: [{ ...payment, status: "canceled", status_detail: "canceled" }] },
};

export const expiredOrder = {
  ...base,
  status: "expired",
  status_detail: "expired",
  transactions: { payments: [{ ...payment, status: "expired", status_detail: "expired" }] },
};
