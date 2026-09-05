import { z } from "zod";

import {
  ABANDONED_CART_SORT_BY,
  ABANDONED_CART_SORT_ORDER,
  RECOVERY_STATUS,
  RECOVERY_TIMING,
  type AbandonedCartSortBy,
  type AbandonedCartSortOrder,
  type RecoveryStatus,
  type RecoveryTiming,
} from "./types";
import type { AbandonedCartsApiIssue } from "./types";

const identifierSchema = z.string({ error: "Identifier must be a string." })
  .trim()
  .min(1, { error: "Identifier is required." })
  .max(128, { error: "Identifier is too long." });
const moneySchema = z.number({ error: "Amount must be a number." })
  .finite({ error: "Amount must be finite." })
  .nonnegative({ error: "Amount must be zero or greater." });
const dateTimeSchema = z.iso.datetime();
const optionalNoteSchema = z.string().trim().min(1).max(2_000).optional();
const timingValues = Object.values(RECOVERY_TIMING) as [RecoveryTiming, ...RecoveryTiming[]];
const statusValues = Object.values(RECOVERY_STATUS) as [RecoveryStatus, ...RecoveryStatus[]];
const sortByValues = Object.values(ABANDONED_CART_SORT_BY) as [AbandonedCartSortBy, ...AbandonedCartSortBy[]];
const sortOrderValues = Object.values(ABANDONED_CART_SORT_ORDER) as [AbandonedCartSortOrder, ...AbandonedCartSortOrder[]];

const queryDateSchema = z.union([
  z.date(),
  z.string().trim().min(1).max(80),
]).refine((value) => {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(timestamp);
}, { error: "Date must be valid." });

export const recoveryTimingSchema = z.enum(timingValues);
export const recoveryStatusSchema = z.enum(statusValues);
export const abandonedCartIdentifierSchema = identifierSchema;
export const abandonedCartIdParamSchema = z.object({ id: identifierSchema }).strict();

export const abandonedCartListQuerySchema = z.object({
  from: queryDateSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  maxTotal: moneySchema.optional(),
  minTotal: moneySchema.optional(),
  page: z.number().int().min(1).default(1),
  search: z.string().trim().min(1).max(240).optional(),
  sortBy: z.enum(sortByValues).default(ABANDONED_CART_SORT_BY.ABANDONED_AT),
  sortOrder: z.enum(sortOrderValues).default(ABANDONED_CART_SORT_ORDER.DESC),
  status: z.preprocess(
    (value) => typeof value === "string" ? value.trim().toUpperCase() : value,
    recoveryStatusSchema,
  ).optional(),
  to: queryDateSchema.optional(),
}).strict().superRefine((query, context) => {
  if (query.from && query.to && queryDateValue(query.from) > queryDateValue(query.to)) {
    context.addIssue({ code: "custom", message: "from must be before or equal to to.", path: ["from"] });
  }
  if (query.minTotal !== undefined && query.maxTotal !== undefined && query.minTotal > query.maxTotal) {
    context.addIssue({ code: "custom", message: "minTotal must be less than or equal to maxTotal.", path: ["minTotal"] });
  }
});

export const abandonedCartFilterQuerySchema = abandonedCartListQuerySchema;

export const sendRecoveryEmailSchema = z.object({
  note: optionalNoteSchema,
  subjectOverride: z.string().trim().min(1).max(240).optional(),
}).strict();
export const manualRecoverySchema = z.object({ note: optionalNoteSchema }).strict();
export const convertCartSchema = z.object({ notes: optionalNoteSchema }).strict();
export const discardCartSchema = z.object({ reason: z.string().trim().min(3).max(2_000) }).strict();

export const recoveryConfigSchema = z.object({
  isActive: z.boolean(),
  timing: recoveryTimingSchema,
}).strict();
export const recoveryConfigPatchSchema = z.object({
  isActive: z.boolean().optional(),
  timing: recoveryTimingSchema.optional(),
}).strict();

const templateTextSchema = z.string().min(1).refine((value) => value.trim().length > 0, { error: "Template content cannot be blank." });
export const recoveryTemplateSchema = z.object({
  htmlBody: templateTextSchema,
  plainTextBody: templateTextSchema,
  subject: templateTextSchema,
}).strict();
export const recoveryTemplatePatchSchema = z.object({
  htmlBody: templateTextSchema.optional(),
  plainTextBody: templateTextSchema.optional(),
  subject: templateTextSchema.optional(),
}).strict();

export const abandonedCartCustomerSummarySchema = z.object({
  dni: z.string().trim().min(1).nullable().optional(),
  email: z.union([z.email(), z.literal("")]).nullable().optional(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  phone: z.string().trim().min(1).nullable().optional(),
}).strict();

export const abandonedCartProductSummarySchema = z.object({
  lineSubtotal: moneySchema.optional(),
  name: z.string().trim().min(1),
  productId: identifierSchema,
  quantity: z.number().int().positive(),
  sku: z.string().trim().min(1).optional(),
  unitPrice: moneySchema,
  variantId: identifierSchema.optional(),
  variantName: z.string().trim().min(1).optional(),
}).strict();

export const abandonedCartRecoveryLinkSchema = z.object({
  expiresAt: dateTimeSchema,
  isExpired: z.boolean().optional(),
  url: z.string().trim().min(1),
}).strict();

export const checkoutSessionHistoryEventSchema = z.object({
  actorId: identifierSchema.nullable().optional(),
  actorRole: z.string().trim().min(1).nullable().optional(),
  createdAt: dateTimeSchema,
  eventType: z.string().trim().min(1),
  id: identifierSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().nullable().optional(),
}).strict();
export const abandonedCartTimelineEventSchema = checkoutSessionHistoryEventSchema;

export const abandonedCartListItemSchema = z.object({
  abandonedAt: dateTimeSchema,
  customer: abandonedCartCustomerSummarySchema,
  id: identifierSchema,
  lastEmailSentAt: dateTimeSchema.nullable().optional(),
  products: z.array(abandonedCartProductSummarySchema),
  recoveryStatus: recoveryStatusSchema,
  total: moneySchema,
}).strict();
export const abandonedCartResponseSchema = abandonedCartListItemSchema;

export const abandonedCartSummaryStatsSchema = z.object({
  discardedCount: z.number().int().nonnegative().optional(),
  manualCount: z.number().int().nonnegative().optional(),
  pendingCount: z.number().int().nonnegative(),
  recoverableTotal: moneySchema,
  recoveredCount: z.number().int().nonnegative(),
  sentCount: z.number().int().nonnegative().optional(),
  totalCount: z.number().int().nonnegative().optional(),
}).strict();

export const abandonedCartPaginationSchema = z.object({
  hasNextPage: z.boolean().optional(),
  hasPreviousPage: z.boolean().optional(),
  limit: z.number().int().positive(),
  page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
}).strict();

export const abandonedCartListResponseSchema = z.object({
  items: z.array(abandonedCartListItemSchema),
  limit: z.number().int().positive(),
  page: z.number().int().positive(),
  summary: abandonedCartSummaryStatsSchema,
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
}).strict();

export const abandonedCartDetailResponseSchema = abandonedCartListItemSchema.extend({
  cartId: identifierSchema,
  items: z.array(abandonedCartProductSummarySchema),
  recoveryExpiresAt: dateTimeSchema.nullable().optional(),
  recoveryLink: abandonedCartRecoveryLinkSchema.nullable().optional(),
  timeline: z.array(checkoutSessionHistoryEventSchema),
});

export const recoveryActionResponseSchema = z.object({
  cart: abandonedCartListItemSchema,
  orderId: identifierSchema.optional(),
  recoveryLink: abandonedCartRecoveryLinkSchema.nullable().optional(),
}).strict();
export const abandonedCartActionResponseSchema = recoveryActionResponseSchema;

export type AbandonedCartListQueryContract = z.output<typeof abandonedCartListQuerySchema>;
export type RecoveryConfigContract = z.output<typeof recoveryConfigSchema>;
export type RecoveryEmailTemplateContract = z.output<typeof recoveryTemplateSchema>;

export function toValidationIssues(error: z.ZodError): AbandonedCartsApiIssue[] {
  return error.issues.map((issue) => ({
    code: issue.code,
    field: issue.path.map(String).join(".") || "request",
    message: issue.message,
  }));
}

function queryDateValue(value: Date | string): number {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}
