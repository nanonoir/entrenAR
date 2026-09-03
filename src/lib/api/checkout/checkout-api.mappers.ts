import { z } from "zod";

import { CheckoutApiError } from "@/lib/api/checkout/client";
import type {
  CheckoutCompletion,
  CheckoutCouponResult,
  CheckoutPaymentMethod,
  CheckoutPaymentOption,
  CheckoutPickupPoint,
  CheckoutQuote,
  CheckoutQuoteItem,
  CheckoutShippingOption,
  CheckoutWarning,
} from "@/lib/api/checkout/checkout.repository";
import {
  checkoutCompleteResponseSchema,
  checkoutQuoteResponseSchema,
  type CheckoutQuoteResponseDto,
} from "@/lib/api/checkout/checkout-api.schemas";

export function mapQuoteResponse(response: unknown): CheckoutQuote {
  const parsed = parseResponse(response, checkoutQuoteResponseSchema);

  return {
    currency: parsed.currency,
    discount: parsed.discount,
    items: parsed.items.map(mapQuoteItem),
    paymentMethods: parsed.paymentMethods.map(mapPaymentMethod),
    pickupPoints: parsed.pickupPoints.map(mapPickupPoint),
    quoteId: parsed.quoteId,
    shipping: parsed.shipping,
    shippingOptions: parsed.shippingOptions.map(mapShippingOption),
    subtotal: parsed.subtotal,
    total: parsed.total,
    warnings: parsed.warnings.map(mapWarning),
    ok: true,
    ...(parsed.coupon === undefined ? {} : { coupon: mapCoupon(parsed.coupon) }),
    ...(parsed.expiresAt === undefined ? {} : { expiresAt: parsed.expiresAt }),
    ...(parsed.sessionToken === undefined ? {} : { sessionToken: parsed.sessionToken }),
  };
}

function mapQuoteItem(item: CheckoutQuoteResponseDto["items"][number]): CheckoutQuoteItem {
  return {
    lineSubtotal: item.lineSubtotal,
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    sku: item.sku,
    unitPrice: item.unitPrice,
    ...(item.availableQuantity === undefined ? {} : { availableQuantity: item.availableQuantity }),
    ...(item.compareAtPrice === undefined ? {} : { compareAtPrice: item.compareAtPrice }),
    ...(item.variantId === undefined ? {} : { variantId: item.variantId }),
    ...(item.variantName === undefined ? {} : { variantName: item.variantName }),
    ...(item.weightGrams === undefined ? {} : { weightGrams: item.weightGrams }),
  };
}

function mapPaymentMethod(method: CheckoutQuoteResponseDto["paymentMethods"][number]): CheckoutPaymentMethod {
  return {
    acceptedMethods: [...method.acceptedMethods],
    description: method.description,
    id: method.id,
    logoSrc: method.logoSrc,
    name: method.name,
    options: method.options.map(mapPaymentOption),
    ...(method.bankConfig ? { bankConfig: { ...method.bankConfig } } : {}),
    ...(method.selectedOptionId === undefined ? {} : { selectedOptionId: method.selectedOptionId }),
  };
}

function mapPaymentOption(option: CheckoutPaymentOption): CheckoutPaymentOption {
  return {
    fee: option.fee,
    id: option.id,
    receiveIn: option.receiveIn,
    salesIn: option.salesIn,
  };
}

function mapPickupPoint(point: CheckoutQuoteResponseDto["pickupPoints"][number]): CheckoutPickupPoint {
  return {
    address: { ...point.address },
    id: point.id,
    name: point.name,
    preparationHours: point.preparationHours,
  };
}

function mapShippingOption(option: CheckoutQuoteResponseDto["shippingOptions"][number]): CheckoutShippingOption {
  return {
    cost: option.cost,
    id: option.id,
    label: option.label,
    modality: option.modality,
    providerId: option.providerId,
    providerName: option.providerName,
    ...(option.estimatedDelivery === undefined ? {} : { estimatedDelivery: option.estimatedDelivery }),
  };
}

function mapWarning(warning: CheckoutQuoteResponseDto["warnings"][number]): CheckoutWarning {
  return { code: warning.code, message: warning.message };
}

function mapCoupon(coupon: CheckoutQuoteResponseDto["coupon"]): CheckoutCouponResult | null | undefined {
  if (coupon === null || coupon === undefined) return coupon;

  return {
    discountAmount: coupon.discountAmount,
    result: coupon.result,
    ...(coupon.code === undefined ? {} : { code: coupon.code }),
    ...(coupon.message === undefined ? {} : { message: coupon.message }),
  };
}

export function mapCompleteResponse(response: unknown): CheckoutCompletion {
  const parsed = parseResponse(response, checkoutCompleteResponseSchema);

  return {
    number: parsed.number,
    ok: true,
    orderId: parsed.orderId,
    ...(parsed.currency === undefined ? {} : { currency: parsed.currency }),
    ...(parsed.order === undefined ? {} : {
      order: {
        currency: parsed.order.currency,
        id: parsed.order.id,
        number: parsed.order.number,
        status: parsed.order.status,
        total: parsed.order.total,
      },
    }),
    ...(parsed.status === undefined ? {} : { status: parsed.status }),
    ...(parsed.total === undefined ? {} : { total: parsed.total }),
  };
}

function parseResponse<T>(value: unknown, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(unwrapResponse(value));
  if (!parsed.success) throw invalidResponse(parsed.error);
  return parsed.data;
}

function unwrapResponse(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (value.ok === true && "data" in value) return value.data;
  return value;
}

function invalidResponse(error?: z.ZodError): CheckoutApiError {
  return new CheckoutApiError({
    code: "CHECKOUT_API_INVALID_RESPONSE",
    issues: error?.issues.map((issue) => ({
      code: "INVALID_RESPONSE",
      field: issue.path.length > 0 ? issue.path.map(String).join(".") : "response",
      message: "The checkout API returned an invalid response field.",
    })),
    message: "The checkout API returned an invalid response.",
    status: 502,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
