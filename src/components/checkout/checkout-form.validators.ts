import {
  BANK_TRANSFER_UNAVAILABLE_MESSAGE,
  isUsableBankTransferConfig,
} from "@/components/checkout/bank-transfer-config";
import type { CheckoutQuote } from "@/lib/api/checkout/checkout.repository";
import {
  isValidDni,
  isValidEmail,
  isValidFloor,
  isValidNeighborhood,
  isValidNumericOnly,
  isValidPhone,
  isValidStreetName,
  isValidTextOnly,
} from "@/lib/checkout-validation";
import { getPostalCodeFormat, getPostalProvinceConflict } from "@/lib/data/locations/postal-code";
import type {
  CheckoutPickupPoint,
  CheckoutPostalCodeLocation,
  CheckoutShippingProvider,
} from "@/lib/data/checkout";

export const CHECKOUT_FORM_DELIVERY_METHOD = {
  HOME: "home",
  PICKUP: "pickup",
} as const;

export const CHECKOUT_HOME_DELIVERY_MODALITY = "home_delivery";
export const CHECKOUT_LOCALITY_MODE = {
  MANUAL: "manual",
  OFFICIAL: "",
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
  provinceId?: string;
  localityId?: string;
  /** Locality name: from the official Georef list, or typed manually when `localityMode` is "manual". */
  city: string;
  localityMode?: "" | "manual";
  street: string;
  streetNumber: string;
  floor: string;
  neighborhood: string;
  recipient: string;
};

export type FieldErrors<T extends Record<string, string>> = Partial<Record<keyof T, string>>;
export type DeliveryErrors = FieldErrors<DeliveryForm> & Partial<Record<"deliveryMethod" | "pickupPoint" | "shipping", string>>;
export type DeliveryErrorKey = keyof DeliveryErrors;

export type DeliverySelection = {
  deliveryMethod: DeliveryMethod;
  selectedPickupPointId: string | null;
  /** Exact `CheckoutShippingOption.id`, never a provider id. */
  selectedShippingId: string | null;
};

export const IDENTIFICATION_FIELDS: readonly (keyof IdentificationForm)[] = ["email", "firstName", "lastName", "dni", "phone"];

export function validateIdentificationField(field: keyof IdentificationForm, form: IdentificationForm): string | undefined {
  const value = form[field];
  switch (field) {
    case "email":
      if (!value.trim()) return "Ingresá tu correo.";
      return isValidEmail(value) ? undefined : "Ingresá un correo válido.";
    case "firstName":
      if (!value.trim()) return "Ingresá tus nombres.";
      return isValidTextOnly(value) ? undefined : "Usá solo letras.";
    case "lastName":
      if (!value.trim()) return "Ingresá tu apellido.";
      return isValidTextOnly(value) ? undefined : "Usá solo letras.";
    case "dni":
      if (!value.trim()) return "Ingresá tu DNI.";
      return isValidDni(value) ? undefined : "El DNI debe tener entre 6 y 9 números.";
    case "phone":
      if (!value.trim()) return "Ingresá un teléfono de contacto.";
      return isValidPhone(value) ? undefined : "El teléfono debe tener entre 10 y 13 dígitos.";
  }
}

export function validateIdentification(form: IdentificationForm): FieldErrors<IdentificationForm> {
  const nextErrors: FieldErrors<IdentificationForm> = {};
  for (const field of IDENTIFICATION_FIELDS) {
    const error = validateIdentificationField(field, form);
    if (error) nextErrors[field] = error;
  }
  return nextErrors;
}

/** Field-scoped rule shared by blur, section Continue and final validation. */
export function validateDeliveryField(field: keyof DeliveryForm, form: DeliveryForm, deliveryMethod: DeliveryMethod): string | undefined {
  switch (field) {
    case "postalCode": {
      const format = getPostalCodeFormat(form.postalCode);
      if (format === "empty") return "Ingresá tu código postal.";
      if (format === "invalid") return "Ingresá un código postal de 4 dígitos o un CPA de 8 caracteres (por ejemplo C1406ABC).";
      return getPostalProvinceConflict(form.postalCode, form.provinceId ?? "") ?? undefined;
    }
    case "provinceId":
      return form.provinceId ? undefined : "Seleccioná una provincia.";
    case "city":
      if (form.city.trim()) return undefined;
      return form.localityMode === CHECKOUT_LOCALITY_MODE.MANUAL ? "Ingresá tu localidad." : "Seleccioná tu localidad.";
    case "street":
      if (deliveryMethod !== CHECKOUT_FORM_DELIVERY_METHOD.HOME) return undefined;
      if (!form.street.trim()) return "Ingresá la calle.";
      return isValidStreetName(form.street) ? undefined : "Ingresá un nombre de calle válido (hasta 200 caracteres, con al menos una letra).";
    case "floor":
      if (deliveryMethod !== CHECKOUT_FORM_DELIVERY_METHOD.HOME) return undefined;
      return isValidFloor(form.floor) ? undefined : "Usá hasta 80 caracteres: letras, números y . , / # - °.";
    case "streetNumber":
      if (deliveryMethod !== CHECKOUT_FORM_DELIVERY_METHOD.HOME) return undefined;
      if (!form.streetNumber.trim()) return "Ingresá el número.";
      return isValidNumericOnly(form.streetNumber) ? undefined : "Usá solo números.";
    case "neighborhood":
      if (deliveryMethod !== CHECKOUT_FORM_DELIVERY_METHOD.HOME) return undefined;
      return isValidNeighborhood(form.neighborhood) ? undefined : "Usá hasta 120 caracteres: letras, números y . , / # - °.";
    case "recipient":
      if (deliveryMethod !== CHECKOUT_FORM_DELIVERY_METHOD.HOME) return undefined;
      return form[field] && !isValidTextOnly(form[field]) ? "Usá solo letras." : undefined;
    default:
      return undefined;
  }
}

export const DELIVERY_VALIDATED_FIELDS: readonly (keyof DeliveryForm)[] = [
  "postalCode",
  "provinceId",
  "city",
  "street",
  "streetNumber",
  "floor",
  "neighborhood",
  "recipient",
];

export function validateDelivery(form: DeliveryForm, selection: DeliverySelection): DeliveryErrors;
/** Backwards-compatible overload while the existing checkout wizard is migrated in the next unit. */
export function validateDelivery(
  form: DeliveryForm,
  deliveryMethod: DeliveryMethod,
  detectedLocation: CheckoutPostalCodeLocation | undefined,
  selectedProvider: CheckoutShippingProvider | null,
  selectedPickupPoint: CheckoutPickupPoint | null,
): FieldErrors<DeliveryForm>;
export function validateDelivery(
  form: DeliveryForm,
  selectionOrMethod: DeliverySelection | DeliveryMethod,
  detectedLocation?: CheckoutPostalCodeLocation,
  selectedProvider?: CheckoutShippingProvider | null,
  selectedPickupPoint?: CheckoutPickupPoint | null,
): DeliveryErrors {
  if (selectionOrMethod === null || typeof selectionOrMethod === "string") {
    return validateLegacyDelivery(form, selectionOrMethod, detectedLocation, selectedProvider ?? null, selectedPickupPoint ?? null);
  }
  const selection = selectionOrMethod;
  const nextErrors: DeliveryErrors = {};
  for (const field of DELIVERY_VALIDATED_FIELDS) {
    const error = validateDeliveryField(field, form, selection.deliveryMethod);
    if (error) nextErrors[field] = error;
  }

  if (!selection.deliveryMethod) {
    nextErrors.deliveryMethod = "Seleccioná una forma de entrega.";
  } else if (selection.deliveryMethod === CHECKOUT_FORM_DELIVERY_METHOD.HOME && !selection.selectedShippingId) {
    nextErrors.shipping = "Seleccioná una opción de envío.";
  } else if (selection.deliveryMethod === CHECKOUT_FORM_DELIVERY_METHOD.PICKUP && !selection.selectedPickupPointId) {
    nextErrors.pickupPoint = "Seleccioná un punto de retiro.";
  }

  return nextErrors;
}

function validateLegacyDelivery(
  form: DeliveryForm,
  deliveryMethod: DeliveryMethod,
  detectedLocation: CheckoutPostalCodeLocation | undefined,
  selectedProvider: CheckoutShippingProvider | null,
  selectedPickupPoint: CheckoutPickupPoint | null,
): FieldErrors<DeliveryForm> {
  const errors: FieldErrors<DeliveryForm> = {};
  if (!form.postalCode.trim()) errors.postalCode = "Ingresá tu código postal.";
  else if (!detectedLocation) errors.postalCode = "No tenemos opciones de entrega para este código postal.";
  if (!deliveryMethod) errors.street = "Seleccioná una forma de entrega.";
  if (!form.city.trim()) errors.city = "Seleccioná una ciudad.";
  if (deliveryMethod === CHECKOUT_FORM_DELIVERY_METHOD.HOME) {
    if (!selectedProvider) errors.postalCode = errors.postalCode ?? "Seleccioná una opción de envío.";
    if (!form.street.trim()) errors.street = "Ingresá la calle.";
    else if (!isValidStreetName(form.street)) errors.street = "Ingresá un nombre de calle válido (hasta 200 caracteres, con al menos una letra).";
    if (!form.streetNumber.trim()) errors.streetNumber = "Ingresá el número.";
    else if (!isValidNumericOnly(form.streetNumber)) errors.streetNumber = "Usá solo números.";
    if (form.neighborhood && !isValidNeighborhood(form.neighborhood)) errors.neighborhood = "Usá hasta 120 caracteres: letras, números y . , / # - °.";
    if (form.recipient && !isValidTextOnly(form.recipient)) errors.recipient = "Usá solo letras.";
  }
  if (deliveryMethod === CHECKOUT_FORM_DELIVERY_METHOD.PICKUP && !selectedPickupPoint) {
    errors.postalCode = errors.postalCode ?? "Seleccioná un punto de retiro.";
  }
  return errors;
}

/** Stable Spanish copy for known coupon error codes; the backend message is English and must not reach the UI. */
export const COUPON_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  COUPON_NOT_VALID: "El cupón no es válido para este pedido.",
  COUPON_USAGE_LIMIT_REACHED: "El cupón alcanzó su límite de usos.",
};

export function getCouponOperationMessage(error: { code: string; message: string }): string {
  return COUPON_ERROR_MESSAGES[error.code] ?? error.message;
}

export function hasErrors(errors: object): boolean {
  return Object.values(errors).some(Boolean);
}

export function getCheckoutConfigurationIssue(
  quote: CheckoutQuote | null,
  deliveryMethod: DeliveryMethod,
  selectedShipping: string | CheckoutShippingProvider | null,
  selectedPickupPoint: string | CheckoutPickupPoint | null,
  selectedPaymentId: string,
): string | null {
  if (!quote) return null;

  const paymentMethod = quote.paymentMethods.find((method) => method.id === selectedPaymentId);
  if (!paymentMethod) return "El medio de pago seleccionado ya no está disponible.";
  const paymentOptionId = paymentMethod.selectedOptionId ?? paymentMethod.options[0]?.id;
  if (!paymentOptionId || !paymentMethod.options.some((option) => option.id === paymentOptionId)) return "El medio de pago seleccionado no tiene una opción configurada.";
  if (selectedPaymentId === "bank-transfer" && !isUsableBankTransferConfig(paymentMethod.bankConfig)) return BANK_TRANSFER_UNAVAILABLE_MESSAGE;
  if (deliveryMethod === "home") {
    if (!selectedShipping) return "Seleccioná una opción de envío.";
    const available = quote.shippingOptions.some((option) => {
      if (option.modality !== CHECKOUT_HOME_DELIVERY_MODALITY) return false;
      return typeof selectedShipping === "string"
        ? option.id === selectedShipping
        : option.providerId === selectedShipping.id;
    });
    if (!available) return "La opción de envío seleccionada ya no está disponible.";
  }
  const pickupPointId = typeof selectedPickupPoint === "string" ? selectedPickupPoint : selectedPickupPoint?.id;
  if (deliveryMethod === "pickup" && (!pickupPointId || !quote.pickupPoints.some((point) => point.id === pickupPointId))) {
    return pickupPointId ? "El punto de retiro seleccionado ya no está disponible." : "Seleccioná un punto de retiro.";
  }

  return null;
}
