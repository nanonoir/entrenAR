import type { CheckoutDestination } from "@/components/checkout/checkout-destination";
import {
  CHECKOUT_COUPON_RESULT,
  CHECKOUT_DELIVERY_TYPE,
  type CheckoutLineItemInput,
  type CheckoutQuote,
} from "@/lib/api/checkout/checkout.repository";
import { findProvinceById } from "@/lib/data/locations/provinces";
import type { CheckoutPaymentMethodId } from "@/lib/data/checkout";
import type { CheckoutCompletionOptions, CheckoutQuoteOptions } from "@/stores/cart-checkout.types";
import type { CartPreviewItem } from "@/types/cart";
import type {
  DeliveryForm,
  IdentificationForm,
} from "@/components/checkout/checkout-form.validators";

export interface CheckoutCompletionBuilderInput {
  currentQuote: CheckoutQuote;
  deliveryForm: DeliveryForm;
  destination: CheckoutDestination;
  identificationForm: IdentificationForm;
  paymentMethodId: CheckoutPaymentMethodId;
  paymentOptionId: string;
  sessionToken: string | null;
}

/** Quote request built from committed destination fields only; the exact service id travels with its provider. */
export function buildQuoteOptions(
  items: readonly CartPreviewItem[],
  destination: CheckoutDestination,
  couponCode?: string,
): CheckoutQuoteOptions {
  const province = findProvinceById(destination.provinceId)?.name;

  return {
    city: destination.city || undefined,
    deliveryType: destination.deliveryMethod === "home"
      ? CHECKOUT_DELIVERY_TYPE.SHIPPING
      : destination.deliveryMethod === "pickup"
        ? CHECKOUT_DELIVERY_TYPE.PICKUP
        : undefined,
    items: items.map(toCheckoutLineItem),
    pickupPointId: destination.deliveryMethod === "pickup" ? destination.pickupPointId ?? undefined : undefined,
    postalCode: destination.postalCode || undefined,
    province,
    // Until the provider-card UI is replaced, its adapter uses the provider id for both fields.
    // Keep that legacy selection provider-only; never mislabel it as a quoted service id.
    shippingMethodId: destination.deliveryMethod === "home" && destination.shippingId !== destination.shippingProviderId
      ? destination.shippingId ?? undefined
      : undefined,
    shippingProviderId: destination.deliveryMethod === "home" ? destination.shippingProviderId ?? undefined : undefined,
    // Always last: `withAppliedCoupon` relies on this position to keep request fingerprints stable.
    ...(couponCode ? { couponCode } : {}),
  };
}

/** The coupon code the server confirmed as applied; a rejected or absent coupon is never carried forward. */
export function getAppliedCouponCode(quote: CheckoutQuote | null): string | undefined {
  return quote?.coupon?.result === CHECKOUT_COUPON_RESULT.APPLIED ? quote.coupon.code || undefined : undefined;
}

/** Re-expresses a sent request as the settled one: server items and the server-confirmed coupon. */
export function toSettledQuoteOptions(options: CheckoutQuoteOptions, quote: CheckoutQuote): CheckoutQuoteOptions {
  const settled: CheckoutQuoteOptions = { ...options, items: toCheckoutLineItemsFromQuote(quote) };
  delete settled.couponCode;
  const couponCode = getAppliedCouponCode(quote);
  return couponCode ? { ...settled, couponCode } : settled;
}

export function buildCompletionInput(input: CheckoutCompletionBuilderInput): CheckoutCompletionOptions {
  const { deliveryForm, destination } = input;
  const province = findProvinceById(destination.provinceId)?.name ?? "";

  return {
    ...buildQuoteOptions([], destination, getAppliedCouponCode(input.currentQuote)),
    address: destination.deliveryMethod === "home"
      ? {
        city: deliveryForm.city.trim(),
        floor: deliveryForm.floor.trim() || undefined,
        neighborhood: deliveryForm.neighborhood.trim() || undefined,
        number: deliveryForm.streetNumber.trim(),
        postalCode: destination.postalCode,
        province,
        recipient: deliveryForm.recipient.trim() || undefined,
        street: deliveryForm.street.trim(),
      }
      : undefined,
    customer: {
      dni: input.identificationForm.dni.trim(),
      email: input.identificationForm.email.trim(),
      firstName: input.identificationForm.firstName.trim(),
      lastName: input.identificationForm.lastName.trim(),
      phone: input.identificationForm.phone.trim(),
    },
    paymentMethodId: input.paymentMethodId,
    paymentOptionId: input.paymentOptionId,
    quoteId: input.currentQuote.quoteId,
    sessionToken: input.currentQuote.sessionToken ?? input.sessionToken,
    items: toCheckoutLineItemsFromQuote(input.currentQuote),
  };
}

export function toCheckoutLineItem(item: CartPreviewItem): CheckoutLineItemInput {
  return {
    productId: item.productId,
    quantity: item.quantity,
    ...(item.variantId.trim() ? { variantId: item.variantId } : {}),
  };
}

export function toCheckoutLineItemsFromQuote(quote: CheckoutQuote): CheckoutLineItemInput[] {
  return quote.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    ...(item.variantId ? { variantId: item.variantId } : {}),
  }));
}
