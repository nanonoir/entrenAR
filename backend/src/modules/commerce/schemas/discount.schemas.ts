import { z } from "zod";

import {
  ARGENTINE_SHIPPING_ZONE_IDS,
  COUPON_CUSTOMER_LIMIT_TYPE,
  COUPON_DATE_LIMIT_TYPE,
  COUPON_DISCOUNT_TYPE,
  COUPON_MAX_DISCOUNT_TYPE,
  COUPON_TARGET_TYPE,
  COUPON_USAGE_LIMIT_TYPE,
  DISCOUNT_STATUS,
  SHIPPING_DISCOUNT_TARGET_TYPE,
  SHIPPING_ZONE_TARGET_TYPE,
  isSupportedShippingMethodId,
  normalizeShippingMethodId,
} from "../commerce.constants";

const couponDiscountTypeValues = [
  COUPON_DISCOUNT_TYPE.PERCENTAGE,
  COUPON_DISCOUNT_TYPE.FIXED,
  COUPON_DISCOUNT_TYPE.FREE_SHIPPING,
] as [
  (typeof COUPON_DISCOUNT_TYPE)[keyof typeof COUPON_DISCOUNT_TYPE],
  ...(typeof COUPON_DISCOUNT_TYPE)[keyof typeof COUPON_DISCOUNT_TYPE][],
];

const couponTargetTypeValues = [
  COUPON_TARGET_TYPE.ALL_STORE,
  COUPON_TARGET_TYPE.CATEGORIES,
  COUPON_TARGET_TYPE.PRODUCTS,
] as [
  (typeof COUPON_TARGET_TYPE)[keyof typeof COUPON_TARGET_TYPE],
  ...(typeof COUPON_TARGET_TYPE)[keyof typeof COUPON_TARGET_TYPE][],
];

const couponUsageLimitTypeValues = [
  COUPON_USAGE_LIMIT_TYPE.UNLIMITED,
  COUPON_USAGE_LIMIT_TYPE.LIMITED,
] as [
  (typeof COUPON_USAGE_LIMIT_TYPE)[keyof typeof COUPON_USAGE_LIMIT_TYPE],
  ...(typeof COUPON_USAGE_LIMIT_TYPE)[keyof typeof COUPON_USAGE_LIMIT_TYPE][],
];

const couponCustomerLimitTypeValues = [
  COUPON_CUSTOMER_LIMIT_TYPE.UNLIMITED,
  COUPON_CUSTOMER_LIMIT_TYPE.LIMITED,
  COUPON_CUSTOMER_LIMIT_TYPE.FIRST_PURCHASE,
] as [
  (typeof COUPON_CUSTOMER_LIMIT_TYPE)[keyof typeof COUPON_CUSTOMER_LIMIT_TYPE],
  ...(typeof COUPON_CUSTOMER_LIMIT_TYPE)[keyof typeof COUPON_CUSTOMER_LIMIT_TYPE][],
];

const couponDateLimitTypeValues = [
  COUPON_DATE_LIMIT_TYPE.UNLIMITED,
  COUPON_DATE_LIMIT_TYPE.PERIOD,
] as [
  (typeof COUPON_DATE_LIMIT_TYPE)[keyof typeof COUPON_DATE_LIMIT_TYPE],
  ...(typeof COUPON_DATE_LIMIT_TYPE)[keyof typeof COUPON_DATE_LIMIT_TYPE][],
];

const couponMaxDiscountTypeValues = [
  COUPON_MAX_DISCOUNT_TYPE.NONE,
  COUPON_MAX_DISCOUNT_TYPE.AMOUNT,
] as [
  (typeof COUPON_MAX_DISCOUNT_TYPE)[keyof typeof COUPON_MAX_DISCOUNT_TYPE],
  ...(typeof COUPON_MAX_DISCOUNT_TYPE)[keyof typeof COUPON_MAX_DISCOUNT_TYPE][],
];

const discountStatusValues = [DISCOUNT_STATUS.ACTIVE, DISCOUNT_STATUS.INACTIVE] as [
  (typeof DISCOUNT_STATUS)[keyof typeof DISCOUNT_STATUS],
  ...(typeof DISCOUNT_STATUS)[keyof typeof DISCOUNT_STATUS][],
];

const shippingDiscountTargetTypeValues = [
  SHIPPING_DISCOUNT_TARGET_TYPE.ALL_STORE,
  SHIPPING_DISCOUNT_TARGET_TYPE.CATEGORIES,
] as [
  (typeof SHIPPING_DISCOUNT_TARGET_TYPE)[keyof typeof SHIPPING_DISCOUNT_TARGET_TYPE],
  ...(typeof SHIPPING_DISCOUNT_TARGET_TYPE)[keyof typeof SHIPPING_DISCOUNT_TARGET_TYPE][],
];

const shippingZoneTargetTypeValues = [SHIPPING_ZONE_TARGET_TYPE.ALL, SHIPPING_ZONE_TARGET_TYPE.SPECIFIC] as [
  (typeof SHIPPING_ZONE_TARGET_TYPE)[keyof typeof SHIPPING_ZONE_TARGET_TYPE],
  ...(typeof SHIPPING_ZONE_TARGET_TYPE)[keyof typeof SHIPPING_ZONE_TARGET_TYPE][],
];

const identifierSchema = z.string({ error: "Identifier must be a string." })
  .trim()
  .min(1, { error: "Identifier is required." })
  .max(160, { error: "Identifier is too long." });

const positiveIntegerSchema = z.number({ error: "Value must be a number." })
  .int({ error: "Value must be an integer." })
  .positive({ error: "Value must be greater than zero." });

const nonNegativeMoneySchema = z.number({ error: "Amount must be a number." })
  .finite({ error: "Amount must be finite." })
  .nonnegative({ error: "Amount must be zero or greater." })
  .multipleOf(0.01, { error: "Amount can have at most two decimal places." });

const positiveMoneySchema = z.number({ error: "Amount must be a number." })
  .finite({ error: "Amount must be finite." })
  .positive({ error: "Amount must be greater than zero." })
  .multipleOf(0.01, { error: "Amount can have at most two decimal places." });

const identifierListSchema = z.array(identifierSchema)
  .refine((values) => new Set(values).size === values.length, { error: "Identifiers must not repeat." });

export function normalizeCouponCode(value: string): string {
  return value.trim().toLocaleUpperCase();
}

const couponCodeSchema = z.string({ error: "Coupon code must be a string." })
  .trim()
  .min(1, { error: "Coupon code is required." })
  .max(80, { error: "Coupon code is too long." })
  .transform(normalizeCouponCode)
  .refine((value) => /^[A-Z0-9-]+$/.test(value), { error: "Coupon code may contain only letters, numbers, and hyphens." });

const dateSchema = z.iso.date({ error: "Date must be a valid ISO date." });

export const couponSchema = z.object({
  canCombineWithPromotions: z.boolean(),
  categoryIds: identifierListSchema,
  code: couponCodeSchema,
  customerLimitType: z.enum(couponCustomerLimitTypeValues),
  customerUsageLimit: positiveIntegerSchema.optional(),
  dateLimitType: z.enum(couponDateLimitTypeValues),
  discountType: z.enum(couponDiscountTypeValues),
  discountValue: positiveMoneySchema.optional(),
  endDate: dateSchema.optional(),
  includeShippingCost: z.boolean(),
  maxDiscountAmount: positiveMoneySchema.optional(),
  maxDiscountType: z.enum(couponMaxDiscountTypeValues),
  minimumCartAmount: nonNegativeMoneySchema,
  productIds: identifierListSchema,
  startDate: dateSchema.optional(),
  status: z.enum(discountStatusValues).default(DISCOUNT_STATUS.ACTIVE),
  targetType: z.enum(couponTargetTypeValues),
  totalUsageLimit: positiveIntegerSchema.optional(),
  totalUsageLimitType: z.enum(couponUsageLimitTypeValues),
}).strict().superRefine((input, context) => {
  if (input.discountType === COUPON_DISCOUNT_TYPE.PERCENTAGE && (input.discountValue === undefined || input.discountValue < 1 || input.discountValue > 100)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Percentage discounts must be between 1 and 100.", path: ["discountValue"] });
  }

  if (input.discountType === COUPON_DISCOUNT_TYPE.FIXED && input.discountValue === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Fixed discounts require a discount amount.", path: ["discountValue"] });
  }

  if (input.discountType === COUPON_DISCOUNT_TYPE.FREE_SHIPPING && input.discountValue !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Free-shipping coupons must not include a discount amount.", path: ["discountValue"] });
  }

  if (input.targetType === COUPON_TARGET_TYPE.ALL_STORE && (input.categoryIds.length > 0 || input.productIds.length > 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Store-wide coupons must not include category or product targets.", path: ["targetType"] });
  }

  if (input.targetType === COUPON_TARGET_TYPE.CATEGORIES && input.categoryIds.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Category-targeted coupons require at least one category.", path: ["categoryIds"] });
  }

  if (input.targetType === COUPON_TARGET_TYPE.CATEGORIES && input.productIds.length > 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Category-targeted coupons must not include product targets.", path: ["productIds"] });
  }

  if (input.targetType === COUPON_TARGET_TYPE.PRODUCTS && input.productIds.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Product-targeted coupons require at least one product.", path: ["productIds"] });
  }

  if (input.targetType === COUPON_TARGET_TYPE.PRODUCTS && input.categoryIds.length > 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Product-targeted coupons must not include category targets.", path: ["categoryIds"] });
  }

  if (input.totalUsageLimitType === COUPON_USAGE_LIMIT_TYPE.LIMITED && input.totalUsageLimit === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Limited coupons require a total usage limit.", path: ["totalUsageLimit"] });
  }

  if (input.totalUsageLimitType === COUPON_USAGE_LIMIT_TYPE.UNLIMITED && input.totalUsageLimit !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Unlimited coupons must not include a total usage limit.", path: ["totalUsageLimit"] });
  }

  if (input.customerLimitType === COUPON_CUSTOMER_LIMIT_TYPE.LIMITED && input.customerUsageLimit === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Limited customer usage requires a per-customer limit.", path: ["customerUsageLimit"] });
  }

  if (input.customerLimitType !== COUPON_CUSTOMER_LIMIT_TYPE.LIMITED && input.customerUsageLimit !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A per-customer limit is only valid for limited customer usage.", path: ["customerUsageLimit"] });
  }

  if (input.dateLimitType === COUPON_DATE_LIMIT_TYPE.PERIOD && !input.startDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A period coupon requires a start date.", path: ["startDate"] });
  }

  if (input.dateLimitType === COUPON_DATE_LIMIT_TYPE.PERIOD && !input.endDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A period coupon requires an end date.", path: ["endDate"] });
  }

  if (input.dateLimitType === COUPON_DATE_LIMIT_TYPE.UNLIMITED && (input.startDate !== undefined || input.endDate !== undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Unlimited-date coupons must not include a date range.", path: ["dateLimitType"] });
  }

  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "The coupon end date must not precede its start date.", path: ["endDate"] });
  }

  if (input.maxDiscountType === COUPON_MAX_DISCOUNT_TYPE.AMOUNT && input.maxDiscountAmount === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "An amount cap requires a maximum discount amount.", path: ["maxDiscountAmount"] });
  }

  if (input.maxDiscountType === COUPON_MAX_DISCOUNT_TYPE.NONE && input.maxDiscountAmount !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A coupon without a cap must not include a maximum discount amount.", path: ["maxDiscountAmount"] });
  }
});

const shippingMethodIdSchema = identifierSchema.transform(normalizeShippingMethodId);

export const shippingDiscountSchema = z.object({
  canCombineWithPromotions: z.boolean(),
  categoryIds: identifierListSchema,
  minimumCartAmount: nonNegativeMoneySchema,
  onlyCheapestShippingMethod: z.boolean(),
  shippingMethodIds: z.array(shippingMethodIdSchema)
    .min(1, { error: "At least one shipping method is required." })
    .refine((values) => new Set(values).size === values.length, { error: "Shipping methods must not repeat." }),
  status: z.enum(discountStatusValues).default(DISCOUNT_STATUS.ACTIVE),
  targetType: z.enum(shippingDiscountTargetTypeValues),
  zoneIds: identifierListSchema,
  zoneTargetType: z.enum(shippingZoneTargetTypeValues),
}).strict().superRefine((input, context) => {
  const invalidMethods = input.shippingMethodIds.filter((id) => !isSupportedShippingMethodId(id));
  if (invalidMethods.length > 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "One or more shipping methods are not supported.", path: ["shippingMethodIds"] });
  }

  if (input.targetType === SHIPPING_DISCOUNT_TARGET_TYPE.CATEGORIES && input.categoryIds.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Category-targeted shipping discounts require at least one category.", path: ["categoryIds"] });
  }

  if (input.targetType === SHIPPING_DISCOUNT_TARGET_TYPE.ALL_STORE && input.categoryIds.length > 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Store-wide shipping discounts must not include categories.", path: ["categoryIds"] });
  }

  if (input.zoneTargetType === SHIPPING_ZONE_TARGET_TYPE.SPECIFIC && input.zoneIds.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Specific-zone shipping discounts require at least one zone.", path: ["zoneIds"] });
  }

  if (input.zoneTargetType === SHIPPING_ZONE_TARGET_TYPE.ALL && input.zoneIds.length > 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "All-zone shipping discounts must not include zones.", path: ["zoneIds"] });
  }

  const invalidZones = input.zoneIds.filter((zoneId) => !ARGENTINE_SHIPPING_ZONE_IDS.includes(zoneId));
  if (invalidZones.length > 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "One or more shipping zones are not supported.", path: ["zoneIds"] });
  }
});

export const couponRequestSchema = couponSchema;
export const shippingDiscountRequestSchema = shippingDiscountSchema;

export type CouponInput = z.output<typeof couponSchema>;
export type ShippingDiscountInput = z.output<typeof shippingDiscountSchema>;
