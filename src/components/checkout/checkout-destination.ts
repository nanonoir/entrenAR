import type { DeliveryForm, DeliveryMethod } from "@/components/checkout/checkout-form.validators";
import { getPostalCodeFormat, sanitizePostalCodeInput } from "@/lib/data/locations/postal-code";
import type { CheckoutQuoteOptions } from "@/stores/cart-checkout.types";

/**
 * The only destination fields that may trigger a quote. Street, number, floor, neighborhood and recipient are
 * deliberately absent: they never change shipping options or cost.
 */
export interface CheckoutDestination {
  city: string;
  deliveryMethod: DeliveryMethod;
  pickupPointId: string | null;
  postalCode: string;
  provinceId: string;
  shippingId: string | null;
  shippingProviderId: string | null;
}

export const EMPTY_CHECKOUT_DESTINATION: CheckoutDestination = {
  city: "",
  deliveryMethod: null,
  pickupPointId: null,
  postalCode: "",
  provinceId: "",
  shippingId: null,
  shippingProviderId: null,
};

export interface CheckoutDestinationSelection {
  deliveryMethod: DeliveryMethod;
  pickupPointId: string | null;
  shippingId: string | null;
  shippingProviderId: string | null;
}

/** Projects the live form onto the committed destination; an incomplete postal code is not a committed value. */
export function toCheckoutDestination(
  form: Pick<DeliveryForm, "city" | "postalCode" | "provinceId">,
  selection: CheckoutDestinationSelection,
): CheckoutDestination {
  const postalCode = sanitizePostalCodeInput(form.postalCode);
  return {
    city: form.city.trim(),
    deliveryMethod: selection.deliveryMethod,
    pickupPointId: selection.deliveryMethod === "pickup" ? selection.pickupPointId : null,
    postalCode: ["cp4", "cpa"].includes(getPostalCodeFormat(postalCode)) ? postalCode : "",
    provinceId: form.provinceId,
    shippingId: selection.deliveryMethod === "home" ? selection.shippingId : null,
    shippingProviderId: selection.deliveryMethod === "home" ? selection.shippingProviderId : null,
  };
}

export function withoutSelection(destination: CheckoutDestination): CheckoutDestination {
  return {
    ...destination,
    pickupPointId: EMPTY_CHECKOUT_DESTINATION.pickupPointId,
    shippingId: EMPTY_CHECKOUT_DESTINATION.shippingId,
    shippingProviderId: EMPTY_CHECKOUT_DESTINATION.shippingProviderId,
  };
}

/** Location + exact selection: identifies a selection the backend refused so it is not re-sent in a loop. */
export function selectionKey(destination: CheckoutDestination): string {
  return JSON.stringify([
    destination.deliveryMethod,
    destination.postalCode,
    destination.provinceId,
    destination.city,
    destination.shippingId,
    destination.pickupPointId,
  ]);
}

/** The selection intent is sent unless this exact location + selection was already refused by the backend. */
export function selectionAllowed(destination: CheckoutDestination, rejectedKey: string | null): CheckoutDestination {
  return rejectedKey !== null && rejectedKey === selectionKey(destination) ? withoutSelection(destination) : destination;
}

export function hasSelection(options: Pick<CheckoutQuoteOptions, "pickupPointId" | "shippingMethodId" | "shippingProviderId">): boolean {
  return Boolean(options.shippingMethodId || options.shippingProviderId || options.pickupPointId);
}

export function withSelectionRemoved<T extends Pick<CheckoutQuoteOptions, "pickupPointId" | "shippingMethodId" | "shippingProviderId">>(options: T): T {
  const rest = { ...options };
  delete rest.pickupPointId;
  delete rest.shippingMethodId;
  delete rest.shippingProviderId;
  return rest;
}

export function isSelectionRejectionCode(code: string | undefined): boolean {
  return code === "SHIPPING_OPTION_UNAVAILABLE";
}

/** Canonical projection used to dedupe quote requests. */
export function checkoutDestinationKey(destination: CheckoutDestination): string {
  return JSON.stringify([
    destination.deliveryMethod,
    destination.postalCode,
    destination.provinceId,
    destination.city,
    destination.shippingId,
    destination.pickupPointId,
  ]);
}
