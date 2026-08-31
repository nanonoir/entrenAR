import { z } from "zod";

import {
  PAYMENT_PROVIDER_DEFINITIONS,
  PAYMENT_PROVIDER_IDS,
  PAYMENT_PROVIDER,
  PAYMENT_STATUS,
} from "../commerce.constants";

const paymentStatusValues = [PAYMENT_STATUS.ACTIVE, PAYMENT_STATUS.INACTIVE] as [
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS],
  ...(typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS][],
];

const requiredText = (field: string, max = 200) => z.string({ error: `${field} must be a string.` })
  .trim()
  .min(1, { error: `${field} is required.` })
  .max(max, { error: `${field} is too long.` });

const nameLikeSchema = (field: string) => requiredText(field, 160)
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u, { error: `${field} contains invalid characters.` });

export function normalizeCbuCvu(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeCuitCuil(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.length !== 11) {
    return digits;
  }

  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

export function normalizeNameLike(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export const bankTransferSchema = z.object({
  alias: requiredText("Alias", 160),
  bankName: nameLikeSchema("Bank name"),
  cbuCvu: z.string({ error: "CBU/CVU must be a string." })
    .trim()
    .transform(normalizeCbuCvu)
    .refine((value) => /^\d{22}$/.test(value), { error: "CBU/CVU must contain exactly 22 digits." }),
  cuitCuil: z.string({ error: "CUIT/CUIL must be a string." })
    .trim()
    .transform(normalizeCuitCuil)
    .refine((value) => /^\d{2}-\d{8}-\d$/.test(value), { error: "CUIT/CUIL must contain exactly 11 digits." }),
  holderName: nameLikeSchema("Holder name"),
}).strict().transform((config) => ({
  alias: config.alias,
  bankName: normalizeNameLike(config.bankName),
  cbuCvu: config.cbuCvu,
  cuitCuil: config.cuitCuil,
  holderName: normalizeNameLike(config.holderName),
}));

export const paymentMethodUpdateSchema = z.object({
  bankConfig: bankTransferSchema.nullable().optional(),
  selectedOptionId: z.string({ error: "Selected option ID must be a string." })
    .trim()
    .min(1, { error: "Selected option ID is required when provided." })
    .max(128, { error: "Selected option ID is too long." })
    .nullable()
    .optional(),
  status: z.enum(paymentStatusValues),
}).strict();

export const paymentMethodConfigUpdateSchema = paymentMethodUpdateSchema;
export const paymentMethodRequestSchema = paymentMethodUpdateSchema;

export function paymentMethodUpdateSchemaFor(providerId: string): z.ZodType<PaymentMethodUpdateInput> {
  return paymentMethodUpdateSchema.superRefine((input, context) => {
    const provider = PAYMENT_PROVIDER_DEFINITIONS.find((candidate) => candidate.id === providerId);
    if (!provider) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Payment provider is not supported.", path: [] });
      return;
    }

    if (input.selectedOptionId && !provider.options.some((option) => option.id === input.selectedOptionId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Selected payment provider option is not supported.", path: ["selectedOptionId"] });
    }

    if (providerId !== PAYMENT_PROVIDER.BANK_TRANSFER && input.bankConfig !== undefined && input.bankConfig !== null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Bank instructions are only valid for bank transfer.", path: ["bankConfig"] });
    }

    if (providerId !== PAYMENT_PROVIDER.BANK_TRANSFER && input.status === PAYMENT_STATUS.ACTIVE && !input.selectedOptionId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "An active payment provider requires a selected option.", path: ["selectedOptionId"] });
    }
  });
}

export const paymentMethodConfigSchema = z.object({
  id: z.enum(PAYMENT_PROVIDER_IDS),
  ...paymentMethodUpdateSchema.shape,
}).strict();

export type BankTransferConfigInput = z.output<typeof bankTransferSchema>;
export type PaymentMethodConfigInput = z.output<typeof paymentMethodConfigSchema>;
export type PaymentMethodUpdateInput = z.output<typeof paymentMethodUpdateSchema>;
