import { z } from "zod";

import { SUPPORTED_CARD_PAYMENT_METHOD_IDS } from "./payment-card";

export const PAYMENT_IDENTIFICATION_TYPES = ["DNI", "CUIT", "CUIL", "LE", "LC"] as const;
export const PAYMENT_MAX_INSTALLMENTS = 24;

const supportedCardIds = SUPPORTED_CARD_PAYMENT_METHOD_IDS as [string, ...string[]];

export const paymentIdempotencyKeySchema = z.string({ error: "Idempotency key must be a string." })
  .trim()
  .min(8, { error: "Idempotency key is too short." })
  .max(128, { error: "Idempotency key is too long." })
  .regex(/^[A-Za-z0-9._:-]+$/, { error: "Idempotency key contains invalid characters." });

export const paymentDeviceIdSchema = z.string({ error: "Device id must be a string." })
  .trim()
  .min(1, { error: "Device id is required." })
  .max(256, { error: "Device id is too long." })
  .regex(/^[A-Za-z0-9._:-]+$/, { error: "Device id contains invalid characters." });

export const paymentCardSchema = z.object({
  installments: z.number({ error: "Installments must be a number." })
    .int({ error: "Installments must be an integer." })
    .min(1, { error: "Installments must be at least 1." })
    .max(PAYMENT_MAX_INSTALLMENTS, { error: "Installments is too large." }),
  payerEmail: z.email({ error: "Payer email must be valid." }).max(254).transform((email) => email.toLocaleLowerCase()),
  payerIdentification: z.object({
    number: z.string({ error: "Identification number must be a string." })
      .trim()
      .regex(/^\d{6,11}$/, { error: "Identification number must contain between 6 and 11 digits." }),
    type: z.enum(PAYMENT_IDENTIFICATION_TYPES),
  }).strict(),
  paymentMethodId: z.enum(supportedCardIds, { error: "Card payment method is not supported." }),
  token: z.string({ error: "Card token must be a string." })
    .trim()
    .min(8, { error: "Card token is too short." })
    .max(256, { error: "Card token is too long." })
    .regex(/^[A-Za-z0-9_-]+$/, { error: "Card token contains invalid characters." }),
}).strict();

export const paymentRetryRequestSchema = z.object({
  card: paymentCardSchema,
  deviceId: paymentDeviceIdSchema.optional(),
  idempotencyKey: paymentIdempotencyKeySchema,
  sessionToken: z.string().trim().min(16).max(512).regex(/^[A-Za-z0-9._~:-]+$/).optional(),
}).strict();

export const paymentOrderIdSchema = z.string().trim().min(1).max(128);
export const paymentSessionHeaderSchema = z.string().trim().min(16).max(512).regex(/^[A-Za-z0-9._~:-]+$/).optional();

export type PaymentCardRequest = z.output<typeof paymentCardSchema>;
export type PaymentRetryRequest = z.output<typeof paymentRetryRequestSchema>;
