"use client";

import { useRouter } from "next/navigation";
import { buildCompletionInput, toCheckoutLineItemsFromQuote } from "@/components/checkout/checkout-form.builders";
import type { CheckoutFormState } from "@/components/checkout/use-checkout-form-state";
import type { CheckoutQuote } from "@/lib/api/checkout/checkout.repository";
import { DATA_SOURCE, getCheckoutDataSource } from "@/lib/api/config";
import { BOUND_ORDER_MODE, resolveBoundOrderMode } from "@/lib/api/payments/payment-result";
import { checkoutRoutes } from "@/lib/routes";
import { useCheckoutPaymentStore, type SubmitCardInput } from "@/stores/checkout-payment-store";
import { CHECKOUT_ASYNC_STATUS, useCartStore, type CheckoutAsyncStatus } from "@/stores/cart-store";

export const CARD_PAYMENT_METHOD_ID = "mercado-pago";

export function getMercadoPagoPublicKey(): string {
  return process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim() ?? "";
}

export interface CheckoutCardPaymentModel {
  /** Card payments can be offered: real backend, public key configured and the quote offers the method. */
  available: boolean;
  /** Card is the selected method: the Brick submit is the only pay action. */
  active: boolean;
  /** The Brick may be mounted for `mountQuote`. */
  ready: boolean;
  mountQuote: CheckoutQuote | null;
  submit: (quoteId: string, formData: unknown) => Promise<void>;
}

interface Input {
  configurationIssue: string | null;
  form: CheckoutFormState;
  quote: CheckoutQuote | null;
  quoteStatus: CheckoutAsyncStatus;
}

export function useCheckoutCardPayment({ configurationIssue, form, quote, quoteStatus }: Input): CheckoutCardPaymentModel {
  const router = useRouter();
  const submitCard = useCheckoutPaymentStore((state) => state.submitCard);

  const available = getCheckoutDataSource() === DATA_SOURCE.API
    && Boolean(getMercadoPagoPublicKey())
    && Boolean(quote?.paymentMethods.some((method) => method.id === CARD_PAYMENT_METHOD_ID));
  const active = available && form.selectedPaymentId === CARD_PAYMENT_METHOD_ID;
  const ready = active
    && form.completedSteps.identification
    && form.completedSteps.delivery
    && quoteStatus === CHECKOUT_ASYNC_STATUS.SUCCESS
    && Boolean(quote)
    && !configurationIssue;

  async function submit(mountedQuoteId: string, formData: unknown): Promise<void> {
    const current = useCartStore.getState();
    const currentQuote = current.quote;
    if (!currentQuote || current.quoteStatus !== CHECKOUT_ASYNC_STATUS.SUCCESS || currentQuote.quoteId !== mountedQuoteId) {
      throw new Error("STALE_QUOTE");
    }
    if (!form.validateIdentification() || !form.validateDelivery()) throw new Error("INVALID_FORM");

    const method = currentQuote.paymentMethods.find((candidate) => candidate.id === CARD_PAYMENT_METHOD_ID);
    const paymentOptionId = method?.selectedOptionId ?? method?.options[0]?.id;
    const built = buildCompletionInput({
      currentQuote,
      deliveryForm: form.deliveryForm,
      destination: form.destination,
      identificationForm: form.identificationForm,
      paymentMethodId: CARD_PAYMENT_METHOD_ID,
      paymentOptionId: paymentOptionId ?? "",
      sessionToken: current.checkoutSessionToken,
    });
    const lines = toCheckoutLineItemsFromQuote(currentQuote);
    const input: SubmitCardInput = {
      checkout: {
        customer: built.customer,
        items: lines,
        ...(built.address ? { address: built.address } : {}),
        ...(built.city ? { city: built.city } : {}),
        ...(built.couponCode ? { couponCode: built.couponCode } : {}),
        ...(built.deliveryType ? { deliveryType: built.deliveryType } : {}),
        ...(paymentOptionId ? { paymentOptionId } : {}),
        ...(built.pickupPointId ? { pickupPointId: built.pickupPointId } : {}),
        ...(built.postalCode ? { postalCode: built.postalCode } : {}),
        ...(built.province ? { province: built.province } : {}),
        ...(built.sessionToken ? { sessionToken: built.sessionToken } : {}),
        ...(built.shippingMethodId ? { shippingMethodId: built.shippingMethodId } : {}),
        ...(built.shippingProviderId ? { shippingProviderId: built.shippingProviderId } : {}),
      },
      formData,
      quoteId: currentQuote.quoteId,
      submittedLines: lines,
    };

    const view = await submitCard(input);
    // The store holds the user-facing error; throwing re-enables the Brick for a new explicit submission.
    if (!view) throw new Error("PAYMENT_NOT_PLACED");
    if (resolveBoundOrderMode(view) === BOUND_ORDER_MODE.RESULT) router.push(checkoutRoutes.result(view.orderId));
  }

  return { active, available, mountQuote: ready ? quote : null, ready, submit };
}
