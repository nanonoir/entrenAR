import { z } from "zod";

import { CheckoutRecoveryStatus } from "../../generated/prisma/enums";

export const RECOVERY_TIMING = {
  FOURTEEN_DAYS: "14_days",
  THREE_DAYS: "3_days",
  SIX_HOURS: "6hs",
  SEVEN_DAYS: "7_days",
  TWENTY_FOUR_HOURS: "24hs",
  MANUAL: "manual",
} as const;

export type RecoveryTiming = (typeof RECOVERY_TIMING)[keyof typeof RECOVERY_TIMING];

export const recoveryTimingSchema = z.enum([
  RECOVERY_TIMING.SIX_HOURS,
  RECOVERY_TIMING.TWENTY_FOUR_HOURS,
  RECOVERY_TIMING.THREE_DAYS,
  RECOVERY_TIMING.SEVEN_DAYS,
  RECOVERY_TIMING.FOURTEEN_DAYS,
  RECOVERY_TIMING.MANUAL,
] as const);

export const RECOVERY_STATUS = {
  DISCARDED: CheckoutRecoveryStatus.DISCARDED,
  MANUAL: CheckoutRecoveryStatus.MANUAL,
  PENDING: CheckoutRecoveryStatus.PENDING,
  RECOVERED: CheckoutRecoveryStatus.RECOVERED,
  SENT: CheckoutRecoveryStatus.SENT,
} as const;

export type RecoveryStatus = (typeof RECOVERY_STATUS)[keyof typeof RECOVERY_STATUS];

export const recoveryStatusSchema = z.enum([
  RECOVERY_STATUS.PENDING,
  RECOVERY_STATUS.SENT,
  RECOVERY_STATUS.MANUAL,
  RECOVERY_STATUS.RECOVERED,
  RECOVERY_STATUS.DISCARDED,
] as const);

export const ABANDONED_CART_SORT_BY = {
  ABANDONED_AT: "abandonedAt",
  CREATED_AT: "createdAt",
  CUSTOMER_NAME: "customerName",
  LAST_ACTIVITY_AT: "lastActivityAt",
  RECOVERY_STATUS: "recoveryStatus",
  TOTAL: "total",
  UPDATED_AT: "updatedAt",
} as const;

export type AbandonedCartSortBy = (typeof ABANDONED_CART_SORT_BY)[keyof typeof ABANDONED_CART_SORT_BY];

export const ABANDONED_CART_SORT_ORDER = {
  ASC: "asc",
  DESC: "desc",
} as const;

export type AbandonedCartSortOrder = (typeof ABANDONED_CART_SORT_ORDER)[keyof typeof ABANDONED_CART_SORT_ORDER];

const identifierSchema = z.string({ error: "Identifier must be a string." })
  .trim()
  .min(1, { error: "Identifier is required." })
  .max(128, { error: "Identifier is too long." });
const moneySchema = z.number({ error: "Amount must be a number." })
  .finite({ error: "Amount must be finite." })
  .nonnegative({ error: "Amount must be zero or greater." });
const queryMoneySchema = z.coerce.number().finite().nonnegative();
const dateTimeSchema = z.iso.datetime();
const optionalNoteSchema = z.string().trim().min(1).max(2_000).optional();
const emptyBody = (shape: Record<string, z.ZodType>) => z.preprocess(
  (value) => value === undefined ? {} : value,
  z.object(shape).strict(),
);

export const abandonedCartIdentifierSchema = identifierSchema;
export const abandonedCartIdParamSchema = z.object({ id: abandonedCartIdentifierSchema }).strict();

export const abandonedCartListQuerySchema = z.object({
  from: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  maxTotal: queryMoneySchema.optional(),
  minTotal: queryMoneySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().min(1).max(240).optional(),
  sortBy: z.enum([
    ABANDONED_CART_SORT_BY.ABANDONED_AT,
    ABANDONED_CART_SORT_BY.CREATED_AT,
    ABANDONED_CART_SORT_BY.CUSTOMER_NAME,
    ABANDONED_CART_SORT_BY.LAST_ACTIVITY_AT,
    ABANDONED_CART_SORT_BY.RECOVERY_STATUS,
    ABANDONED_CART_SORT_BY.TOTAL,
    ABANDONED_CART_SORT_BY.UPDATED_AT,
  ] as const).default(ABANDONED_CART_SORT_BY.ABANDONED_AT),
  sortOrder: z.enum([ABANDONED_CART_SORT_ORDER.ASC, ABANDONED_CART_SORT_ORDER.DESC] as const).default(ABANDONED_CART_SORT_ORDER.DESC),
  status: z.preprocess(
    (value) => typeof value === "string" ? value.toUpperCase() : value,
    recoveryStatusSchema,
  ).optional(),
  to: z.coerce.date().optional(),
}).strict().superRefine((query, context) => {
  if (query.from && query.to && query.from > query.to) {
    context.addIssue({ code: "custom", message: "from must be before or equal to to.", path: ["from"] });
  }
  if (query.minTotal !== undefined && query.maxTotal !== undefined && query.minTotal > query.maxTotal) {
    context.addIssue({ code: "custom", message: "minTotal must be less than or equal to maxTotal.", path: ["minTotal"] });
  }
});

export const abandonedCartFilterQuerySchema = abandonedCartListQuerySchema;

export const sendRecoveryEmailSchema = emptyBody({
  note: optionalNoteSchema,
  subjectOverride: z.string().trim().min(1).max(240).optional(),
});

export const manualRecoverySchema = emptyBody({ note: optionalNoteSchema });
export const convertCartSchema = emptyBody({ notes: optionalNoteSchema });
export const discardCartSchema = z.object({
  reason: z.string().trim().min(3).max(2_000),
}).strict();

export const updateRecoveryConfigSchema = z.object({
  isActive: z.boolean(),
  timing: recoveryTimingSchema,
}).strict();

const templateTextSchema = z.string().min(1).refine((value) => value.trim().length > 0, { error: "Template content cannot be blank." });
export const updateRecoveryTemplateSchema = z.object({
  htmlBody: templateTextSchema,
  plainTextBody: templateTextSchema,
  subject: templateTextSchema,
}).strict();

export const recoveryConfigSchema = updateRecoveryConfigSchema;
export const recoveryTemplateSchema = updateRecoveryTemplateSchema;

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

export const abandonedCartTimelineEventSchema = z.object({
  actorId: identifierSchema.nullable().optional(),
  actorRole: z.string().trim().min(1).nullable().optional(),
  createdAt: dateTimeSchema,
  eventType: z.string().trim().min(1),
  id: identifierSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().nullable().optional(),
}).strict();

export const abandonedCartItemSummarySchema = z.object({
  abandonedAt: dateTimeSchema,
  customer: abandonedCartCustomerSummarySchema,
  id: identifierSchema,
  lastEmailSentAt: dateTimeSchema.nullable().optional(),
  products: z.array(abandonedCartProductSummarySchema),
  recoveryStatus: recoveryStatusSchema,
  total: moneySchema,
}).strict();

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
  items: z.array(abandonedCartItemSummarySchema),
  limit: z.number().int().positive(),
  page: z.number().int().positive(),
  summary: abandonedCartSummaryStatsSchema,
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
}).strict();

export const abandonedCartDetailResponseSchema = abandonedCartItemSummarySchema.extend({
  cartId: identifierSchema,
  items: z.array(abandonedCartProductSummarySchema),
  recoveryExpiresAt: dateTimeSchema.nullable().optional(),
  recoveryLink: abandonedCartRecoveryLinkSchema.nullable().optional(),
  timeline: z.array(abandonedCartTimelineEventSchema),
});

export const abandonedCartActionResponseSchema = z.object({
  cart: abandonedCartItemSummarySchema,
  orderId: identifierSchema.optional(),
  recoveryLink: abandonedCartRecoveryLinkSchema.nullable().optional(),
}).strict();

export type AbandonedCartIdParam = z.output<typeof abandonedCartIdParamSchema>;
export type AbandonedCartListQuery = z.output<typeof abandonedCartListQuerySchema>;
export type AbandonedCartFilterQuery = AbandonedCartListQuery;
export type SendRecoveryEmailInput = z.output<typeof sendRecoveryEmailSchema>;
export type ManualRecoveryInput = z.output<typeof manualRecoverySchema>;
export type ConvertCartInput = z.output<typeof convertCartSchema>;
export type DiscardCartInput = z.output<typeof discardCartSchema>;
export type UpdateRecoveryConfigInput = z.output<typeof updateRecoveryConfigSchema>;
export type UpdateRecoveryTemplateInput = z.output<typeof updateRecoveryTemplateSchema>;
export type AbandonedCartCustomerSummary = z.output<typeof abandonedCartCustomerSummarySchema>;
export type AbandonedCartProductSummary = z.output<typeof abandonedCartProductSummarySchema>;
export type AbandonedCartRecoveryLink = z.output<typeof abandonedCartRecoveryLinkSchema>;
export type AbandonedCartTimelineEvent = z.output<typeof abandonedCartTimelineEventSchema>;
export type AbandonedCartItemSummary = z.output<typeof abandonedCartItemSummarySchema>;
export type AbandonedCartSummaryStats = z.output<typeof abandonedCartSummaryStatsSchema>;
export type AbandonedCartPagination = z.output<typeof abandonedCartPaginationSchema>;
export type AbandonedCartListResponse = z.output<typeof abandonedCartListResponseSchema>;
export type AbandonedCartDetailResponse = z.output<typeof abandonedCartDetailResponseSchema>;
export type AbandonedCartActionResponse = z.output<typeof abandonedCartActionResponseSchema>;

export const abandonedCartListQueryDtoSchema = abandonedCartListQuerySchema;
export const abandonedCartFilterQueryDtoSchema = abandonedCartFilterQuerySchema;
