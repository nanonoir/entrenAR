import { z } from "zod";

import { SupplierStatus } from "../../generated/prisma/enums";

export const supplierIdentifierSchema = z.string().trim().min(1).max(128);
const id = supplierIdentifierSchema;
const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().min(1).max(max).nullable().optional();
const statuses = [SupplierStatus.ACTIVE, SupplierStatus.INACTIVE] as const;
const status = z.preprocess((value) => typeof value === "string" ? value.toUpperCase() : value, z.enum(statuses));

const supplierFields = {
  code: text(80).transform((value) => value.toUpperCase()),
  contactName: optionalText(160),
  email: z.string().trim().pipe(z.email()).nullable().optional(),
  name: text(160),
  notes: optionalText(2_000),
  phone: optionalText(80),
};

export const createSupplierSchema = z.object({ ...supplierFields, status: status.default(SupplierStatus.ACTIVE) }).strict();
export const supplierStatusSchema = z.object({ status }).strict();
export const updateSupplierSchema = z.object({
  id: id.optional(),
  code: supplierFields.code.optional(),
  contactName: supplierFields.contactName,
  email: supplierFields.email,
  name: supplierFields.name.optional(),
  notes: supplierFields.notes,
  phone: supplierFields.phone,
  status: status.optional(),
}).strict().refine((value) => Object.entries(value).some(([key, entry]) => key !== "id" && entry !== undefined), "At least one supplier field is required.");

export const supplierFilterQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().min(1).max(240).optional(),
  sortBy: z.enum(["name", "code", "status", "createdAt", "updatedAt"] as const).default("name"),
  sortOrder: z.enum(["asc", "desc"] as const).default("asc"),
  status: status.optional(),
}).strict();

export const supplierResponseSchema = z.object({
  code: z.string(),
  contactName: z.string().nullable(),
  createdAt: z.string(),
  email: z.string().nullable(),
  id: z.string(),
  name: z.string(),
  notes: z.string().nullable(),
  phone: z.string().nullable(),
  status: z.enum(statuses),
  updatedAt: z.string(),
}).strict();
export const supplierListResponseSchema = z.object({ items: z.array(supplierResponseSchema), limit: z.number(), page: z.number(), total: z.number() }).strict();

export type CreateSupplierDto = z.output<typeof createSupplierSchema>;
export type UpdateSupplierDto = z.output<typeof updateSupplierSchema>;
export type SupplierFilterQueryDto = z.output<typeof supplierFilterQuerySchema>;
export type SupplierResponseDto = z.output<typeof supplierResponseSchema>;
export type SupplierListResponseDto = z.output<typeof supplierListResponseSchema>;
export type CreateSupplierInput = CreateSupplierDto;
export type UpdateSupplierInput = UpdateSupplierDto;
export type SupplierFilterQuery = SupplierFilterQueryDto;
export const createSupplierDtoSchema = createSupplierSchema;
export const updateSupplierDtoSchema = updateSupplierSchema;
export const supplierFilterQueryDtoSchema = supplierFilterQuerySchema;
