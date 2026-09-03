"use client";

import { useCartTotals } from "@/hooks/useCartTotals";
import {
  getCheckoutConfigurationIssue,
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
import {
  CHECKOUT_ASYNC_STATUS,
  useCartStore,
  type CheckoutAsyncStatus,
} from "@/stores/cart-store";
import type { CartPreviewItem } from "@/types/cart";
import { useCheckoutCompletion } from "@/components/checkout/use-checkout-completion";
import { useCheckoutFormState } from "@/components/checkout/use-checkout-form-state";
import { useCheckoutQuoteLifecycle } from "@/components/checkout/use-checkout-quote-lifecycle";
import type { CheckoutStep } from "@/components/checkout/checkout-wizard.types";

export type { CheckoutStep } from "@/components/checkout/checkout-wizard.types";

export interface CheckoutWizardModel {
  activeStep: CheckoutStep;
  actionHelpText: string;
  canFinalize: boolean;
  canOpenStep: (step: CheckoutStep) => boolean;
  completedSteps: Record<CheckoutStep, boolean>;
  completion: CheckoutCompletion | null;
  configurationIssue: string | null;
  continueFrom: (step: CheckoutStep) => void;
  deliveryErrors: FieldErrors<DeliveryForm>;
  deliveryForm: DeliveryForm;
  deliveryMethod: DeliveryMethod;
  detectedLocation: CheckoutPostalCodeLocation | undefined;
  discountTotal: number;
  freeShippingRemaining: number;
  handleFinalize: () => Promise<void>;
  handleSelectDeliveryMethod: (method: DeliveryMethod) => void;
  handleSelectPayment: (id: CheckoutPaymentMethodId) => void;
  handleSelectPickupPoint: (point: CheckoutPickupPoint) => void;
  handleSelectProvider: (provider: CheckoutShippingProvider) => void;
  handleTransferProofChange: (hasProof: boolean) => void;
  hasFreeShipping: boolean;
  hasValidationErrors: boolean;
  hydrated: boolean;
  identificationErrors: FieldErrors<IdentificationForm>;
  identificationForm: IdentificationForm;
  items: CartPreviewItem[];
  openStep: (step: CheckoutStep) => void;
  quote: CheckoutQuote | null;
  quoteStatus: CheckoutAsyncStatus;
  reconciliationMessage: string | null;
  refreshQuote: () => Promise<CheckoutQuote | null>;
  selectedPaymentId: CheckoutPaymentMethodId;
  selectedPickupPoint: CheckoutPickupPoint | null;
  selectedProvider: CheckoutShippingProvider | null;
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
  const form = useCheckoutFormState();
  const hasFreeShipping = freeShippingRemaining === 0;
  const quoteLifecycle = useCheckoutQuoteLifecycle({
    deliveryForm: form.deliveryForm,
    deliveryMethod: form.deliveryMethod,
    detectedLocation: form.detectedLocation,
    items,
    requestQuote,
    selectedPickupPoint: form.selectedPickupPoint,
    selectedProvider: form.selectedProvider,
  });
  const configurationIssue = getCheckoutConfigurationIssue(
    quote,
    form.deliveryMethod,
    form.selectedProvider,
    form.selectedPickupPoint,
    form.selectedPaymentId,
  );
  const { handleFinalize } = useCheckoutCompletion({
    checkoutSessionToken,
    completeCheckout,
    completionStatus,
    form,
    refreshQuote: quoteLifecycle.refreshQuote,
  });
  const canFinalize = form.completedSteps.identification
    && form.completedSteps.delivery
    && items.length > 0
    && quoteStatus === CHECKOUT_ASYNC_STATUS.SUCCESS
    && Boolean(quote)
    && !configurationIssue
    && (form.selectedPaymentId !== "bank-transfer" || form.hasTransferProof);
  const hasValidationErrors = Object.keys(form.identificationErrors).length > 0 || Object.keys(form.deliveryErrors).length > 0;
  const actionHelpText = quoteStatus === CHECKOUT_ASYNC_STATUS.LOADING || quoteStatus === CHECKOUT_ASYNC_STATUS.IDLE
    ? "Estamos confirmando los valores con el servidor."
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
    canFinalize,
    canOpenStep: form.canOpenStep,
    completedSteps: form.completedSteps,
    completion,
    configurationIssue,
    continueFrom: form.continueFrom,
    deliveryErrors: form.deliveryErrors,
    deliveryForm: form.deliveryForm,
    deliveryMethod: form.deliveryMethod,
    detectedLocation: form.detectedLocation,
    discountTotal,
    freeShippingRemaining,
    handleFinalize,
    handleSelectDeliveryMethod: form.handleSelectDeliveryMethod,
    handleSelectPayment: form.handleSelectPayment,
    handleSelectPickupPoint: form.handleSelectPickupPoint,
    handleSelectProvider: form.handleSelectProvider,
    handleTransferProofChange: form.handleTransferProofChange,
    hasFreeShipping,
    hasValidationErrors,
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
    selectedProvider: form.selectedProvider,
    showConfigurationIssue,
    subtotal,
    updateDeliveryField: form.updateDeliveryField,
    updateIdentificationField: form.updateIdentificationField,
  };
}
