"use client";

import { useRef } from "react";
import type { CheckoutDestination } from "@/components/checkout/checkout-destination";
import { buildCompletionInput } from "@/components/checkout/checkout-form.builders";
import { getCheckoutConfigurationIssue } from "@/components/checkout/checkout-form.validators";
import { CHECKOUT_STEP } from "@/components/checkout/checkout-wizard.types";
import type { CheckoutFormState } from "@/components/checkout/use-checkout-form-state";
import {
  type CheckoutCompletion,
  type CheckoutQuote,
} from "@/lib/api/checkout/checkout.repository";
import {
  CHECKOUT_ASYNC_STATUS,
  type CheckoutAsyncStatus,
  type CheckoutCompletionOptions,
} from "@/stores/cart-checkout.types";

export interface CheckoutCompletionDependencies {
  checkoutSessionToken: string | null;
  completeCheckout: (options: CheckoutCompletionOptions) => Promise<CheckoutCompletion | null>;
  completionStatus: CheckoutAsyncStatus;
  form: CheckoutFormState;
  refreshQuote: (destination?: CheckoutDestination) => Promise<CheckoutQuote | null>;
}

export interface CheckoutCompletionController {
  handleFinalize: () => Promise<void>;
}

export function useCheckoutCompletion({
  checkoutSessionToken,
  completeCheckout,
  completionStatus,
  form,
  refreshQuote,
}: CheckoutCompletionDependencies): CheckoutCompletionController {
  const completionSubmitRef = useRef(false);

  async function handleFinalize(): Promise<void> {
    if (completionSubmitRef.current || completionStatus === CHECKOUT_ASYNC_STATUS.LOADING) return;

    if (!form.validateIdentification()) {
      form.invalidateFrom(CHECKOUT_STEP.IDENTIFICATION);
      form.setActiveStep(CHECKOUT_STEP.IDENTIFICATION);
      form.scrollToStep(CHECKOUT_STEP.IDENTIFICATION);
      return;
    }

    if (!form.validateDelivery()) {
      form.setCompletedSteps((current) => ({ ...current, identification: true, delivery: false, payment: false }));
      form.setActiveStep(CHECKOUT_STEP.DELIVERY);
      form.scrollToStep(CHECKOUT_STEP.DELIVERY);
      return;
    }

    completionSubmitRef.current = true;

    try {
      // Finalize commits the pending destination fields first, then re-quotes with the exact selection.
      const destination = form.commitDestination();
      const currentQuote = await refreshQuote(destination);
      if (!currentQuote) {
        form.setActiveStep(CHECKOUT_STEP.PAYMENT);
        return;
      }

      const currentConfigurationIssue = getCheckoutConfigurationIssue(
        currentQuote,
        form.deliveryMethod,
        form.selectedShippingId,
        form.selectedPickupPointId,
        form.selectedPaymentId,
      );
      if (currentConfigurationIssue) {
        form.setActiveStep(CHECKOUT_STEP.PAYMENT);
        return;
      }

      const paymentMethod = currentQuote.paymentMethods.find((method) => method.id === form.selectedPaymentId);
      const paymentOptionId = paymentMethod?.selectedOptionId ?? paymentMethod?.options[0]?.id;
      if (!paymentMethod || !paymentOptionId) {
        form.setActiveStep(CHECKOUT_STEP.PAYMENT);
        return;
      }

      const completionInput = buildCompletionInput({
        currentQuote,
        deliveryForm: form.deliveryForm,
        destination,
        identificationForm: form.identificationForm,
        paymentMethodId: form.selectedPaymentId,
        paymentOptionId,
        sessionToken: checkoutSessionToken,
      });
      const completed = await completeCheckout(completionInput);

      if (completed) {
        form.setCompletedSteps((current) => ({ ...current, payment: true }));
        return;
      }

      form.setActiveStep(CHECKOUT_STEP.PAYMENT);
    } finally {
      completionSubmitRef.current = false;
    }
  }

  return { handleFinalize };
}
