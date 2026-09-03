"use client";

import { useState } from "react";
import {
  validateDelivery as getDeliveryErrors,
  validateIdentification as getIdentificationErrors,
  type DeliveryForm,
  type DeliveryMethod,
  type FieldErrors,
  type IdentificationForm,
} from "@/components/checkout/checkout-form.validators";
import {
  checkoutPostalCodeLocations,
  type CheckoutPaymentMethodId,
  type CheckoutPickupPoint,
  type CheckoutPostalCodeLocation,
  type CheckoutShippingProvider,
} from "@/lib/data/checkout";
import {
  sanitizeNumericInput,
  sanitizePhoneInput,
  sanitizeTextInput,
} from "@/lib/checkout-validation";
import {
  CHECKOUT_STEP,
  checkoutStepOrder,
  type CheckoutStep,
} from "@/components/checkout/checkout-wizard.types";

export interface CheckoutFormState {
  activeStep: CheckoutStep;
  canOpenStep: (step: CheckoutStep) => boolean;
  completedSteps: Record<CheckoutStep, boolean>;
  continueFrom: (step: CheckoutStep) => void;
  deliveryErrors: FieldErrors<DeliveryForm>;
  deliveryForm: DeliveryForm;
  deliveryMethod: DeliveryMethod;
  detectedLocation: CheckoutPostalCodeLocation | undefined;
  hasTransferProof: boolean;
  identificationErrors: FieldErrors<IdentificationForm>;
  identificationForm: IdentificationForm;
  invalidateFrom: (step: CheckoutStep) => void;
  openStep: (step: CheckoutStep) => void;
  scrollToStep: (step: CheckoutStep) => void;
  selectedPaymentId: CheckoutPaymentMethodId;
  selectedPickupPoint: CheckoutPickupPoint | null;
  selectedProvider: CheckoutShippingProvider | null;
  setActiveStep: (step: CheckoutStep) => void;
  setCompletedSteps: (
    updater: (current: Record<CheckoutStep, boolean>) => Record<CheckoutStep, boolean>,
  ) => void;
  updateDeliveryField: (field: keyof DeliveryForm, value: string) => void;
  updateIdentificationField: (field: keyof IdentificationForm, value: string) => void;
  validateDelivery: () => boolean;
  validateIdentification: () => boolean;
  handleSelectDeliveryMethod: (method: DeliveryMethod) => void;
  handleSelectPayment: (id: CheckoutPaymentMethodId) => void;
  handleSelectPickupPoint: (point: CheckoutPickupPoint) => void;
  handleSelectProvider: (provider: CheckoutShippingProvider) => void;
  handleTransferProofChange: (hasProof: boolean) => void;
}

export function useCheckoutFormState(): CheckoutFormState {
  const [activeStep, setActiveStepState] = useState<CheckoutStep>(CHECKOUT_STEP.IDENTIFICATION);
  const [completedSteps, setCompletedStepsState] = useState<Record<CheckoutStep, boolean>>({
    identification: false,
    delivery: false,
    payment: false,
  });
  const [identificationForm, setIdentificationForm] = useState<IdentificationForm>({
    dni: "",
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
  });
  const [deliveryForm, setDeliveryForm] = useState<DeliveryForm>({
    city: "",
    floor: "",
    neighborhood: "",
    postalCode: "",
    recipient: "",
    street: "",
    streetNumber: "",
  });
  const [identificationErrors, setIdentificationErrors] = useState<FieldErrors<IdentificationForm>>({});
  const [deliveryErrors, setDeliveryErrors] = useState<FieldErrors<DeliveryForm>>({});
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(null);
  const [selectedProvider, setSelectedProvider] = useState<CheckoutShippingProvider | null>(null);
  const [selectedPickupPoint, setSelectedPickupPoint] = useState<CheckoutPickupPoint | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<CheckoutPaymentMethodId>("mercado-pago");
  const [hasTransferProof, setHasTransferProof] = useState(false);

  const detectedLocation = checkoutPostalCodeLocations.find(
    (location) => location.postalCode === deliveryForm.postalCode,
  );

  function continueFrom(step: CheckoutStep) {
    if (step === CHECKOUT_STEP.IDENTIFICATION && !validateIdentification()) {
      scrollToStep(CHECKOUT_STEP.IDENTIFICATION);
      return;
    }

    if (step === CHECKOUT_STEP.DELIVERY && !validateDelivery()) {
      scrollToStep(CHECKOUT_STEP.DELIVERY);
      return;
    }

    setCompletedStepsState((current) => ({ ...current, [step]: true }));
    setActiveStepState(getNextStep(step));
  }

  function canOpenStep(step: CheckoutStep) {
    if (step === CHECKOUT_STEP.IDENTIFICATION) {
      return true;
    }

    if (step === CHECKOUT_STEP.DELIVERY) {
      return completedSteps.identification;
    }

    return completedSteps.identification && completedSteps.delivery;
  }

  function openStep(step: CheckoutStep) {
    if (canOpenStep(step)) {
      setActiveStepState(step);
    }
  }

  function invalidateFrom(step: CheckoutStep) {
    setCompletedStepsState((current) => {
      if (step === CHECKOUT_STEP.IDENTIFICATION) {
        return { identification: false, delivery: false, payment: false };
      }

      if (step === CHECKOUT_STEP.DELIVERY) {
        return { ...current, delivery: false, payment: false };
      }

      return { ...current, payment: false };
    });
  }

  function updateIdentificationField(field: keyof IdentificationForm, value: string) {
    const nextValue = field === "dni"
      ? sanitizeNumericInput(value)
      : field === "phone"
        ? sanitizePhoneInput(value)
        : field === "email"
          ? value
          : sanitizeTextInput(value);

    setIdentificationForm((current) => ({ ...current, [field]: nextValue }));
    setIdentificationErrors((current) => ({ ...current, [field]: undefined }));
    invalidateFrom(CHECKOUT_STEP.IDENTIFICATION);
  }

  function updateDeliveryField(field: keyof DeliveryForm, value: string) {
    const nextValue = field === "postalCode" || field === "streetNumber"
      ? sanitizeNumericInput(value)
      : field === "floor"
        ? value
        : sanitizeTextInput(value);

    setDeliveryForm((current) => ({
      ...current,
      [field]: nextValue,
      ...(field === "postalCode" ? { city: "" } : null),
    }));
    setDeliveryErrors((current) => ({ ...current, [field]: undefined }));
    invalidateFrom(CHECKOUT_STEP.DELIVERY);
  }

  function validateIdentification() {
    const nextErrors = getIdentificationErrors(identificationForm);
    setIdentificationErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateDelivery() {
    const nextErrors = getDeliveryErrors(
      deliveryForm,
      deliveryMethod,
      detectedLocation,
      selectedProvider,
      selectedPickupPoint,
    );
    setDeliveryErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSelectDeliveryMethod(method: DeliveryMethod) {
    setDeliveryMethod(method);
    setSelectedProvider(null);
    setSelectedPickupPoint(null);
    setDeliveryErrors({});
    invalidateFrom(CHECKOUT_STEP.DELIVERY);
  }

  function handleSelectProvider(provider: CheckoutShippingProvider) {
    setSelectedProvider(provider);
    setDeliveryErrors((current) => ({ ...current, postalCode: undefined }));
    invalidateFrom(CHECKOUT_STEP.DELIVERY);
  }

  function handleSelectPickupPoint(point: CheckoutPickupPoint) {
    setSelectedPickupPoint(point);
    setDeliveryErrors((current) => ({ ...current, postalCode: undefined }));
    invalidateFrom(CHECKOUT_STEP.DELIVERY);
  }

  function handleSelectPayment(id: CheckoutPaymentMethodId) {
    setSelectedPaymentId(id);
    invalidateFrom(CHECKOUT_STEP.PAYMENT);
  }

  function handleTransferProofChange(hasProof: boolean) {
    setHasTransferProof(hasProof);
    invalidateFrom(CHECKOUT_STEP.PAYMENT);
  }

  function scrollToStep(step: CheckoutStep): void {
    document.getElementById(`checkout-step-${step}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return {
    activeStep,
    canOpenStep,
    completedSteps,
    continueFrom,
    deliveryErrors,
    deliveryForm,
    deliveryMethod,
    detectedLocation,
    handleSelectDeliveryMethod,
    handleSelectPayment,
    handleSelectPickupPoint,
    handleSelectProvider,
    handleTransferProofChange,
    hasTransferProof,
    identificationErrors,
    identificationForm,
    invalidateFrom,
    openStep,
    scrollToStep,
    selectedPaymentId,
    selectedPickupPoint,
    selectedProvider,
    setActiveStep: setActiveStepState,
    setCompletedSteps: setCompletedStepsState,
    updateDeliveryField,
    updateIdentificationField,
    validateDelivery,
    validateIdentification,
  };
}

function getNextStep(step: CheckoutStep): CheckoutStep {
  const nextIndex = Math.min(checkoutStepOrder.length - 1, checkoutStepOrder.indexOf(step) + 1);
  return checkoutStepOrder[nextIndex];
}
