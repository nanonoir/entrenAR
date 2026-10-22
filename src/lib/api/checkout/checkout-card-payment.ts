import { toCheckoutCardPaymentPayload } from "@/lib/api/checkout/checkout-api.payloads";
import type {
  CheckoutCustomerInput,
  CheckoutQuoteInput,
} from "@/lib/api/checkout/checkout.repository";
import { FetchCheckoutApiClient, type CheckoutApiClient } from "@/lib/api/checkout/client";
import { mapActivePaymentResponse, mapPaymentView, type PaymentView } from "@/lib/api/payments/payments.mappers";
import type { PaymentCardPayload } from "@/lib/api/payments/payments.schemas";

export const CHECKOUT_SESSION_HEADER = "x-checkout-session";

export interface CheckoutCardPaymentInput extends CheckoutQuoteInput {
  card: PaymentCardPayload;
  customer: CheckoutCustomerInput;
  idempotencyKey: string;
  quoteId: string;
  deviceId?: string;
  paymentOptionId?: string;
}

let sharedClient: CheckoutApiClient | null = null;

/** One client for every payment call so concurrent token refreshes coalesce. */
export function getPaymentsApiClient(): CheckoutApiClient {
  sharedClient ??= new FetchCheckoutApiClient();
  return sharedClient;
}

export function sessionHeaders(sessionToken?: string | null): HeadersInit | undefined {
  const token = sessionToken?.trim();
  return token ? { [CHECKOUT_SESSION_HEADER]: token } : undefined;
}

/** Places the order and charges the tokenized card. The backend computes every amount from the quote. */
export async function payCheckoutWithCard(
  input: CheckoutCardPaymentInput,
  client: CheckoutApiClient = getPaymentsApiClient(),
  signal?: AbortSignal,
): Promise<PaymentView> {
  const response = await client.post<unknown>("/checkout/payments/mercadopago", toCheckoutCardPaymentPayload(input), { signal });
  return mapPaymentView(response);
}

/** Recovers the order bound to the caller after a lost response or reload; `null` when there is none. */
export async function fetchActivePayment(
  options: { sessionToken?: string | null; signal?: AbortSignal } = {},
  client: CheckoutApiClient = getPaymentsApiClient(),
): Promise<PaymentView | null> {
  const headers = sessionHeaders(options.sessionToken);
  const response = await client.get<unknown>("/checkout/payments/active", {
    ...(headers ? { headers } : {}),
    signal: options.signal,
  });
  return mapActivePaymentResponse(response);
}
