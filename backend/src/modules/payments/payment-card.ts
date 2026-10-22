import { createHash } from "node:crypto";

/** Card data the browser tokenized with Mercado Pago. It lives in memory for one request and is never persisted or logged. */
export interface PaymentCardInput {
  installments: number;
  payerEmail: string;
  payerIdentification: { number: string; type: string };
  paymentMethodId: string;
  token: string;
}

/** Digest of the card token so idempotency hashes can bind to it without storing the token. */
export function cardTokenDigest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Card brands accepted by the integration, mapped to the provider payment method type. */
const CARD_PAYMENT_METHOD_TYPES: Readonly<Record<string, "credit_card" | "debit_card">> = {
  amex: "credit_card",
  argencard: "credit_card",
  cabal: "credit_card",
  cencosud: "credit_card",
  debcabal: "debit_card",
  debmaster: "debit_card",
  debvisa: "debit_card",
  diners: "credit_card",
  maestro: "debit_card",
  master: "credit_card",
  naranja: "credit_card",
  tarshop: "credit_card",
  visa: "credit_card",
};

/** Returns the provider card type for a supported payment method id; the browser never states the type. */
export function cardPaymentMethodType(paymentMethodId: string): "credit_card" | "debit_card" | undefined {
  return Object.hasOwn(CARD_PAYMENT_METHOD_TYPES, paymentMethodId)
    ? CARD_PAYMENT_METHOD_TYPES[paymentMethodId]
    : undefined;
}

export const SUPPORTED_CARD_PAYMENT_METHOD_IDS = Object.keys(CARD_PAYMENT_METHOD_TYPES);

const CHALLENGE_HOST_SUFFIXES = ["mercadopago.com", "mercadopago.com.ar", "mercadolibre.com", "mercadolibre.com.ar"];

/** Returns the 3DS challenge URL only when it is a plain https URL on a Mercado Pago/Libre domain. */
export function sanitizeChallengeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }

  if (url.protocol !== "https:" || url.username || url.password || url.port) return undefined;
  const host = url.hostname.toLowerCase();
  const allowed = CHALLENGE_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));

  return allowed ? url.toString() : undefined;
}
