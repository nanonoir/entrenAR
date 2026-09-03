import { z } from "zod";

import {
  CHECKOUT_COUPON_RESULT,
  CHECKOUT_CURRENCY,
  CHECKOUT_ORDER_STATUS,
  CHECKOUT_PAYMENT_STATUS,
  CHECKOUT_RECOVERY_STATUS,
  CHECKOUT_SESSION_STATUS,
  CHECKOUT_SHIPPING_MODALITY,
} from "../checkout.constants";
import {
  checkoutAddressSchema,
  couponCodeSchema,
  identifierSchema,
  moneySchema,
  nameSchema,
  opaqueTokenSchema,
  paymentMethodIdSchema,
  quantitySchema,
  requiredText,
} from "./checkout-common.schemas";

const shippingModalityValues = Object.values(CHECKOUT_SHIPPING_MODALITY) as [
  (typeof CHECKOUT_SHIPPING_MODALITY)[keyof typeof CHECKOUT_SHIPPING_MODALITY],
  ...(typeof CHECKOUT_SHIPPING_MODALITY)[keyof typeof CHECKOUT_SHIPPING_MODALITY][],
];

const couponResultValues = Object.values(CHECKOUT_COUPON_RESULT) as [
  (typeof CHECKOUT_COUPON_RESULT)[keyof typeof CHECKOUT_COUPON_RESULT],
  ...(typeof CHECKOUT_COUPON_RESULT)[keyof typeof CHECKOUT_COUPON_RESULT][],
];

const orderStatusValues = Object.values(CHECKOUT_ORDER_STATUS) as [
  (typeof CHECKOUT_ORDER_STATUS)[keyof typeof CHECKOUT_ORDER_STATUS],
  ...(typeof CHECKOUT_ORDER_STATUS)[keyof typeof CHECKOUT_ORDER_STATUS][],
];

const paymentStatusValues = Object.values(CHECKOUT_PAYMENT_STATUS) as [
  (typeof CHECKOUT_PAYMENT_STATUS)[keyof typeof CHECKOUT_PAYMENT_STATUS],
  ...(typeof CHECKOUT_PAYMENT_STATUS)[keyof typeof CHECKOUT_PAYMENT_STATUS][],
];

const recoveryStatusValues = Object.values(CHECKOUT_RECOVERY_STATUS) as [
  (typeof CHECKOUT_RECOVERY_STATUS)[keyof typeof CHECKOUT_RECOVERY_STATUS],
  ...(typeof CHECKOUT_RECOVERY_STATUS)[keyof typeof CHECKOUT_RECOVERY_STATUS][],
];

const availableQuantitySchema = z.number().int().nonnegative();

export const checkoutQuoteItemSchema = z.object({
  availableQuantity: availableQuantitySchema.nullable().optional(),
  compareAtPrice: moneySchema.optional(),
  lineSubtotal: moneySchema,
  productId: identifierSchema,
  productName: requiredText("Product name", 240),
  quantity: quantitySchema,
  sku: requiredText("SKU", 160),
  unitPrice: moneySchema,
  variantId: identifierSchema.optional(),
  variantName: requiredText("Variant name", 240).optional(),
  weightGrams: z.number().int().nonnegative().nullable().optional(),
}).strict();

export const checkoutShippingOptionSchema = z.object({
  cost: moneySchema,
  estimatedDelivery: requiredText("Estimated delivery", 120).optional(),
  id: identifierSchema,
  label: requiredText("Shipping option label", 160),
  modality: z.enum(shippingModalityValues),
  providerId: identifierSchema,
  providerName: requiredText("Shipping provider name", 160),
}).strict();

export const checkoutPickupPointSchema = z.object({
  address: checkoutAddressSchema,
  id: identifierSchema,
  name: requiredText("Pickup point name", 160),
  preparationHours: z.number().int().positive(),
}).strict();

export const checkoutPaymentOptionSchema = z.object({
  fee: requiredText("Payment fee", 80),
  id: identifierSchema,
  receiveIn: requiredText("Payment receive time", 120),
  salesIn: requiredText("Payment sales time", 120),
}).strict();

export const checkoutBankTransferSchema = z.object({
  alias: requiredText("Alias", 160),
  bankName: requiredText("Bank name", 160),
  cbuCvu: z.string().regex(/^\d{22}$/),
  cuitCuil: z.string().regex(/^\d{2}-\d{8}-\d$/),
  holderName: nameSchema("Holder name"),
}).strict();

export const checkoutPaymentMethodSchema = z.object({
  acceptedMethods: z.array(requiredText("Accepted method", 120)),
  bankConfig: checkoutBankTransferSchema.optional(),
  description: requiredText("Payment description", 500),
  id: paymentMethodIdSchema,
  logoSrc: requiredText("Payment logo", 500),
  name: requiredText("Payment method name", 160),
  options: z.array(checkoutPaymentOptionSchema),
  selectedOptionId: identifierSchema.optional(),
}).strict();

export const checkoutCouponResultSchema = z.object({
  code: couponCodeSchema.optional(),
  discountAmount: moneySchema,
  result: z.enum(couponResultValues),
  message: requiredText("Coupon message", 240).optional(),
}).strict();

export const checkoutWarningSchema = z.object({
  code: identifierSchema,
  message: requiredText("Warning message", 240),
}).strict();

export const checkoutQuoteResponseSchema = z.object({
  coupon: checkoutCouponResultSchema.nullable().optional(),
  currency: z.literal(CHECKOUT_CURRENCY),
  discount: moneySchema,
  expiresAt: z.iso.datetime().optional(),
  items: z.array(checkoutQuoteItemSchema),
  paymentMethods: z.array(checkoutPaymentMethodSchema),
  pickupPoints: z.array(checkoutPickupPointSchema),
  quoteId: opaqueTokenSchema,
  shipping: moneySchema,
  shippingOptions: z.array(checkoutShippingOptionSchema),
  sessionToken: opaqueTokenSchema.optional(),
  subtotal: moneySchema,
  total: moneySchema,
  warnings: z.array(checkoutWarningSchema),
  ok: z.literal(true),
}).strict();

export const checkoutOrderProjectionSchema = z.object({
  currency: z.literal(CHECKOUT_CURRENCY),
  id: identifierSchema,
  number: identifierSchema,
  status: z.enum(orderStatusValues),
  total: moneySchema,
}).strict();

export const checkoutCompleteResponseSchema = z.object({
  currency: z.literal(CHECKOUT_CURRENCY).optional(),
  number: identifierSchema,
  ok: z.literal(true),
  order: checkoutOrderProjectionSchema.optional(),
  orderId: identifierSchema,
  status: z.enum(orderStatusValues).optional(),
  total: moneySchema.optional(),
}).strict();

export const checkoutSessionProjectionSchema = z.object({
  abandonedAt: z.iso.datetime().nullable().optional(),
  id: identifierSchema,
  recoveryStatus: z.enum(recoveryStatusValues),
  status: z.enum(Object.values(CHECKOUT_SESSION_STATUS) as [
    (typeof CHECKOUT_SESSION_STATUS)[keyof typeof CHECKOUT_SESSION_STATUS],
    ...(typeof CHECKOUT_SESSION_STATUS)[keyof typeof CHECKOUT_SESSION_STATUS][],
  ]),
}).strict();

export const checkoutPaymentProjectionSchema = z.object({
  amount: moneySchema,
  currency: z.literal(CHECKOUT_CURRENCY),
  paymentMethodId: paymentMethodIdSchema,
  paymentOptionId: identifierSchema.optional(),
  status: z.enum(paymentStatusValues),
}).strict();

export type CheckoutCompleteResponse = z.output<typeof checkoutCompleteResponseSchema>;
export type CheckoutOrderProjection = z.output<typeof checkoutOrderProjectionSchema>;
export type CheckoutPaymentProjection = z.output<typeof checkoutPaymentProjectionSchema>;
export type CheckoutQuoteResponse = z.output<typeof checkoutQuoteResponseSchema>;
export type CheckoutSessionProjection = z.output<typeof checkoutSessionProjectionSchema>;
export type QuoteResponse = CheckoutQuoteResponse;
export type CompleteResponse = CheckoutCompleteResponse;

export const quoteResponseSchema = checkoutQuoteResponseSchema;
export const completeResponseSchema = checkoutCompleteResponseSchema;
