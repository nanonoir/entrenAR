import { z } from "zod";

import { CheckoutApiError } from "@/lib/api/checkout/client";
import { sanitizeChallengeUrl } from "@/lib/api/payments/challenge-url";
import {
  activePaymentResponseSchema,
  paymentViewSchema,
  type PaymentViewDto,
} from "@/lib/api/payments/payments.schemas";

export interface PaymentView extends Omit<PaymentViewDto, "challenge"> {
  /** Present only when the backend URL also passes the local https allowlist. */
  challenge: (Omit<NonNullable<PaymentViewDto["challenge"]>, "url"> & { url: string }) | null;
}

export function mapPaymentView(response: unknown): PaymentView {
  return toPaymentView(parse(response, paymentViewSchema));
}

export function mapActivePaymentResponse(response: unknown): PaymentView | null {
  const parsed = parse(response, activePaymentResponseSchema);
  return parsed.active ? toPaymentView(parsed.active) : null;
}

function toPaymentView(dto: PaymentViewDto): PaymentView {
  const url = dto.challenge ? sanitizeChallengeUrl(dto.challenge.url) : null;

  return {
    ...dto,
    challenge: dto.challenge && url ? { ...dto.challenge, url } : null,
  };
}

function parse<T>(value: unknown, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;

  throw new CheckoutApiError({
    code: "CHECKOUT_API_INVALID_RESPONSE",
    issues: parsed.error.issues.map((issue) => ({
      code: "INVALID_RESPONSE",
      field: issue.path.length > 0 ? issue.path.map(String).join(".") : "response",
      message: "The payments API returned an invalid response field.",
    })),
    message: "The payments API returned an invalid response.",
    status: 502,
  });
}
