import { CheckoutApiError, type CheckoutApiClient } from "@/lib/api/checkout/client";
import { getPaymentsApiClient, sessionHeaders } from "@/lib/api/checkout/checkout-card-payment";
import { mapPaymentView, type PaymentView } from "@/lib/api/payments/payments.mappers";
import {
  paymentRetryRequestSchema,
  type PaymentCardPayload,
} from "@/lib/api/payments/payments.schemas";

export interface PaymentRetryInput {
  card: PaymentCardPayload;
  idempotencyKey: string;
  deviceId?: string;
  sessionToken?: string | null;
}

/** Owner-scoped status of a card order. Guests identify themselves with the checkout session header. */
export async function fetchPaymentStatus(
  orderId: string,
  options: { sessionToken?: string | null; signal?: AbortSignal } = {},
  client: CheckoutApiClient = getPaymentsApiClient(),
): Promise<PaymentView> {
  const headers = sessionHeaders(options.sessionToken);
  const response = await client.get<unknown>(`/payments/orders/${encodeURIComponent(orderId)}`, {
    ...(headers ? { headers } : {}),
    signal: options.signal,
  });
  return mapPaymentView(response);
}

/** A new attempt on the same frozen order, allowed only inside the server's retry window. */
export async function retryPayment(
  orderId: string,
  input: PaymentRetryInput,
  client: CheckoutApiClient = getPaymentsApiClient(),
  signal?: AbortSignal,
): Promise<PaymentView> {
  const parsed = paymentRetryRequestSchema.safeParse({
    card: input.card,
    idempotencyKey: input.idempotencyKey.trim(),
    ...(input.deviceId ? { deviceId: input.deviceId.trim() } : {}),
    ...(input.sessionToken?.trim() ? { sessionToken: input.sessionToken.trim() } : {}),
  });
  if (!parsed.success) {
    throw new CheckoutApiError({
      code: "VALIDATION_ERROR",
      issues: parsed.error.issues.map((issue) => ({
        code: issue.code,
        field: issue.path.map(String).join(".") || "request",
        message: issue.message,
      })),
      message: "The payment request is invalid.",
      status: 400,
    });
  }

  const response = await client.post<unknown>(`/payments/orders/${encodeURIComponent(orderId)}/attempts`, parsed.data, { signal });
  return mapPaymentView(response);
}
