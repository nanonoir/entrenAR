import { CheckoutApiError } from "@/lib/api/checkout/client";
import type {
  CheckoutCompleteInput,
  CheckoutCompletion,
  CheckoutLineItemInput,
  CheckoutQuote,
  CheckoutQuoteInput,
  CheckoutQuoteItem,
} from "@/lib/api/checkout/checkout.repository";

import type { MockResolvedLine } from "./mock-checkout.rules";

export function toQuoteItem(line: CheckoutQuoteItem & MockResolvedLine): CheckoutQuoteItem {
  return {
    availableQuantity: line.availableQuantity,
    lineSubtotal: line.lineSubtotal,
    productId: line.productId,
    productName: line.productName,
    quantity: line.quantity,
    sku: line.sku,
    unitPrice: line.unitPrice,
    ...(line.compareAtPrice === undefined ? {} : { compareAtPrice: line.compareAtPrice }),
    ...(line.variantId === undefined ? {} : { variantId: line.variantId }),
    ...(line.variantName === undefined ? {} : { variantName: line.variantName }),
    ...(line.weightGrams === undefined ? {} : { weightGrams: line.weightGrams }),
  };
}

export function cloneQuote(quote: CheckoutQuote): CheckoutQuote {
  return {
    ...quote,
    items: quote.items.map((item) => ({ ...item })),
    paymentMethods: quote.paymentMethods.map((method) => ({
      ...method,
      acceptedMethods: [...method.acceptedMethods],
      options: method.options.map((option) => ({ ...option })),
      ...(method.bankConfig ? { bankConfig: { ...method.bankConfig } } : {}),
    })),
    pickupPoints: quote.pickupPoints.map((point) => ({ ...point, address: { ...point.address } })),
    shippingOptions: quote.shippingOptions.map((option) => ({ ...option })),
    warnings: quote.warnings.map((warning) => ({ ...warning })),
    ...(quote.coupon ? { coupon: { ...quote.coupon } } : {}),
  };
}

export function cloneCompletion(completion: CheckoutCompletion): CheckoutCompletion {
  return {
    ...completion,
    ...(completion.order ? { order: { ...completion.order } } : {}),
  };
}

export function assertMockPaymentSelection(input: CheckoutCompleteInput, quote: CheckoutQuote): void {
  const method = quote.paymentMethods.find((candidate) => candidate.id === input.paymentMethodId);
  if (!method) throw paymentMethodUnavailable();
  const optionId = input.paymentOptionId ?? method.selectedOptionId;
  if (!optionId || !method.options.some((option) => option.id === optionId)) throw paymentMethodUnavailable();
}

export function assertCompleteInput(input: CheckoutCompleteInput): void {
  if (!input.idempotencyKey.trim() || input.idempotencyKey.trim().length < 8) {
    throw validationError("idempotencyKey", "Idempotency key is too short.");
  }
  if (!input.customer.email.trim() || !input.customer.firstName.trim() || !input.customer.lastName.trim()) {
    throw validationError("customer", "Customer details are required.");
  }
}

export function assertQuoteInput(input: CheckoutQuoteInput): void {
  if (input.items.length === 0 || input.items.length > 100) {
    throw validationError("items", "Checkout must contain between one and one hundred items.");
  }

  for (const [index, item] of input.items.entries()) {
    if (!item.productId.trim()) throw validationError(`items.${index}.productId`, "Product identifier is required.");
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1_000) {
      throw validationError(`items.${index}.quantity`, "Quantity must be a positive integer no greater than 1000.");
    }
    if (item.variantId !== undefined && !item.variantId.trim()) {
      throw validationError(`items.${index}.variantId`, "Variant identifier is required when provided.");
    }
  }

  if ((input.shippingMethodId || input.shippingProviderId) && input.pickupPointId) {
    throw validationError("deliveryType", "Shipping and pickup cannot be selected together.");
  }
  if (input.deliveryType === "shipping" && input.pickupPointId) {
    throw validationError("pickupPointId", "Shipping delivery cannot include a pickup point.");
  }
  if (input.deliveryType === "pickup" && (input.shippingMethodId || input.shippingProviderId)) {
    throw validationError("shippingMethodId", "Pickup delivery cannot include a shipping method.");
  }
  if (input.address && input.addressId) {
    throw validationError("address", "Provide an address ID or an inline address, not both.");
  }
}

export function quoteFingerprint(quote: CheckoutQuote): string {
  return stableSerialize({
    discount: quote.discount,
    items: quote.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      variantId: item.variantId ?? null,
    })),
    shipping: quote.shipping,
    subtotal: quote.subtotal,
    total: quote.total,
  });
}

export function toCompletionFingerprint(input: CheckoutCompleteInput): Record<string, unknown> {
  return {
    address: input.address,
    addressId: input.addressId,
    city: input.city,
    couponCode: input.couponCode?.trim().toLocaleUpperCase(),
    customer: input.customer,
    deliveryType: input.deliveryType,
    items: reconcileCheckoutCartItems(input.items),
    paymentMethodId: input.paymentMethodId,
    paymentOptionId: input.paymentOptionId,
    pickupPointId: input.pickupPointId,
    postalCode: input.postalCode,
    province: input.province,
    quoteId: input.quoteId,
    sessionToken: input.sessionToken,
    shippingMethodId: input.shippingMethodId,
    shippingProviderId: input.shippingProviderId,
  };
}

export function stableSerialize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`).join(",")}}`;
  }
  return JSON.stringify(String(value));
}

export function reconcileCheckoutCartItems(
  items: readonly CheckoutLineItemInput[],
): CheckoutLineItemInput[] {
  const reconciled = new Map<string, CheckoutLineItemInput>();

  for (const item of items) {
    const variantId = item.variantId?.trim() || undefined;
    const key = `${item.productId.trim()}:${variantId ?? ""}`;
    const current = reconciled.get(key);

    if (current) {
      current.quantity += item.quantity;
      continue;
    }

    reconciled.set(key, {
      productId: item.productId.trim(),
      quantity: item.quantity,
      ...(variantId ? { variantId } : {}),
    });
  }

  return [...reconciled.values()];
}

function validationError(field: string, message: string): CheckoutApiError {
  return new CheckoutApiError({
    code: "VALIDATION_ERROR",
    issues: [{ code: "INVALID_FIELD", field, message }],
    message: "The checkout request is invalid.",
    status: 400,
  });
}

export function productNotFound(): CheckoutApiError {
  return new CheckoutApiError({ code: "PRODUCT_NOT_FOUND", message: "The requested checkout product was not found.", status: 404 });
}

export function variantNotFound(): CheckoutApiError {
  return new CheckoutApiError({ code: "VARIANT_NOT_FOUND", message: "The requested product variant was not found.", status: 404 });
}

export function outOfStock(): CheckoutApiError {
  return new CheckoutApiError({ code: "OUT_OF_STOCK", message: "Insufficient stock for the requested checkout items.", status: 409 });
}

export function shippingUnavailable(): CheckoutApiError {
  return new CheckoutApiError({ code: "SHIPPING_OPTION_UNAVAILABLE", message: "The selected shipping option is unavailable.", status: 409 });
}

function paymentMethodUnavailable(): CheckoutApiError {
  return new CheckoutApiError({ code: "PAYMENT_METHOD_UNAVAILABLE", message: "The selected payment method is unavailable.", status: 409 });
}

export function couponNotValid(): CheckoutApiError {
  return new CheckoutApiError({ code: "COUPON_NOT_VALID", message: "The coupon is not valid for this checkout.", status: 409 });
}

export function priceChanged(): CheckoutApiError {
  return new CheckoutApiError({ code: "PRICE_CHANGED", message: "The checkout quote changed before completion.", status: 409 });
}

export function invalidSession(): CheckoutApiError {
  return new CheckoutApiError({ code: "CHECKOUT_SESSION_INVALID", message: "The checkout session is invalid or expired.", status: 401 });
}

export function idempotencyKeyReused(): CheckoutApiError {
  return new CheckoutApiError({ code: "IDEMPOTENCY_KEY_REUSED", message: "The idempotency key was already used for another request.", status: 409 });
}
