import { z } from "zod";

import type { CustomerApiIssue, ParsedCustomerListQuery } from "./types";
import { CUSTOMER_SORT_BY } from "./types";

const identifierSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const emailSchema = z.string().trim().pipe(z.email()).transform((email) => email.toLowerCase());
const addressFields = { city: optionalText(120), country: optionalText(120), floorOrApartment: optionalText(80), neighborhood: optionalText(120), number: optionalText(32), postalCode: optionalText(24), provinceOrState: optionalText(120), street: optionalText(200) } as const;
const addressKeys = Object.keys(addressFields) as Array<keyof typeof addressFields>;
const addressPresenceKeys = addressKeys.filter((key) => key !== "country");
const requiredAddressKeys = ["street", "number", "postalCode", "city", "provinceOrState", "country"] as const;

function requireCompleteAddress(value: Record<string, unknown>, context: z.RefinementCtx): void {
  if (!addressPresenceKeys.some((key) => typeof value[key] === "string" && value[key].trim())) return;
  for (const key of requiredAddressKeys) if (typeof value[key] !== "string" || !value[key].trim()) context.addIssue({ code: "custom", message: `${key} is required when an address is provided.`, path: [key] });
}

const tagsSchema = z.array(z.string().trim().min(1).max(80)).max(50).transform((tags) => [...new Set(tags)]);
const nameSchema = z.string().trim().min(2).max(160).regex(/^[\p{L}\p{M}][\p{L}\p{M}'’ -]*$/u);
const phoneSchema = optionalText(32).refine((value) => value === null || value === undefined || (/^\+?[0-9\s\-()]+$/.test(value) && value.replace(/\D/g, "").length >= 7));
const dniSchema = optionalText(20).refine((value) => value === null || value === undefined || /^\d(?:[\d-]*\d)?$/.test(value));

export const customerIdSchema = identifierSchema;
export const customerListQuerySchema = z.object({ city: z.string().trim().min(1).max(120).optional(), country: z.string().trim().min(1).max(120).optional(), hasOrders: z.boolean().optional(), isAnonymized: z.boolean().optional(), limit: z.number().int().min(1).max(100).default(20), page: z.number().int().min(1).default(1), provinceOrState: z.string().trim().min(1).max(120).optional(), search: z.string().trim().min(1).max(240).optional(), sortBy: z.enum(Object.values(CUSTOMER_SORT_BY) as [string, ...string[]]).default("createdAt"), sortOrder: z.enum(["asc", "desc"] as const).default("desc") }).strict() as unknown as z.ZodType<ParsedCustomerListQuery>;

const profileFields = { ...addressFields, dniOrCuil: dniSchema, email: emailSchema, fullName: nameSchema, notes: optionalText(500), phone: phoneSchema, tags: tagsSchema.default([]) };

export const createCustomerInputSchema = z.object(profileFields).strict().superRefine(requireCompleteAddress);
export const updateCustomerInputSchema = z.object({ ...profileFields, email: emailSchema.optional(), fullName: nameSchema.optional(), tags: tagsSchema.optional() }).strict().superRefine(requireCompleteAddress).refine((value) => Object.values(value).some((entry) => entry !== undefined), { message: "At least one customer field is required." });
export const updateCustomerNotesSchema = z.object({ notes: z.string().trim().max(500) }).strict();
export const customerEmailAvailabilitySchema = z.object({ email: emailSchema, excludeCustomerId: identifierSchema.optional() }).strict();

const dateTimeSchema = z.iso.datetime();
const addressResponseSchema = z.object({ city: z.string(), country: z.string(), floorOrApartment: z.string().optional(), neighborhood: z.string().optional(), number: z.string(), postalCode: z.string(), provinceOrState: z.string(), street: z.string() }).strict();
const lastOrderSchema = z.object({ date: dateTimeSchema, id: identifierSchema, number: identifierSchema, total: z.number().finite().nonnegative() }).strict();
const summarySchema = z.object({ lastOrder: lastOrderSchema.optional(), ordersCount: z.number().int().nonnegative(), totalSpent: z.number().finite().nonnegative() }).strict();
export const customerResponseSchema = z.object({ address: addressResponseSchema.optional(), createdAt: dateTimeSchema, dniOrCuil: z.string().optional(), email: z.union([z.email(), z.literal("")]), firstInteractionDate: dateTimeSchema, fullName: z.string().min(1), id: identifierSchema, isAnonymized: z.boolean(), notes: z.string().optional(), phone: z.string().optional(), summary: summarySchema.optional(), tags: z.array(z.string()), updatedAt: dateTimeSchema }).strict();

export const customerDetailResponseSchema = customerResponseSchema.extend({ summary: summarySchema });
export const customerListResponseSchema = z.object({ items: z.array(customerResponseSchema), limit: z.number().int().positive(), page: z.number().int().positive(), total: z.number().int().nonnegative(), totalPages: z.number().int().nonnegative() }).strict();
export const customerEmailAvailabilityResponseSchema = z.object({ available: z.boolean() }).strict();

export function normalizeCustomerInput<T extends Record<string, unknown>>(input: T): T {
  if (addressPresenceKeys.some((key) => typeof input[key] === "string" && input[key].trim())) return input;
  const withoutDefaultCountry = { ...input } as T & { country?: unknown };
  delete withoutDefaultCountry.country;
  return withoutDefaultCountry as T;
}

export type CustomerResponseContract = z.output<typeof customerResponseSchema>;
export type CustomerDetailResponseContract = z.output<typeof customerDetailResponseSchema>;
export type CustomerListResponseContract = z.output<typeof customerListResponseSchema>;

export function toValidationIssues(error: z.ZodError): CustomerApiIssue[] { return error.issues.map((issue) => ({ code: issue.code, field: issue.path.map(String).join(".") || "request", message: issue.message })); }
