import { z } from "zod";

import type { CheckoutAddressInput } from "@/lib/api/checkout/checkout.repository";

const CHECKOUT_CURRENCY = "ARS" as const;

const CHECKOUT_DELIVERY_TYPE = {
  PICKUP: "pickup",
  SHIPPING: "shipping",
} as const;

const CHECKOUT_SHIPPING_MODALITY = {
  BRANCH_DELIVERY: "branch_delivery",
  HOME_DELIVERY: "home_delivery",
} as const;

const CHECKOUT_COUPON_RESULT = {
  APPLIED: "applied",
  NOT_PROVIDED: "not_provided",
  REJECTED: "rejected",
} as const;

const CHECKOUT_ORDER_STATUS = {
  CANCELLED: "cancelled",
  CONFIRMED: "confirmed",
  PENDING: "pending",
} as const;

const CHECKOUT_PAYMENT_METHOD_IDS = ["bank-transfer", "mercado-pago", "stripe"] as const;

const identifierSchema = z.string({ error: "Identifier must be a string." })
  .trim()
  .min(1, { error: "Identifier is required." })
  .max(128, { error: "Identifier is too long." });

const requiredText = (field: string, max: number) => z.string({ error: `${field} must be a string.` })
  .trim()
  .min(1, { error: `${field} is required.` })
  .max(max, { error: `${field} is too long.` });

const nameSchema = (field: string) => requiredText(field, 160)
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u, { error: `${field} contains invalid characters.` });

const phoneSchema = requiredText("Phone", 32).regex(/^[+]?\d[\d ()-]*$/, {
  error: "Phone contains invalid characters.",
});

const postalCodeSchema = requiredText("Postal code", 24).regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/, {
  error: "Postal code contains invalid characters.",
});

const quantitySchema = z.number({ error: "Quantity must be a number." })
  .int({ error: "Quantity must be an integer." })
  .positive({ error: "Quantity must be greater than zero." })
  .max(1_000, { error: "Quantity is too large." });

const opaqueTokenSchema = z.string({ error: "Token must be a string." })
  .trim()
  .min(16, { error: "Token is too short." })
  .max(512, { error: "Token is too long." })
  .regex(/^[A-Za-z0-9._~:-]+$/, { error: "Token contains invalid characters." });

const couponCodeSchema = requiredText("Coupon code", 80)
  .transform((value) => value.toLocaleUpperCase())
  .refine((value) => /^[A-Z0-9-]+$/.test(value), {
    error: "Coupon code may contain only letters, numbers, and hyphens.",
  });

const moneyNumberSchema = z.number({ error: "Amount must be a number." })
  .finite({ error: "Amount must be finite." })
  .nonnegative({ error: "Amount must be zero or greater." })
  .multipleOf(0.01, { error: "Amount can have at most two decimal places." });

const moneySchema = z.union([
  moneyNumberSchema,
  z.string({ error: "Amount must be a number." })
    .trim()
    .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/, { error: "Amount must be a valid decimal." })
    .transform((value) => Number(value))
    .pipe(moneyNumberSchema),
]);

const checkoutAddressSchema = z.object({
  city: requiredText("City", 120),
  label: requiredText("Address label", 60).optional(),
  number: requiredText("Street number", 32).optional(),
  phone: phoneSchema.optional(),
  postalCode: postalCodeSchema,
  province: requiredText("Province", 120),
  recipient: nameSchema("Recipient").optional(),
  street: requiredText("Street", 200),
}).strict();

const checkoutCustomerSchema = z.object({
  dni: z.string({ error: "DNI must be a string." })
    .trim()
    .regex(/^\d{6,11}$/, { error: "DNI must contain between 6 and 11 digits." })
    .optional(),
  email: z.email({ error: "Email must be valid." }).transform((email) => email.toLocaleLowerCase()),
  firstName: nameSchema("First name"),
  lastName: nameSchema("Last name"),
  phone: phoneSchema.optional(),
}).strict();

const checkoutLineItemSchema = z.object({
  productId: identifierSchema,
  quantity: quantitySchema,
  variantId: identifierSchema.optional(),
}).strict();

const checkoutItemsSchema = z.array(checkoutLineItemSchema)
  .min(1, { error: "At least one checkout item is required." })
  .max(100, { error: "Too many checkout items." })
  .superRefine((items, context) => {
    const keys = new Set<string>();

    items.forEach((item, index) => {
      const key = `${item.productId}:${item.variantId ?? ""}`;
      if (keys.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Checkout items must not contain duplicate product variants.",
          path: [index],
        });
      }
      keys.add(key);
    });
  });

const checkoutSelectionShape = {
  address: checkoutAddressSchema.optional(),
  addressId: identifierSchema.optional(),
  city: requiredText("City", 120).optional(),
  couponCode: couponCodeSchema.optional(),
  deliveryType: z.enum([CHECKOUT_DELIVERY_TYPE.PICKUP, CHECKOUT_DELIVERY_TYPE.SHIPPING]).optional(),
  items: checkoutItemsSchema,
  pickupPointId: identifierSchema.optional(),
  postalCode: postalCodeSchema.optional(),
  province: requiredText("Province", 120).optional(),
  sessionToken: opaqueTokenSchema.optional(),
  shippingMethodId: identifierSchema.optional(),
  shippingProviderId: identifierSchema.optional(),
};

export const checkoutQuoteRequestSchema = z.object(checkoutSelectionShape)
  .strict()
  .superRefine(validateDeliverySelection);

export const checkoutCompleteRequestSchema = z.object({
  ...checkoutSelectionShape,
  customer: checkoutCustomerSchema,
  idempotencyKey: z.string({ error: "Idempotency key must be a string." })
    .trim()
    .min(8, { error: "Idempotency key is too short." })
    .max(128, { error: "Idempotency key is too long." })
    .regex(/^[A-Za-z0-9._:-]+$/, { error: "Idempotency key contains invalid characters." }),
  paymentMethodId: z.enum(CHECKOUT_PAYMENT_METHOD_IDS),
  paymentOptionId: identifierSchema.optional(),
  quoteId: opaqueTokenSchema.optional(),
}).strict().superRefine(validateDeliverySelection);

const checkoutQuoteItemSchema = z.object({
  availableQuantity: z.number().int().nonnegative().nullable().optional(),
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

const checkoutShippingOptionSchema = z.object({
  cost: moneySchema,
  estimatedDelivery: requiredText("Estimated delivery", 120).optional(),
  id: identifierSchema,
  label: requiredText("Shipping option label", 160),
  modality: z.enum([CHECKOUT_SHIPPING_MODALITY.BRANCH_DELIVERY, CHECKOUT_SHIPPING_MODALITY.HOME_DELIVERY]),
  providerId: identifierSchema,
  providerName: requiredText("Shipping provider name", 160),
}).strict();

const checkoutPickupPointSchema = z.object({
  address: checkoutAddressSchema,
  id: identifierSchema,
  name: requiredText("Pickup point name", 160),
  preparationHours: z.number().int().positive(),
}).strict();

const checkoutPaymentOptionSchema = z.object({
  fee: requiredText("Payment fee", 80),
  id: identifierSchema,
  receiveIn: requiredText("Payment receive time", 120),
  salesIn: requiredText("Payment sales time", 120),
}).strict();

const checkoutBankTransferSchema = z.object({
  alias: requiredText("Alias", 160),
  bankName: requiredText("Bank name", 160),
  cbuCvu: z.string().regex(/^\d{22}$/),
  cuitCuil: z.string().regex(/^\d{2}-\d{8}-\d$/),
  holderName: nameSchema("Holder name"),
}).strict();

const checkoutPaymentMethodSchema = z.object({
  acceptedMethods: z.array(requiredText("Accepted method", 120)),
  bankConfig: checkoutBankTransferSchema.optional(),
  description: requiredText("Payment description", 500),
  id: z.enum(CHECKOUT_PAYMENT_METHOD_IDS),
  logoSrc: requiredText("Payment logo", 500),
  name: requiredText("Payment method name", 160),
  options: z.array(checkoutPaymentOptionSchema),
  selectedOptionId: identifierSchema.optional(),
}).strict();

const checkoutCouponResultSchema = z.object({
  code: couponCodeSchema.optional(),
  discountAmount: moneySchema,
  message: requiredText("Coupon message", 240).optional(),
  result: z.enum([
    CHECKOUT_COUPON_RESULT.APPLIED,
    CHECKOUT_COUPON_RESULT.NOT_PROVIDED,
    CHECKOUT_COUPON_RESULT.REJECTED,
  ]),
}).strict();

const checkoutWarningSchema = z.object({
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
  sessionToken: opaqueTokenSchema.optional(),
  shipping: moneySchema,
  shippingOptions: z.array(checkoutShippingOptionSchema),
  subtotal: moneySchema,
  total: moneySchema,
  warnings: z.array(checkoutWarningSchema),
  ok: z.literal(true),
}).strict();

const checkoutOrderProjectionSchema = z.object({
  currency: z.literal(CHECKOUT_CURRENCY),
  id: identifierSchema,
  number: identifierSchema,
  status: z.enum([
    CHECKOUT_ORDER_STATUS.CANCELLED,
    CHECKOUT_ORDER_STATUS.CONFIRMED,
    CHECKOUT_ORDER_STATUS.PENDING,
  ]),
  total: moneySchema,
}).strict();

export const checkoutCompleteResponseSchema = z.object({
  currency: z.literal(CHECKOUT_CURRENCY).optional(),
  number: identifierSchema,
  ok: z.literal(true),
  order: checkoutOrderProjectionSchema.optional(),
  orderId: identifierSchema,
  status: z.enum([
    CHECKOUT_ORDER_STATUS.CANCELLED,
    CHECKOUT_ORDER_STATUS.CONFIRMED,
    CHECKOUT_ORDER_STATUS.PENDING,
  ]).optional(),
  total: moneySchema.optional(),
}).strict();

export type CheckoutQuoteRequestDto = z.output<typeof checkoutQuoteRequestSchema>;
export type CheckoutCompleteRequestDto = z.output<typeof checkoutCompleteRequestSchema>;
export type CheckoutQuoteResponseDto = z.output<typeof checkoutQuoteResponseSchema>;
export type CheckoutCompleteResponseDto = z.output<typeof checkoutCompleteResponseSchema>;

function validateDeliverySelection(
  input: {
    address?: CheckoutAddressInput;
    addressId?: string;
    pickupPointId?: string;
    shippingMethodId?: string;
    shippingProviderId?: string;
    deliveryType?: string;
  },
  context: z.RefinementCtx,
): void {
  if ((input.shippingMethodId || input.shippingProviderId) && input.pickupPointId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A checkout request cannot select shipping and pickup at the same time.",
      path: ["deliveryType"],
    });
  }

  if (input.deliveryType === CHECKOUT_DELIVERY_TYPE.SHIPPING && input.pickupPointId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Shipping delivery cannot include a pickup point.",
      path: ["pickupPointId"],
    });
  }

  if (input.deliveryType === CHECKOUT_DELIVERY_TYPE.PICKUP && (input.shippingMethodId || input.shippingProviderId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Pickup delivery cannot include a shipping method.",
      path: ["shippingMethodId"],
    });
  }

  if (input.addressId && input.address) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide an address ID or an inline address, not both.",
      path: ["address"],
    });
  }
}
