import { CheckoutApiError } from "@/lib/api/checkout/client";
import { paymentCardSchema, type PaymentCardPayload } from "@/lib/api/payments/payments.schemas";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

/**
 * Builds the allowlisted card payload from Brick form data. Only the token, method, installments and payer
 * identity are read; `transaction_amount`, issuer and every other Brick field are discarded because the
 * backend derives the amount from its own quote.
 */
export function toPaymentCardPayload(formData: unknown, fallbackEmail?: string): PaymentCardPayload {
  const data = asRecord(formData);
  const payer = asRecord(data.payer);
  const identification = asRecord(payer.identification);
  const email = typeof payer.email === "string" && payer.email.trim() ? payer.email : fallbackEmail;

  const parsed = paymentCardSchema.safeParse({
    installments: typeof data.installments === "string" ? Number(data.installments) : data.installments,
    payerEmail: email,
    payerIdentification: { number: identification.number, type: identification.type },
    paymentMethodId: data.payment_method_id,
    token: data.token,
  });

  if (!parsed.success) {
    throw new CheckoutApiError({
      code: "VALIDATION_ERROR",
      issues: parsed.error.issues.map((issue) => ({
        code: issue.code,
        field: issue.path.map(String).join(".") || "card",
        message: issue.message,
      })),
      message: "The card data is invalid.",
      status: 400,
    });
  }

  return parsed.data;
}

/** The Mercado Pago security script publishes the device session id on `window` once the SDK is loaded. */
export function readDeviceId(source: unknown = typeof window === "undefined" ? undefined : window): string | undefined {
  const value = asRecord(source).MP_DEVICE_SESSION_ID;
  return typeof value === "string" && /^[A-Za-z0-9._:-]{1,256}$/.test(value) ? value : undefined;
}
