"use client";

import { useCartTotals } from "@/hooks/useCartTotals";
import type { CheckoutDestination } from "@/components/checkout/checkout-destination";
import {
  getCheckoutConfigurationIssue,
  hasErrors,
  type DeliveryErrors,
  type DeliveryForm,
  type DeliveryMethod,
  type FieldErrors,
  type IdentificationForm,
} from "@/components/checkout/checkout-form.validators";
import {
  type CheckoutCompletion,
  type CheckoutQuote,
} from "@/lib/api/checkout/checkout.repository";
import {
  type CheckoutPaymentMethodId,
  type CheckoutPickupPoint,
  type CheckoutPostalCodeLocation,
  type CheckoutShippingProvider,
} from "@/lib/data/checkout";
import type { CheckoutLocality } from "@/lib/data/locations/localities";
import {
  CHECKOUT_ASYNC_STATUS,
  useCartStore,
  type CheckoutAsyncStatus,
} from "@/stores/cart-store";
import type { CartPreviewItem } from "@/types/cart";
import {
  useCheckoutCardPayment,
  type CheckoutCardPaymentModel,
} from "@/components/checkout/use-checkout-card-payment";
import { useCheckoutCompletion } from "@/components/checkout/use-checkout-completion";
import { useCheckoutFormState } from "@/components/checkout/use-checkout-form-state";
import { useCheckoutQuoteLifecycle } from "@/components/checkout/use-checkout-quote-lifecycle";
import type { CheckoutStep } from "@/components/checkout/checkout-wizard.types";

export type { CheckoutStep } from "@/components/checkout/checkout-wizard.types";

export interface CheckoutWizardModel {
  activeStep: CheckoutStep;
  actionHelpText: string;
  applyCoupon: (couponCode: string) => Promise<CheckoutQuote | null>;
  canFinalize: boolean;
  card: CheckoutCardPaymentModel;
  canOpenStep: (step: CheckoutStep) => boolean;
  completedSteps: Record<CheckoutStep, boolean>;
  completion: CheckoutCompletion | null;
  configurationIssue: string | null;
  continueFrom: (step: CheckoutStep) => void;
  blurDeliveryField: (field: keyof DeliveryForm) => void;
  blurIdentificationField: (field: keyof IdentificationForm) => void;
  deliveryErrors: DeliveryErrors;
  deliveryForm: DeliveryForm;
  deliveryMethod: DeliveryMethod;
  /** Transitional adapter for the existing delivery-card UI. */
  detectedLocation: CheckoutPostalCodeLocation | undefined;
  destination: CheckoutDestination;
  discountTotal: number;
  handleFinalize: () => Promise<void>;
  handleSelectDeliveryMethod: (method: DeliveryMethod) => void;
  /** Transitional adapter for the existing delivery-card UI. */
  handleSelectProvider: (provider: CheckoutShippingProvider) => void;
  handleSelectPayment: (id: CheckoutPaymentMethodId) => void;
  handleSelectLocality: (locality: CheckoutLocality) => void;
  handleSelectPickupPoint: (point: CheckoutPickupPoint | string) => void;
  handleSelectProvince: (provinceId: string) => void;
  handleSelectShipping: (selection: { id: string; providerId: string }) => void;
  handleSetLocalityMode: (mode: DeliveryForm["localityMode"]) => void;
  hasValidationErrors: boolean;
  hasFreeShipping: boolean;
  freeShippingRemaining: number;
  hydrated: boolean;
  identificationErrors: FieldErrors<IdentificationForm>;
  identificationForm: IdentificationForm;
  items: CartPreviewItem[];
  openStep: (step: CheckoutStep) => void;
  quote: CheckoutQuote | null;
  quoteStatus: CheckoutAsyncStatus;
  reconciliationMessage: string | null;
  refreshQuote: (destination?: CheckoutDestination) => Promise<CheckoutQuote | null>;
  selectedPaymentId: CheckoutPaymentMethodId;
  /** Transitional adapters for existing checkout summary/delivery components. */
  selectedPickupPoint: CheckoutPickupPoint | null;
  selectedPickupPointId: string | null;
  selectedProvider: CheckoutShippingProvider | null;
  selectedShippingId: string | null;
  /** True only when the quote offers the exact selected service or pickup point. */
  shippingResolved: boolean;
  showConfigurationIssue: boolean;
  subtotal: number;
  updateDeliveryField: (field: keyof DeliveryForm, value: string) => void;
  updateIdentificationField: (field: keyof IdentificationForm, value: string) => void;
}

export function useCheckoutWizard(): CheckoutWizardModel {
  const items = useCartStore((state) => state.items);
  const quote = useCartStore((state) => state.quote);
  const quoteStatus = useCartStore((state) => state.quoteStatus);
  const requestQuote = useCartStore((state) => state.requestQuote);
  const checkoutSessionToken = useCartStore((state) => state.checkoutSessionToken);
  const completion = useCartStore((state) => state.completion);
  const completionStatus = useCartStore((state) => state.completionStatus);
  const completeCheckout = useCartStore((state) => state.completeCheckout);
  const { discountTotal, freeShippingRemaining, subtotal } = useCartTotals(items);
  const hasFreeShipping = freeShippingRemaining === 0;
  const form = useCheckoutFormState();
  const quoteLifecycle = useCheckoutQuoteLifecycle({
    destination: form.destination,
    items,
    quote,
    requestQuote,
  });
  const configurationIssue = getCheckoutConfigurationIssue(
    quote,
    form.deliveryMethod,
    form.selectedProvider && form.selectedShippingId === form.selectedProvider.id
      ? form.selectedProvider
      : form.selectedShippingId,
    form.selectedPickupPointId,
    form.selectedPaymentId,
  );
  const shippingResolved = isShippingResolved(
    quote,
    form.deliveryMethod,
    form.selectedShippingId,
    form.selectedShippingProviderId,
    form.selectedPickupPointId,
  );
  const { handleFinalize } = useCheckoutCompletion({
    checkoutSessionToken,
    completeCheckout,
    completionStatus,
    form,
    refreshQuote: quoteLifecycle.refreshQuote,
  });
  const card = useCheckoutCardPayment({ configurationIssue, form, quote, quoteStatus });
  const canFinalize = form.completedSteps.identification
    && form.completedSteps.delivery
    && items.length > 0
    && quoteStatus === CHECKOUT_ASYNC_STATUS.SUCCESS
    && Boolean(quote)
    && !configurationIssue;
  // The global alert belongs to advance/finalize attempts; blur messages stay on their own field.
  const hasValidationErrors = form.validationAttempted && (hasErrors(form.identificationErrors) || hasErrors(form.deliveryErrors));
  const actionHelpText = quoteStatus === CHECKOUT_ASYNC_STATUS.LOADING || quoteStatus === CHECKOUT_ASYNC_STATUS.IDLE
    ? "Estamos confirmando los valores de tu pedido."
    : quoteStatus === CHECKOUT_ASYNC_STATUS.ERROR
      ? "Actualizá la cotización antes de continuar."
      : configurationIssue
        ? configurationIssue
        : !form.completedSteps.identification
          ? "Completá tus datos para continuar."
          : !form.completedSteps.delivery
            ? "Seleccioná una forma de entrega para continuar."
            : "El total final será confirmado antes de crear el pedido.";
  const showConfigurationIssue = Boolean(configurationIssue && quoteStatus === CHECKOUT_ASYNC_STATUS.SUCCESS);

  return {
    activeStep: form.activeStep,
    actionHelpText,
    applyCoupon: quoteLifecycle.applyCoupon,
    canFinalize,
    card,
    blurDeliveryField: form.blurDeliveryField,
    blurIdentificationField: form.blurIdentificationField,
    canOpenStep: form.canOpenStep,
    completedSteps: form.completedSteps,
    completion,
    configurationIssue,
    continueFrom: form.continueFrom,
    deliveryErrors: form.deliveryErrors,
    deliveryForm: form.deliveryForm,
    deliveryMethod: form.deliveryMethod,
    detectedLocation: form.detectedLocation,
    destination: form.destination,
    discountTotal,
    handleFinalize,
    handleSelectDeliveryMethod: form.handleSelectDeliveryMethod,
    handleSelectProvider: form.handleSelectProvider,
    handleSelectPayment: form.handleSelectPayment,
    handleSelectLocality: form.handleSelectLocality,
    handleSelectPickupPoint: form.handleSelectPickupPoint,
    handleSelectProvince: form.handleSelectProvince,
    handleSelectShipping: form.handleSelectShipping,
    handleSetLocalityMode: form.handleSetLocalityMode,
    hasValidationErrors,
    hasFreeShipping,
    freeShippingRemaining,
    hydrated: quoteLifecycle.hydrated,
    identificationErrors: form.identificationErrors,
    identificationForm: form.identificationForm,
    items,
    openStep: form.openStep,
    quote,
    quoteStatus,
    reconciliationMessage: quoteLifecycle.reconciliationMessage,
    refreshQuote: quoteLifecycle.refreshQuote,
    selectedPaymentId: form.selectedPaymentId,
    selectedPickupPoint: form.selectedPickupPoint,
    selectedPickupPointId: form.selectedPickupPointId,
    selectedProvider: form.selectedProvider,
    selectedShippingId: form.selectedShippingId,
    shippingResolved,
    showConfigurationIssue,
    subtotal,
    updateDeliveryField: form.updateDeliveryField,
    updateIdentificationField: form.updateIdentificationField,
  };
}

function isShippingResolved(
  quote: CheckoutQuote | null,
  deliveryMethod: DeliveryMethod,
  selectedShippingId: string | null,
  selectedShippingProviderId: string | null,
  selectedPickupPointId: string | null,
): boolean {
  if (!quote) return false;
  if (deliveryMethod === "home") {
    if (selectedShippingId && quote.shippingOptions.some((option) => option.id === selectedShippingId)) return true;
    const matchingProviderOptions = quote.shippingOptions.filter((option) =>
      option.modality === "home_delivery" && option.providerId === selectedShippingProviderId,
    );
    return Boolean(selectedShippingId && selectedShippingProviderId === selectedShippingId && matchingProviderOptions.length === 1);
  }
  if (deliveryMethod === "pickup") return Boolean(selectedPickupPointId) && quote.pickupPoints.some((point) => point.id === selectedPickupPointId);
  return false;
}
