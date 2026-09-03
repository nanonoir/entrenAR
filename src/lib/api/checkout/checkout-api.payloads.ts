import { z } from "zod";

import { CheckoutApiError } from "@/lib/api/checkout/client";
import type {
  CheckoutAddressInput,
  CheckoutCompleteInput,
  CheckoutCustomerInput,
  CheckoutLineItemInput,
  CheckoutQuoteInput,
} from "@/lib/api/checkout/checkout.repository";
import {
  checkoutCompleteRequestSchema,
  checkoutQuoteRequestSchema,
  type CheckoutCompleteRequestDto,
  type CheckoutQuoteRequestDto,
} from "@/lib/api/checkout/checkout-api.schemas";

export function toCheckoutQuotePayload(input: CheckoutQuoteInput): CheckoutQuoteRequestDto {
  const parsed = checkoutQuoteRequestSchema.safeParse(buildSelectionPayload(input));
  if (!parsed.success) throw validationError(parsed.error);
  return parsed.data;
}

export function toCheckoutCompletePayload(input: CheckoutCompleteInput): CheckoutCompleteRequestDto {
  const parsed = checkoutCompleteRequestSchema.safeParse({
    ...buildSelectionPayload(input),
    customer: toCustomerPayload(input.customer),
    idempotencyKey: input.idempotencyKey.trim(),
    paymentMethodId: input.paymentMethodId,
    ...(input.paymentOptionId === undefined ? {} : { paymentOptionId: input.paymentOptionId.trim() }),
    ...(input.quoteId === undefined ? {} : { quoteId: input.quoteId.trim() }),
  });
  if (!parsed.success) throw validationError(parsed.error);
  return parsed.data;
}

function buildSelectionPayload(input: CheckoutQuoteInput): Record<string, unknown> {
  return {
    items: reconcileCheckoutCartItems(input.items),
    ...(input.address ? { address: toAddressPayload(input.address) } : {}),
    ...(input.addressId === undefined ? {} : { addressId: input.addressId.trim() }),
    ...(input.city === undefined ? {} : { city: input.city.trim() }),
    ...(input.couponCode === undefined ? {} : { couponCode: input.couponCode.trim() }),
    ...(input.deliveryType === undefined ? {} : { deliveryType: input.deliveryType }),
    ...(input.pickupPointId === undefined ? {} : { pickupPointId: input.pickupPointId.trim() }),
    ...(input.postalCode === undefined ? {} : { postalCode: input.postalCode.trim() }),
    ...(input.province === undefined ? {} : { province: input.province.trim() }),
    ...(input.sessionToken === undefined ? {} : { sessionToken: input.sessionToken.trim() }),
    ...(input.shippingMethodId === undefined ? {} : { shippingMethodId: input.shippingMethodId.trim() }),
    ...(input.shippingProviderId === undefined ? {} : { shippingProviderId: input.shippingProviderId.trim() }),
  };
}

function toAddressPayload(input: CheckoutAddressInput): CheckoutAddressInput {
  return {
    city: input.city.trim(),
    postalCode: input.postalCode.trim(),
    province: input.province.trim(),
    street: input.street.trim(),
    ...(input.label === undefined ? {} : { label: input.label.trim() }),
    ...(input.number === undefined ? {} : { number: input.number.trim() }),
    ...(input.phone === undefined ? {} : { phone: input.phone.trim() }),
    ...(input.recipient === undefined ? {} : { recipient: input.recipient.trim() }),
  };
}

function toCustomerPayload(input: CheckoutCustomerInput): CheckoutCustomerInput {
  return {
    email: input.email.trim().toLocaleLowerCase(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    ...(input.dni === undefined ? {} : { dni: input.dni.trim() }),
    ...(input.phone === undefined ? {} : { phone: input.phone.trim() }),
  };
}

function validationError(error: z.ZodError): CheckoutApiError {
  return new CheckoutApiError({
    code: "VALIDATION_ERROR",
    issues: error.issues.map((issue) => ({
      code: issue.code,
      field: issue.path.length > 0 ? issue.path.map(String).join(".") : "request",
      message: issue.message,
    })),
    message: "The checkout request is invalid.",
    status: 400,
  });
}

function reconcileCheckoutCartItems(
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
