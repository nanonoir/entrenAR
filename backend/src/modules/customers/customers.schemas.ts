import { z } from "zod";

export const CUSTOMER_SORT_BY = {
  CREATED_AT: "createdAt",
  EMAIL: "email",
  FIRST_INTERACTION_DATE: "firstInteractionDate",
  FULL_NAME: "fullName",
  ORDERS_COUNT: "ordersCount",
  TOTAL_SPENT: "totalSpent",
  UPDATED_AT: "updatedAt",
} as const;

export type CustomerSortBy = (typeof CUSTOMER_SORT_BY)[keyof typeof CUSTOMER_SORT_BY];

export const customerIdentifierSchema = z.string({ error: "Customer ID must be a string." })
  .trim()
  .min(1, { error: "Customer ID is required." })
  .max(128, { error: "Customer ID is too long." })
  .regex(/^[A-Za-z0-9_-]+$/, { error: "Customer ID contains invalid characters." });

export const customerIdParamSchema = z.object({ id: customerIdentifierSchema }).strict();
export const customerIdSchema = customerIdentifierSchema;

const nameSchema = z.string({ error: "Full name must be a string." })
  .trim()
  .min(2, { error: "Full name is required." })
  .max(160, { error: "Full name is too long." })
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}'’ -]*$/u, { error: "Full name contains invalid characters." });

const optionalText = (field: string, max: number) => z.preprocess(
  (value) => {
    if (value === null) return null;
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed || undefined;
  },
  z.string({ error: `${field} must be a string.` }).max(max, { error: `${field} is too long.` }).nullable().optional(),
);

const emailSchema = z.string({ error: "Email must be a string." })
  .trim()
  .pipe(z.email({ error: "Email must be valid." }))
  .transform((email) => email.toLowerCase());

const phoneSchema = optionalText("Phone", 32).refine(
  (phone) => phone === null || phone === undefined || (/^\+?[0-9\s\-()]+$/.test(phone) && phone.replace(/\D/g, "").length >= 7),
  { error: "Phone contains invalid characters or is too short." },
);

const dniSchema = optionalText("DNI/CUIL", 20).refine(
  (dni) => dni === null || dni === undefined || /^\d(?:[\d-]*\d)?$/.test(dni),
  { error: "DNI/CUIL contains invalid characters." },
);

const tagsSchema = z.array(
  z.string({ error: "Tag must be a string." }).trim().min(1, { error: "Tag cannot be empty." }).max(80, { error: "Tag is too long." }),
).max(50, { error: "Too many customer tags." }).transform((tags) => [...new Set(tags)]);

const addressFields = {
  city: optionalText("City", 120),
  country: optionalText("Country", 120),
  floorOrApartment: optionalText("Floor or apartment", 80),
  neighborhood: optionalText("Neighborhood", 120),
  number: optionalText("Street number", 32),
  postalCode: optionalText("Postal code", 24),
  provinceOrState: optionalText("Province or state", 120),
  street: optionalText("Street", 200),
} as const;

const ADDRESS_FIELDS = [
  "street",
  "number",
  "floorOrApartment",
  "postalCode",
  "neighborhood",
  "city",
  "provinceOrState",
  "country",
] as const;

const REQUIRED_ADDRESS_FIELDS = ["street", "number", "postalCode", "city", "provinceOrState", "country"] as const;

function validateConditionalAddress(
  value: Partial<Record<(typeof ADDRESS_FIELDS)[number], string | null | undefined>>,
  context: z.RefinementCtx,
) {
  const hasAddress = ADDRESS_FIELDS.some((field) => Boolean(value[field]?.trim()));
  if (!hasAddress) return;

  for (const field of REQUIRED_ADDRESS_FIELDS) {
    if (!value[field]?.trim()) {
      context.addIssue({ code: "custom", message: `${field} is required when an address is provided.`, path: [field] });
    }
  }
}

export const customerAddressSchema = z.object(addressFields).strict().superRefine(validateConditionalAddress);

export const customerListQuerySchema = z.object({
  city: z.string().trim().min(1).max(120).optional(),
  country: z.string().trim().min(1).max(120).optional(),
  hasOrders: z.preprocess(queryBoolean, z.boolean()).optional(),
  isAnonymized: z.preprocess(queryBoolean, z.boolean()).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
  provinceOrState: z.string().trim().min(1).max(120).optional(),
  search: z.string().trim().min(1).max(240).optional(),
  sortBy: z.enum(Object.values(CUSTOMER_SORT_BY) as [CustomerSortBy, ...CustomerSortBy[]]).default(CUSTOMER_SORT_BY.CREATED_AT),
  sortOrder: z.enum(["asc", "desc"] as const).default("desc"),
}).strict();

export const createCustomerSchema = z.object({
  ...addressFields,
  dniOrCuil: dniSchema,
  email: emailSchema,
  fullName: nameSchema,
  notes: optionalText("Notes", 500),
  phone: phoneSchema,
  tags: tagsSchema.default([]),
}).strict().superRefine(validateConditionalAddress);

export const updateCustomerSchema = z.object({
  ...addressFields,
  dniOrCuil: dniSchema,
  email: emailSchema.optional(),
  fullName: nameSchema.optional(),
  notes: optionalText("Notes", 500),
  phone: phoneSchema,
  tags: tagsSchema.optional(),
}).strict().superRefine(validateConditionalAddress).refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  { error: "At least one customer field is required." },
);

export const updateCustomerNotesSchema = z.object({
  notes: z.string({ error: "Notes must be a string." }).trim().max(500, { error: "Notes are too long." }),
}).strict();

export const customerEmailAvailabilityQuerySchema = z.object({
  email: emailSchema,
  excludeCustomerId: customerIdentifierSchema.optional(),
}).strict();

export const customerAnonymizeBodySchema = z.preprocess(
  (value) => value === undefined ? {} : value,
  z.object({}).strict(),
);

function queryBoolean(value: unknown) {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return value;
}

export type CustomerListQuery = z.output<typeof customerListQuerySchema>;
export type CustomerIdParam = z.output<typeof customerIdParamSchema>;
export type CustomerAddressInput = z.output<typeof customerAddressSchema>;
export type CreateCustomerInput = z.output<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.output<typeof updateCustomerSchema>;
export type UpdateCustomerNotesInput = z.output<typeof updateCustomerNotesSchema>;
export type CustomerEmailAvailabilityQuery = z.output<typeof customerEmailAvailabilityQuerySchema>;
export type CustomerAnonymizeBody = z.output<typeof customerAnonymizeBodySchema>;
