import { z } from "zod";

import { isSupportedShippingMethodId, normalizeShippingMethodId } from "../../commerce/commerce.constants";
import {
  CHECKOUT_DELIVERY_TYPE,
  CHECKOUT_IDEMPOTENCY_KEY_MAX_LENGTH,
  CHECKOUT_IDEMPOTENCY_KEY_MIN_LENGTH,
  CHECKOUT_MAX_ITEMS,
} from "../checkout.constants";
import {
  checkoutAddressSchema,
  checkoutCustomerSchema,
  couponCodeSchema,
  identifierSchema,
  opaqueTokenSchema,
  paymentMethodIdSchema,
  postalCodeSchema,
  quantitySchema,
  requiredText,
} from "./checkout-common.schemas";

const deliveryTypeValues = Object.values(CHECKOUT_DELIVERY_TYPE) as [
  (typeof CHECKOUT_DELIVERY_TYPE)[keyof typeof CHECKOUT_DELIVERY_TYPE],
  ...(typeof CHECKOUT_DELIVERY_TYPE)[keyof typeof CHECKOUT_DELIVERY_TYPE][],
];

const shippingMethodIdSchema = identifierSchema
  .transform(normalizeShippingMethodId)
  .refine(isSupportedShippingMethodId, { error: "Shipping method is not supported." });

export const checkoutLineItemSchema = z.object({
  productId: identifierSchema,
  quantity: quantitySchema,
  variantId: identifierSchema.optional(),
}).strict();

export const checkoutItemsSchema = z.array(checkoutLineItemSchema)
  .min(1, { error: "At least one checkout item is required." })
  .max(CHECKOUT_MAX_ITEMS, { error: "Too many checkout items." })
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

const deliveryTypeSchema = z.enum(deliveryTypeValues);
const checkoutSelectionShape = {
  address: checkoutAddressSchema.optional(),
  addressId: identifierSchema.optional(),
  city: requiredText("City", 120).optional(),
  couponCode: couponCodeSchema.optional(),
  deliveryType: deliveryTypeSchema.optional(),
  items: checkoutItemsSchema,
  pickupPointId: identifierSchema.optional(),
  postalCode: postalCodeSchema.optional(),
  province: requiredText("Province", 120).optional(),
  sessionToken: opaqueTokenSchema.optional(),
  shippingMethodId: shippingMethodIdSchema.optional(),
  shippingProviderId: identifierSchema.optional(),
};

export const checkoutQuoteRequestSchema = z.object(checkoutSelectionShape).strict().superRefine(validateDeliverySelection);

export const checkoutCompleteRequestSchema = z.object({
  ...checkoutSelectionShape,
  customer: checkoutCustomerSchema,
  idempotencyKey: z.string({ error: "Idempotency key must be a string." })
    .trim()
    .min(CHECKOUT_IDEMPOTENCY_KEY_MIN_LENGTH, { error: "Idempotency key is too short." })
    .max(CHECKOUT_IDEMPOTENCY_KEY_MAX_LENGTH, { error: "Idempotency key is too long." })
    .regex(/^[A-Za-z0-9._:-]+$/, { error: "Idempotency key contains invalid characters." }),
  paymentMethodId: paymentMethodIdSchema,
  paymentOptionId: identifierSchema.optional(),
  quoteId: opaqueTokenSchema.optional(),
}).strict().superRefine(validateDeliverySelection);

export type CheckoutCompleteRequest = z.output<typeof checkoutCompleteRequestSchema>;
export type CheckoutLineItem = z.output<typeof checkoutLineItemSchema>;
export type CheckoutQuoteRequest = z.output<typeof checkoutQuoteRequestSchema>;
export type QuoteRequest = CheckoutQuoteRequest;
export type CompleteRequest = CheckoutCompleteRequest;

export const quoteRequestSchema = checkoutQuoteRequestSchema;
export const completeRequestSchema = checkoutCompleteRequestSchema;
export const checkoutQuoteSchema = checkoutQuoteRequestSchema;
export const checkoutCompleteSchema = checkoutCompleteRequestSchema;

interface CheckoutSelectionInput {
  address?: z.output<typeof checkoutAddressSchema>;
  addressId?: string;
  couponCode?: string;
  deliveryType?: z.output<typeof deliveryTypeSchema>;
  items: z.output<typeof checkoutItemsSchema>;
  pickupPointId?: string;
  postalCode?: string;
  province?: string;
  sessionToken?: string;
  shippingMethodId?: string;
  shippingProviderId?: string;
}

function validateDeliverySelection(
  input: CheckoutSelectionInput,
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
