import { z } from "zod";

export const PAYMENT_IDENTIFICATION_TYPES = ["DNI", "CUIT", "CUIL", "LE", "LC"] as const;
const PAYMENT_MAX_INSTALLMENTS = 24;

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

const sessionTokenSchema = z.string().trim().min(16).max(512).regex(/^[A-Za-z0-9._~:-]+$/);

/** The only card fields that leave the browser: a one-shot Brick token plus validated payer data. */
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
  paymentMethodId: z.string({ error: "Card payment method must be a string." }).trim().regex(/^[a-z0-9_]{2,40}$/),
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
  sessionToken: sessionTokenSchema.optional(),
}).strict();

const amountSchema = z.number().finite().nonnegative();

export const paymentViewSchema = z.object({
  acceptedPending: z.boolean(),
  amount: amountSchema,
  attempt: z.object({
    id: z.string().min(1),
    number: z.number().int().nonnegative(),
    status: z.string().min(1).max(64),
  }).strict().nullable(),
  cartFinalized: z.boolean(),
  challenge: z.object({
    createdAt: z.iso.datetime(),
    expectedExpiresAt: z.iso.datetime(),
    pollAfterSeconds: z.number().finite().positive(),
    url: z.string().min(1).max(4096),
  }).strict().nullable(),
  currency: z.literal("ARS"),
  nextPollSeconds: z.number().finite().positive().nullable(),
  ok: z.literal(true),
  orderId: z.string().min(1).max(128),
  orderNumber: z.string().min(1).max(128),
  orderStatus: z.string().min(1).max(64),
  paymentStatus: z.string().min(1).max(64),
  reasonCode: z.string().max(64).nullable(),
  reconciling: z.boolean(),
  refundedAmount: amountSchema,
  retry: z.object({
    eligible: z.boolean(),
    until: z.iso.datetime().nullable(),
  }).strict(),
  status: z.string().min(1).max(64),
  version: z.number().int().nonnegative(),
}).strict();

export const activePaymentResponseSchema = z.object({
  active: paymentViewSchema.nullable(),
  ok: z.literal(true),
}).strict();

export type PaymentCardPayload = z.output<typeof paymentCardSchema>;
export type PaymentRetryPayload = z.output<typeof paymentRetryRequestSchema>;
export type PaymentViewDto = z.output<typeof paymentViewSchema>;
