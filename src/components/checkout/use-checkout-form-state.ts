"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  toCheckoutDestination,
  type CheckoutDestination,
} from "@/components/checkout/checkout-destination";
import {
  CHECKOUT_FORM_DELIVERY_METHOD,
  CHECKOUT_LOCALITY_MODE,
  hasErrors,
  validateDelivery as getDeliveryErrors,
  validateDeliveryField,
  validateIdentification as getIdentificationErrors,
  validateIdentificationField,
  type DeliveryErrorKey,
  type DeliveryErrors,
  type DeliveryForm,
  type DeliveryMethod,
  type FieldErrors,
  type IdentificationForm,
} from "@/components/checkout/checkout-form.validators";
import {
  CHECKOUT_PAYMENT_METHOD_IDS,
} from "@/lib/api/checkout/checkout.repository";
import {
  createEmptyCheckoutDraftValues,
  getCheckoutDraftEpoch,
  readCheckoutDraft,
  writeCheckoutDraft,
  type CheckoutDraftValues,
} from "@/lib/checkout-draft";
import {
  sanitizeFloorInput,
  sanitizeNumericInput,
  sanitizePhoneInput,
  sanitizeStreetInput,
  sanitizeNeighborhoodInput,
  sanitizeTextInput,
} from "@/lib/checkout-validation";
import type { CheckoutPaymentMethodId } from "@/lib/data/checkout";
import {
  checkoutShippingProviders,
  checkoutPostalCodeLocations,
  type CheckoutPickupPoint,
  type CheckoutShippingProvider,
} from "@/lib/data/checkout";
import type { CheckoutLocality } from "@/lib/data/locations/localities";
import {
  getPostalCodeFormat,
  getPostalProvinceConflict,
  recognizeProvinceFromPostalCode,
  sanitizePostalCodeInput,
} from "@/lib/data/locations/postal-code";
import { findProvinceById } from "@/lib/data/locations/provinces";
import {
  CHECKOUT_STEP,
  checkoutStepOrder,
  type CheckoutStep,
} from "@/components/checkout/checkout-wizard.types";

export interface CheckoutFormState {
  activeStep: CheckoutStep;
  blurDeliveryField: (field: keyof DeliveryForm) => void;
  blurIdentificationField: (field: keyof IdentificationForm) => void;
  canOpenStep: (step: CheckoutStep) => boolean;
  /** Commits the relevant destination fields and returns the resulting destination synchronously. */
  commitDestination: () => CheckoutDestination;
  completedSteps: Record<CheckoutStep, boolean>;
  continueFrom: (step: CheckoutStep) => void;
  deliveryErrors: DeliveryErrors;
  deliveryForm: DeliveryForm;
  deliveryMethod: DeliveryMethod;
  /** Transitional adapter for existing wizard consumers; removed after their UI migration. */
  detectedLocation: (typeof checkoutPostalCodeLocations)[number] | undefined;
  destination: CheckoutDestination;
  /** True once the user tried to advance or finalize with invalid data; gates the global alert. */
  validationAttempted: boolean;
  identificationErrors: FieldErrors<IdentificationForm>;
  identificationForm: IdentificationForm;
  invalidateFrom: (step: CheckoutStep) => void;
  openStep: (step: CheckoutStep) => void;
  scrollToStep: (step: CheckoutStep) => void;
  selectedPaymentId: CheckoutPaymentMethodId;
  selectedPickupPointId: string | null;
  /** Transitional adapter for existing wizard consumers. */
  selectedPickupPoint: CheckoutPickupPoint | null;
  /** Transitional adapter for existing wizard consumers. */
  selectedProvider: CheckoutShippingProvider | null;
  /** Exact `CheckoutShippingOption.id`. */
  selectedShippingId: string | null;
  selectedShippingProviderId: string | null;
  setActiveStep: (step: CheckoutStep) => void;
  setCompletedSteps: (
    updater: (current: Record<CheckoutStep, boolean>) => Record<CheckoutStep, boolean>,
  ) => void;
  updateDeliveryField: (field: keyof DeliveryForm, value: string) => void;
  updateIdentificationField: (field: keyof IdentificationForm, value: string) => void;
  validateDelivery: () => boolean;
  validateIdentification: () => boolean;
  handleSelectDeliveryMethod: (method: DeliveryMethod) => void;
  handleSelectLocality: (locality: CheckoutLocality) => void;
  handleSelectPayment: (id: CheckoutPaymentMethodId) => void;
  handleSelectPickupPoint: (pointOrId: CheckoutPickupPoint | string) => void;
  handleSelectProvider: (provider: CheckoutShippingProvider) => void;
  handleSelectProvince: (provinceId: string) => void;
  handleSelectShipping: (selection: { id: string; providerId: string }) => void;
  handleSetLocalityMode: (mode: DeliveryForm["localityMode"]) => void;
}

const EMPTY_IDENTIFICATION: IdentificationForm = { dni: "", email: "", firstName: "", lastName: "", phone: "" };
const EMPTY_DELIVERY: DeliveryForm = {
  city: "",
  floor: "",
  localityId: "",
  localityMode: CHECKOUT_LOCALITY_MODE.OFFICIAL,
  neighborhood: "",
  postalCode: "",
  provinceId: "",
  recipient: "",
  street: "",
  streetNumber: "",
};
const INITIAL_STEPS: Record<CheckoutStep, boolean> = { identification: false, delivery: false, payment: false };

type CommittedDestination = { city: string; postalCode: string };

export function useCheckoutFormState(): CheckoutFormState {
  const [activeStep, setActiveStepState] = useState<CheckoutStep>(CHECKOUT_STEP.IDENTIFICATION);
  const [completedSteps, setCompletedStepsState] = useState<Record<CheckoutStep, boolean>>(INITIAL_STEPS);
  const [identificationForm, setIdentificationForm] = useState<IdentificationForm>(EMPTY_IDENTIFICATION);
  const [deliveryForm, setDeliveryForm] = useState<DeliveryForm>(EMPTY_DELIVERY);
  const [identificationErrors, setIdentificationErrors] = useState<FieldErrors<IdentificationForm>>({});
  const [deliveryErrors, setDeliveryErrors] = useState<DeliveryErrors>({});
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(null);
  const [selectedShippingId, setSelectedShippingId] = useState<string | null>(null);
  const [selectedShippingProviderId, setSelectedShippingProviderId] = useState<string | null>(null);
  const [selectedPickupPointId, setSelectedPickupPointId] = useState<string | null>(null);
  const [legacySelectedProvider, setLegacySelectedProvider] = useState<CheckoutShippingProvider | null>(null);
  const [legacySelectedPickupPoint, setLegacySelectedPickupPoint] = useState<CheckoutPickupPoint | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<CheckoutPaymentMethodId>("mercado-pago");
  const [committed, setCommitted] = useState<CommittedDestination>({ city: "", postalCode: "" });
  const [draftHydrated, setDraftHydrated] = useState(false);
  const draftEpochRef = useRef(0);
  const draftValuesRef = useRef<CheckoutDraftValues | null>(null);

  const selection = useMemo(
    () => ({
      deliveryMethod,
      pickupPointId: selectedPickupPointId,
      shippingId: selectedShippingId,
      shippingProviderId: selectedShippingProviderId,
    }),
    [deliveryMethod, selectedPickupPointId, selectedShippingId, selectedShippingProviderId],
  );
  const destination = useMemo(
    () => toCheckoutDestination({ city: committed.city, postalCode: committed.postalCode, provinceId: deliveryForm.provinceId }, selection),
    [committed.city, committed.postalCode, deliveryForm.provinceId, selection],
  );
  const detectedLocation = checkoutPostalCodeLocations.find((location) => location.postalCode === deliveryForm.postalCode);
  const selectedProvider = legacySelectedProvider
    ?? checkoutShippingProviders.find((provider) => provider.id === selectedShippingProviderId)
    ?? null;
  const selectedPickupPoint = legacySelectedPickupPoint
    ?? checkoutPostalCodeLocations.flatMap((location) => location.pickupPoints).find((point) => point.id === selectedPickupPointId)
    ?? null;

  const draftValues = useMemo<CheckoutDraftValues>(() => ({
    ...createEmptyCheckoutDraftValues(),
    city: deliveryForm.city,
    deliveryMethod: deliveryMethod ?? "",
    dni: identificationForm.dni,
    email: identificationForm.email,
    firstName: identificationForm.firstName,
    floor: deliveryForm.floor,
    lastName: identificationForm.lastName,
    localityId: deliveryForm.localityId,
    localityMode: deliveryForm.localityMode,
    neighborhood: deliveryForm.neighborhood,
    paymentMethodId: selectedPaymentId,
    phone: identificationForm.phone,
    pickupPointId: selectedPickupPointId ?? "",
    postalCode: deliveryForm.postalCode,
    provinceId: deliveryForm.provinceId,
    recipient: deliveryForm.recipient,
    shippingMethodId: selectedShippingId ?? "",
    shippingProviderId: selectedShippingProviderId ?? "",
    street: deliveryForm.street,
    streetNumber: deliveryForm.streetNumber,
  }), [deliveryForm, deliveryMethod, identificationForm, selectedPaymentId, selectedPickupPointId, selectedShippingId, selectedShippingProviderId]);

  // Draft hydration happens after mount so server and first client render match.
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      draftEpochRef.current = getCheckoutDraftEpoch();
      const draft = readCheckoutDraft();
      if (draft) {
        const restored = restoreDraft(draft);
        setIdentificationForm(restored.identification);
        setDeliveryForm(restored.delivery);
        setDeliveryMethod(restored.deliveryMethod);
        setSelectedShippingId(restored.shippingId);
        setSelectedShippingProviderId(restored.shippingProviderId);
        setSelectedPickupPointId(restored.pickupPointId);
        setSelectedPaymentId(restored.paymentMethodId);
        setCommitted(restored.committed);
      }
      setDraftHydrated(true);
    });
    return () => { cancelled = true; };
  }, []);

  const flushDraft = useCallback(() => {
    if (!draftValuesRef.current) return;
    writeCheckoutDraft(draftValuesRef.current, { epoch: draftEpochRef.current });
  }, []);

  useEffect(() => {
    if (!draftHydrated) return;
    draftValuesRef.current = draftValues;
    flushDraft();
  }, [draftHydrated, draftValues, flushDraft]);

  useEffect(() => {
    window.addEventListener("pagehide", flushDraft);
    return () => window.removeEventListener("pagehide", flushDraft);
  }, [flushDraft]);

  function setDeliveryError(key: DeliveryErrorKey, message: string | undefined) {
    setDeliveryErrors((current) => ({ ...current, [key]: message }));
  }

  function continueFrom(step: CheckoutStep) {
    if (step === CHECKOUT_STEP.IDENTIFICATION && !validateIdentification()) {
      scrollToStep(CHECKOUT_STEP.IDENTIFICATION);
      return;
    }

    if (step === CHECKOUT_STEP.DELIVERY) {
      commitDestination();
      if (!validateDelivery()) {
        scrollToStep(CHECKOUT_STEP.DELIVERY);
        return;
      }
    }

    setValidationAttempted(false);
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
    // Typing never shows a message: the previous one is cleared and blur re-evaluates.
    setIdentificationErrors((current) => ({ ...current, [field]: undefined }));
    invalidateFrom(CHECKOUT_STEP.IDENTIFICATION);
  }

  function updateDeliveryField(field: keyof DeliveryForm, value: string) {
    const nextValue = field === "postalCode"
      ? sanitizePostalCodeInput(value)
      : field === "streetNumber"
        ? sanitizeNumericInput(value)
        : field === "floor"
          ? sanitizeFloorInput(value)
          : field === "street"
            ? sanitizeStreetInput(value)
            : field === "neighborhood"
              ? sanitizeNeighborhoodInput(value)
              : sanitizeTextInput(value);

    setDeliveryForm((current) => {
      const next = { ...current, [field]: nextValue };
      if (field === "postalCode" && !current.provinceId) {
        const recognized = recognizeProvinceFromPostalCode(nextValue).provinceId;
        if (recognized) return { ...next, city: "", localityId: "", provinceId: recognized };
      }
      return next;
    });
    setDeliveryError(field, undefined);
    invalidateFrom(CHECKOUT_STEP.DELIVERY);
  }

  function blurIdentificationField(field: keyof IdentificationForm) {
    setIdentificationErrors((current) => ({ ...current, [field]: validateIdentificationField(field, identificationForm) }));
    flushDraft();
  }

  function blurDeliveryField(field: keyof DeliveryForm) {
    setDeliveryError(field, validateDeliveryField(field, deliveryForm, deliveryMethod));
    if (field === "postalCode") {
      setCommitted((current) => ({ ...current, postalCode: committablePostalCode(deliveryForm) }));
    } else if (field === "city" && deliveryForm.localityMode === CHECKOUT_LOCALITY_MODE.MANUAL) {
      setCommitted((current) => ({ ...current, city: deliveryForm.city.trim() }));
    }
    flushDraft();
  }

  function commitDestination(): CheckoutDestination {
    const nextCommitted = { city: deliveryForm.city.trim(), postalCode: committablePostalCode(deliveryForm) };
    setCommitted(nextCommitted);
    return toCheckoutDestination({ ...nextCommitted, provinceId: deliveryForm.provinceId }, selection);
  }

  function validateIdentification() {
    const nextErrors = getIdentificationErrors(identificationForm);
    setIdentificationErrors(nextErrors);
    if (hasErrors(nextErrors)) setValidationAttempted(true);
    return !hasErrors(nextErrors);
  }

  function validateDelivery() {
    const nextErrors = getDeliveryErrors(deliveryForm, {
      deliveryMethod,
      selectedPickupPointId,
      selectedShippingId,
    });
    setDeliveryErrors(nextErrors);
    if (hasErrors(nextErrors)) setValidationAttempted(true);
    return !hasErrors(nextErrors);
  }

  function handleSelectProvince(provinceId: string) {
    setDeliveryForm((current) => ({ ...current, city: "", localityId: "", provinceId }));
    setCommitted((current) => ({ ...current, city: "" }));
    setDeliveryErrors((current) => ({
      ...current,
      city: undefined,
      provinceId: undefined,
      // The postal contradiction is re-evaluated on the new province only if it is already visible.
      postalCode: current.postalCode ? getPostalProvinceConflict(deliveryForm.postalCode, provinceId) ?? undefined : undefined,
    }));
    invalidateFrom(CHECKOUT_STEP.DELIVERY);
  }

  function handleSelectLocality(locality: CheckoutLocality) {
    setDeliveryForm((current) => ({ ...current, city: locality.name, localityId: locality.id }));
    setCommitted((current) => ({ ...current, city: locality.name }));
    setDeliveryError("city", undefined);
    invalidateFrom(CHECKOUT_STEP.DELIVERY);
  }

  function handleSetLocalityMode(mode: DeliveryForm["localityMode"]) {
    setDeliveryForm((current) => ({ ...current, city: "", localityId: "", localityMode: mode }));
    setCommitted((current) => ({ ...current, city: "" }));
    setDeliveryError("city", undefined);
    invalidateFrom(CHECKOUT_STEP.DELIVERY);
  }

  function handleSelectDeliveryMethod(method: DeliveryMethod) {
    setDeliveryMethod(method);
    setSelectedShippingId(null);
    setSelectedShippingProviderId(null);
    setSelectedPickupPointId(null);
    setDeliveryErrors((current) => ({
      ...current,
      deliveryMethod: undefined,
      pickupPoint: undefined,
      shipping: undefined,
    }));
    invalidateFrom(CHECKOUT_STEP.DELIVERY);
  }

  function handleSelectShipping({ id, providerId }: { id: string; providerId: string }) {
    setSelectedShippingId(id);
    setSelectedShippingProviderId(providerId);
    setDeliveryError("shipping", undefined);
    invalidateFrom(CHECKOUT_STEP.DELIVERY);
  }

  /** Transitional adapter for the existing provider-card component. */
  function handleSelectProvider(provider: CheckoutShippingProvider) {
    setLegacySelectedProvider(provider);
    setSelectedShippingId(provider.id);
    setSelectedShippingProviderId(provider.id);
    setDeliveryError("shipping", undefined);
    invalidateFrom(CHECKOUT_STEP.DELIVERY);
  }

  function handleSelectProvider(provider: CheckoutShippingProvider) {
    setLegacySelectedProvider(provider);
    setSelectedShippingId(provider.id);
    setSelectedShippingProviderId(provider.id);
    setDeliveryError("shipping", undefined);
    invalidateFrom(CHECKOUT_STEP.DELIVERY);
  }

  function handleSelectPickupPoint(pointOrId: CheckoutPickupPoint | string) {
    const id = typeof pointOrId === "string" ? pointOrId : pointOrId.id;
    const point = typeof pointOrId === "string"
      ? checkoutPostalCodeLocations.flatMap((location) => location.pickupPoints).find((candidate) => candidate.id === id) ?? {
        address: "",
        eta: "",
        id,
        name: id,
      }
      : pointOrId;
    setLegacySelectedPickupPoint(point);
    setSelectedPickupPointId(id);
    setDeliveryError("pickupPoint", undefined);
    invalidateFrom(CHECKOUT_STEP.DELIVERY);
  }

  function handleSelectPayment(id: CheckoutPaymentMethodId) {
    setSelectedPaymentId(id);
    invalidateFrom(CHECKOUT_STEP.PAYMENT);
  }

  function scrollToStep(step: CheckoutStep): void {
    document.getElementById(`checkout-step-${step}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return {
    activeStep,
    blurDeliveryField,
    blurIdentificationField,
    canOpenStep,
    commitDestination,
    completedSteps,
    continueFrom,
    deliveryErrors,
    deliveryForm,
    deliveryMethod,
    detectedLocation,
    destination,
    handleSelectDeliveryMethod,
    handleSelectProvider,
    handleSelectLocality,
    handleSelectPayment,
    handleSelectPickupPoint,
    handleSelectProvider,
    handleSelectProvince,
    handleSelectShipping,
    handleSetLocalityMode,
    identificationErrors,
    identificationForm,
    invalidateFrom,
    openStep,
    scrollToStep,
    selectedPaymentId,
    selectedPickupPointId,
    selectedPickupPoint: legacySelectedPickupPoint,
    selectedShippingId,
    selectedShippingProviderId,
    selectedProvider: legacySelectedProvider,
    setActiveStep: setActiveStepState,
    setCompletedSteps: setCompletedStepsState,
    updateDeliveryField,
    updateIdentificationField,
    validateDelivery,
    validateIdentification,
    validationAttempted,
  };
}

/** A postal code is committable only when its format is valid and it does not contradict the province. */
function committablePostalCode(form: Pick<DeliveryForm, "postalCode" | "provinceId">): string {
  const format = getPostalCodeFormat(form.postalCode);
  if (format !== "cp4" && format !== "cpa") return "";
  return getPostalProvinceConflict(form.postalCode, form.provinceId) ? "" : form.postalCode;
}

/** Restored values are untrusted intent: re-sanitized, and ids are only kept to be resolved against the next quote. */
function restoreDraft(draft: CheckoutDraftValues) {
  const delivery: DeliveryForm = {
    city: sanitizeTextInput(draft.city),
    floor: sanitizeFloorInput(draft.floor),
    localityId: draft.localityId.replace(/\D/g, ""),
    localityMode: draft.localityMode === CHECKOUT_LOCALITY_MODE.MANUAL ? CHECKOUT_LOCALITY_MODE.MANUAL : CHECKOUT_LOCALITY_MODE.OFFICIAL,
    neighborhood: sanitizeNeighborhoodInput(draft.neighborhood),
    postalCode: sanitizePostalCodeInput(draft.postalCode),
    provinceId: findProvinceById(draft.provinceId) ? draft.provinceId : "",
    recipient: sanitizeTextInput(draft.recipient),
    street: sanitizeStreetInput(draft.street),
    streetNumber: sanitizeNumericInput(draft.streetNumber),
  };
  const method: DeliveryMethod = draft.deliveryMethod === CHECKOUT_FORM_DELIVERY_METHOD.HOME || draft.deliveryMethod === CHECKOUT_FORM_DELIVERY_METHOD.PICKUP
    ? draft.deliveryMethod
    : null;
  const paymentMethodId = (CHECKOUT_PAYMENT_METHOD_IDS as readonly string[]).includes(draft.paymentMethodId)
    ? (draft.paymentMethodId as CheckoutPaymentMethodId)
    : "mercado-pago";

  return {
    committed: { city: delivery.city.trim(), postalCode: committablePostalCode(delivery) },
    delivery,
    deliveryMethod: method,
    identification: {
      dni: sanitizeNumericInput(draft.dni),
      email: draft.email,
      firstName: sanitizeTextInput(draft.firstName),
      lastName: sanitizeTextInput(draft.lastName),
      phone: sanitizePhoneInput(draft.phone),
    },
    paymentMethodId,
    pickupPointId: method === CHECKOUT_FORM_DELIVERY_METHOD.PICKUP && draft.pickupPointId ? draft.pickupPointId : null,
    shippingId: method === CHECKOUT_FORM_DELIVERY_METHOD.HOME && draft.shippingMethodId ? draft.shippingMethodId : null,
    shippingProviderId: method === CHECKOUT_FORM_DELIVERY_METHOD.HOME && draft.shippingMethodId && draft.shippingProviderId ? draft.shippingProviderId : null,
  };
}

function getNextStep(step: CheckoutStep): CheckoutStep {
  const nextIndex = Math.min(checkoutStepOrder.length - 1, checkoutStepOrder.indexOf(step) + 1);
  return checkoutStepOrder[nextIndex];
}
