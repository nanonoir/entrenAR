import {
  CHECKOUT_DELIVERY_TYPE,
  type CheckoutLineItemInput,
  type CheckoutQuote,
} from "@/lib/api/checkout/checkout.repository";
import {
  type CheckoutPaymentMethodId,
  type CheckoutPickupPoint,
  type CheckoutShippingProvider,
} from "@/lib/data/checkout";
import type { CheckoutCompletionOptions, CheckoutQuoteOptions } from "@/stores/cart-checkout.types";
import type { CartPreviewItem } from "@/types/cart";
import type {
  DeliveryForm,
  DeliveryMethod,
  IdentificationForm,
} from "@/components/checkout/checkout-form.validators";

export interface CheckoutCompletionBuilderInput {
  currentQuote: CheckoutQuote;
  deliveryForm: DeliveryForm;
  deliveryMethod: DeliveryMethod;
  identificationForm: IdentificationForm;
  paymentMethodId: CheckoutPaymentMethodId;
  paymentOptionId: string;
  selectedPickupPoint: CheckoutPickupPoint | null;
  selectedProvider: CheckoutShippingProvider | null;
  sessionToken: string | null;
  province?: string;
}

export function buildQuoteOptions(
  items: readonly CartPreviewItem[],
  deliveryForm: DeliveryForm,
  deliveryMethod: DeliveryMethod,
  selectedProvider: CheckoutShippingProvider | null,
  selectedPickupPoint: CheckoutPickupPoint | null,
  province?: string,
  includeAddress = false,
): CheckoutQuoteOptions {
  return {
    address: includeAddress && deliveryMethod === "home"
      ? {
        city: deliveryForm.city.trim(),
        number: deliveryForm.streetNumber.trim(),
        postalCode: deliveryForm.postalCode.trim(),
        province: province?.trim() ?? "",
        recipient: deliveryForm.recipient.trim() || undefined,
        street: deliveryForm.street.trim(),
      }
      : undefined,
    city: deliveryForm.city.trim() || undefined,
    deliveryType: deliveryMethod === "home"
      ? CHECKOUT_DELIVERY_TYPE.SHIPPING
      : deliveryMethod === "pickup"
        ? CHECKOUT_DELIVERY_TYPE.PICKUP
        : undefined,
    items: items.map(toCheckoutLineItem),
    pickupPointId: deliveryMethod === "pickup" ? selectedPickupPoint?.id : undefined,
    postalCode: deliveryForm.postalCode.trim() || undefined,
    province: province?.trim() || undefined,
    shippingProviderId: deliveryMethod === "home" ? selectedProvider?.id : undefined,
  };
}

export function buildCompletionInput(input: CheckoutCompletionBuilderInput): CheckoutCompletionOptions {
  return {
    ...buildQuoteOptions(
      [],
      input.deliveryForm,
      input.deliveryMethod,
      input.selectedProvider,
      input.selectedPickupPoint,
      input.province,
      true,
    ),
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
