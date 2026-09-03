import type { CheckoutQuote } from "@/lib/api/checkout/checkout.repository";
import {
  isValidDni,
  isValidEmail,
  isValidNumericOnly,
  isValidPhone,
  isValidTextOnly,
} from "@/lib/checkout-validation";
import {
  type CheckoutPickupPoint,
  type CheckoutPostalCodeLocation,
  type CheckoutShippingProvider,
} from "@/lib/data/checkout";

export const CHECKOUT_FORM_DELIVERY_METHOD = {
  HOME: "home",
  PICKUP: "pickup",
} as const;

export type DeliveryMethod = (typeof CHECKOUT_FORM_DELIVERY_METHOD)[keyof typeof CHECKOUT_FORM_DELIVERY_METHOD] | null;

export type IdentificationForm = {
  email: string;
  firstName: string;
  lastName: string;
  dni: string;
  phone: string;
};

export type DeliveryForm = {
  postalCode: string;
  street: string;
  streetNumber: string;
  floor: string;
  city: string;
  neighborhood: string;
  recipient: string;
};

export type FieldErrors<T extends Record<string, string>> = Partial<Record<keyof T, string>>;

export function validateIdentification(form: IdentificationForm): FieldErrors<IdentificationForm> {
  const nextErrors: FieldErrors<IdentificationForm> = {};

  if (!form.email.trim()) {
    nextErrors.email = "Ingresá tu correo.";
  } else if (!isValidEmail(form.email)) {
    nextErrors.email = "Ingresá un correo válido.";
  }

  if (!form.firstName.trim()) {
    nextErrors.firstName = "Ingresá tus nombres.";
  } else if (!isValidTextOnly(form.firstName)) {
    nextErrors.firstName = "Usá solo letras.";
  }

  if (!form.lastName.trim()) {
    nextErrors.lastName = "Ingresá tu apellido.";
  } else if (!isValidTextOnly(form.lastName)) {
    nextErrors.lastName = "Usá solo letras.";
  }

  if (!form.dni.trim()) {
    nextErrors.dni = "Ingresá tu DNI.";
  } else if (!isValidDni(form.dni)) {
    nextErrors.dni = "El DNI debe tener entre 6 y 9 números.";
  }

  if (!form.phone.trim()) {
    nextErrors.phone = "Ingresá un teléfono de contacto.";
  } else if (!isValidPhone(form.phone)) {
    nextErrors.phone = "El teléfono debe tener entre 10 y 13 dígitos.";
  }

  return nextErrors;
}

export function validateDelivery(
  form: DeliveryForm,
  deliveryMethod: DeliveryMethod,
  detectedLocation: CheckoutPostalCodeLocation | undefined,
  selectedProvider: CheckoutShippingProvider | null,
  selectedPickupPoint: CheckoutPickupPoint | null,
): FieldErrors<DeliveryForm> {
  const nextErrors: FieldErrors<DeliveryForm> = {};

  if (!form.postalCode.trim()) {
    nextErrors.postalCode = "Ingresá tu código postal.";
  } else if (!detectedLocation) {
    nextErrors.postalCode = "Código postal sin datos mock disponibles.";
  }

  if (!deliveryMethod) {
    nextErrors.street = "Seleccioná una forma de entrega.";
  }

  if (!form.city.trim()) {
    nextErrors.city = "Seleccioná una ciudad.";
  }

  if (deliveryMethod === "home") {
    if (!selectedProvider) {
      nextErrors.postalCode = nextErrors.postalCode ?? "Seleccioná una opción de envío.";
    }

    if (!form.street.trim()) {
      nextErrors.street = "Ingresá la calle.";
    } else if (!isValidTextOnly(form.street)) {
      nextErrors.street = "Usá solo letras.";
    }

    if (!form.streetNumber.trim()) {
      nextErrors.streetNumber = "Ingresá el número.";
    } else if (!isValidNumericOnly(form.streetNumber)) {
      nextErrors.streetNumber = "Usá solo números.";
    }

    if (form.neighborhood && !isValidTextOnly(form.neighborhood)) {
      nextErrors.neighborhood = "Usá solo letras.";
    }

    if (form.recipient && !isValidTextOnly(form.recipient)) {
      nextErrors.recipient = "Usá solo letras.";
    }
  }

  if (deliveryMethod === "pickup" && !selectedPickupPoint) {
    nextErrors.postalCode = nextErrors.postalCode ?? "Seleccioná un punto de retiro.";
  }

  return nextErrors;
}

export function getCheckoutConfigurationIssue(
  quote: CheckoutQuote | null,
  deliveryMethod: DeliveryMethod,
  selectedProvider: CheckoutShippingProvider | null,
  selectedPickupPoint: CheckoutPickupPoint | null,
  selectedPaymentId: string,
): string | null {
  if (!quote) return null;

  const paymentMethod = quote.paymentMethods.find((method) => method.id === selectedPaymentId);
  if (!paymentMethod) return "El medio de pago seleccionado ya no está disponible.";
  const paymentOptionId = paymentMethod.selectedOptionId ?? paymentMethod.options[0]?.id;
  if (!paymentOptionId || !paymentMethod.options.some((option) => option.id === paymentOptionId)) return "El medio de pago seleccionado no tiene una opción configurada.";
  if (selectedPaymentId === "bank-transfer" && !paymentMethod.bankConfig) return "La configuración de transferencia bancaria no está disponible.";
  if (deliveryMethod === "home" && (!selectedProvider || !quote.shippingOptions.some((option) => option.providerId === selectedProvider.id))) {
    return selectedProvider ? "La opción de envío seleccionada ya no está disponible." : "Seleccioná una opción de envío.";
  }
  if (deliveryMethod === "pickup" && (!selectedPickupPoint || !quote.pickupPoints.some((point) => point.id === selectedPickupPoint.id))) {
    return selectedPickupPoint ? "El punto de retiro seleccionado ya no está disponible." : "Seleccioná un punto de retiro.";
  }

  return null;
}
