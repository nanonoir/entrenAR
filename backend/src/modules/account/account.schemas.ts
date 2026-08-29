import { z } from "zod";

export const ACCOUNT_MAX_ADDRESSES = 6;

const nameSchema = z.string({ error: "Name must be a string." })
  .trim()
  .min(1, { error: "Name is required." })
  .max(120, { error: "Name is too long." })
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u, { error: "Name contains invalid characters." });

const textSchema = (max: number) => z.string({ error: "Value must be a string." })
  .trim()
  .min(1, { error: "Value is required." })
  .max(max, { error: "Value is too long." });

const phoneSchema = z.string({ error: "Phone must be a string." })
  .trim()
  .min(7, { error: "Phone must contain at least 7 characters." })
  .max(24, { error: "Phone is too long." })
  .regex(/^\+?[0-9\s\-()]+$/, { error: "Phone contains invalid characters." });

const publicDniSchema = z.string({ error: "DNI must be a string." })
  .trim()
  .regex(/^\d{6,9}$/, { error: "DNI must contain between 6 and 9 digits." });

const birthDateSchema = z.iso.date({ error: "Birth date must be a valid ISO date." });

export const emailSchema = z.email({ error: "Email must be valid." }).transform((email) => email.toLowerCase());

export const accountProfileSchema = z.object({
  birthDate: birthDateSchema,
  dni: publicDniSchema,
  email: emailSchema,
  firstName: nameSchema,
  gender: textSchema(40),
  lastName: nameSchema,
  phone: phoneSchema,
}).strict();

export const accountProfileUpdateSchema = accountProfileSchema.omit({ email: true }).strict();
export const profileSchema = accountProfileSchema;
export const updateProfileSchema = accountProfileUpdateSchema;

const addressFields = {
  city: textSchema(120),
  label: textSchema(60),
  phone: phoneSchema,
  postalCode: z.string({ error: "Postal code must be a string." })
    .trim()
    .min(1, { error: "Postal code is required." })
    .max(20, { error: "Postal code is too long." })
    .regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/, { error: "Postal code contains invalid characters." }),
  province: textSchema(120),
  recipient: textSchema(120),
  street: textSchema(200),
} as const;

export const accountAddressInputSchema = z.object(addressFields).strict();
export const accountAddressSchema = accountAddressInputSchema.extend({
  id: z.string({ error: "Address ID must be a string." }).trim().min(1, { error: "Address ID is required." }).max(128, { error: "Address ID is too long." }),
}).strict();

export const addressSchema = accountAddressSchema;
export const addressIdSchema = z.string({ error: "Address ID must be a string." }).trim().min(1, { error: "Address ID is required." }).max(128, { error: "Address ID is too long." });
export const createAddressSchema = accountAddressInputSchema;
export const updateAddressSchema = accountAddressInputSchema;

export const accountOrderListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
}).strict();

export const orderListQuerySchema = accountOrderListQuerySchema;

export type AccountAddressInput = z.infer<typeof accountAddressInputSchema>;
export type AccountAddress = z.infer<typeof accountAddressSchema>;
export type AccountOrderListQuery = z.infer<typeof accountOrderListQuerySchema>;
export type AccountProfile = z.infer<typeof accountProfileSchema>;
export type AccountProfileUpdateInput = z.infer<typeof accountProfileUpdateSchema>;
export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
