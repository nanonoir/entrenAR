import { z } from "zod";

import { CHECKOUT_MAX_QUANTITY, CHECKOUT_PAYMENT_METHOD_IDS } from "../checkout.constants";

export const identifierSchema = z.string({ error: "Identifier must be a string." })
  .trim()
  .min(1, { error: "Identifier is required." })
  .max(128, { error: "Identifier is too long." });

export const requiredText = (field: string, max: number) => z.string({ error: `${field} must be a string.` })
  .trim()
  .min(1, { error: `${field} is required.` })
  .max(max, { error: `${field} is too long.` });

export const nameSchema = (field: string) => requiredText(field, 160)
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u, { error: `${field} contains invalid characters.` });

export const phoneSchema = requiredText("Phone", 32).regex(/^[+]?\d[\d ()-]*$/, {
  error: "Phone contains invalid characters.",
});

export const postalCodeSchema = requiredText("Postal code", 24).regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/, {
  error: "Postal code contains invalid characters.",
});

export const quantitySchema = z.number({ error: "Quantity must be a number." })
  .int({ error: "Quantity must be an integer." })
  .positive({ error: "Quantity must be greater than zero." })
  .max(CHECKOUT_MAX_QUANTITY, { error: "Quantity is too large." });

export const moneySchema = z.number({ error: "Amount must be a number." })
  .finite({ error: "Amount must be finite." })
  .nonnegative({ error: "Amount must be zero or greater." })
  .multipleOf(0.01, { error: "Amount can have at most two decimal places." });

export const opaqueTokenSchema = z.string({ error: "Token must be a string." })
  .trim()
  .min(16, { error: "Token is too short." })
  .max(512, { error: "Token is too long." })
  .regex(/^[A-Za-z0-9._~:-]+$/, { error: "Token contains invalid characters." });

export const couponCodeSchema = requiredText("Coupon code", 80)
  .transform((value) => value.toLocaleUpperCase())
  .refine((value) => /^[A-Z0-9-]+$/.test(value), {
    error: "Coupon code may contain only letters, numbers, and hyphens.",
  });

export const paymentMethodIdSchema = z.enum(CHECKOUT_PAYMENT_METHOD_IDS);

export const checkoutAddressSchema = z.object({
  city: requiredText("City", 120),
  label: requiredText("Address label", 60).optional(),
  number: requiredText("Street number", 32).optional(),
  phone: phoneSchema.optional(),
  postalCode: postalCodeSchema,
  province: requiredText("Province", 120),
  recipient: nameSchema("Recipient").optional(),
  street: requiredText("Street", 200),
}).strict();

export const checkoutCustomerSchema = z.object({
  dni: z.string({ error: "DNI must be a string." })
    .trim()
    .regex(/^\d{6,11}$/, { error: "DNI must contain between 6 and 11 digits." })
    .optional(),
  email: z.email({ error: "Email must be valid." }).transform((email) => email.toLocaleLowerCase()),
  firstName: nameSchema("First name"),
  lastName: nameSchema("Last name"),
  phone: phoneSchema.optional(),
}).strict();

export type CheckoutAddressInput = z.output<typeof checkoutAddressSchema>;
export type CheckoutCustomerInput = z.output<typeof checkoutCustomerSchema>;
