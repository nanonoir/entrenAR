"use client";

import { create } from "zustand";
import { toCheckoutApiError } from "@/lib/api/checkout/client";
import {
  fetchActivePayment,
  payCheckoutWithCard,
  type CheckoutCardPaymentInput,
} from "@/lib/api/checkout/checkout-card-payment";
import type { CheckoutOperationError } from "@/lib/api/checkout/checkout.repository";
import { readDeviceId, toPaymentCardPayload } from "@/lib/api/payments/card-payload";
import { isUncertainPaymentError } from "@/lib/api/payments/payment-errors";
import { shouldClearSubmittedCart } from "@/lib/api/payments/payment-result";
import { fetchPaymentStatus, retryPayment } from "@/lib/api/payments/payments.api";
import type { PaymentView } from "@/lib/api/payments/payments.mappers";
import { resolveSubmissionKey, type SubmissionKeyState } from "@/lib/api/payments/submission-key";
import { captureCartGeneration, removeSubmittedGeneration, type CartGeneration } from "@/lib/cart-generation";
import { clearCheckoutDraft } from "@/lib/checkout-draft";
import {
  clearPaymentBinding,
  readPaymentBinding,
  writePaymentBinding,
  type PaymentBinding,
} from "@/lib/checkout-payment-binding";
import { createIdleCheckoutState, invalidateCheckoutRequests } from "@/stores/cart-checkout.actions";
import { useCartStore } from "@/stores/cart-store";

export type PaymentRecoveryStatus = "done" | "idle" | "loading";

export interface SubmitCardInput {
  /** Brick form data. Only allowlisted fields are read; `transaction_amount` is discarded. */
  formData: unknown;
  /** Selection and customer data built from the committed form; never contains card data. */
  checkout: Omit<CheckoutCardPaymentInput, "card" | "deviceId" | "idempotencyKey" | "quoteId">;
  /** Lines of the quote that was current when the Brick was mounted. */
  quoteId: string;
  submittedLines: readonly { productId: string; quantity: number; variantId?: string | undefined }[];
}

export interface CheckoutPaymentState {
  binding: PaymentBinding | null;
  error: CheckoutOperationError | null;
  /** The failed request may still have been accepted; the order must be re-checked before retrying. */
  errorUncertain: boolean;
  recovery: PaymentRecoveryStatus;
  recoveryFailed: boolean;
  submitting: boolean;
  view: PaymentView | null;
  acceptView: (view: PaymentView) => void;
  clearError: () => void;
  recover: () => Promise<PaymentView | null>;
  refresh: (signal?: AbortSignal) => Promise<PaymentView | null>;
  reset: () => void;
  retryCard: (formData: unknown) => Promise<PaymentView | null>;
  submitCard: (input: SubmitCardInput) => Promise<PaymentView | null>;
}

// Memory-only: the one-shot card token never reaches Zustand state, storage or logs.
let submitting = false;
let submissionKey: SubmissionKeyState | null = null;

const INITIAL_STATE = {
  binding: null,
  error: null,
  errorUncertain: false,
  recovery: "idle" as PaymentRecoveryStatus,
  recoveryFailed: false,
  submitting: false,
  view: null,
};

export const useCheckoutPaymentStore = create<CheckoutPaymentState>()((set, get) => {
  /** Single place where a backend view becomes UI state and, once verified, releases the submitted cart. */
  function applyView(view: PaymentView, fallback?: Pick<PaymentBinding, "generation" | "sessionToken">): void {
    let binding = get().binding ?? readPaymentBinding();
    if (!binding || (binding.orderId !== null && binding.orderId !== view.orderId)) {
      binding = {
        createdAt: Date.now(),
        finalized: false,
        generation: fallback?.generation ?? [],
        orderId: view.orderId,
        sessionToken: fallback?.sessionToken ?? useCartStore.getState().checkoutSessionToken,
      };
    } else if (binding.orderId === null) {
      binding = { ...binding, orderId: view.orderId };
    }

    if (shouldClearSubmittedCart(view) && !binding.finalized) {
      releaseSubmittedCart(binding.generation);
      binding = { ...binding, finalized: true };
    }

    writePaymentBinding(binding);
    set({ binding, view });
  }

  function currentSessionToken(): string | null {
    return get().binding?.sessionToken ?? useCartStore.getState().checkoutSessionToken;
  }

  return {
    ...INITIAL_STATE,
    acceptView: (view) => applyView(view),
    clearError: () => set({ error: null, errorUncertain: false }),
    recover: async () => {
      if (get().recovery === "loading") return get().view;
      const binding = get().binding ?? readPaymentBinding();
      set({ binding, recovery: "loading", recoveryFailed: false });

      try {
        const view = await fetchActivePayment({ sessionToken: binding?.sessionToken ?? useCartStore.getState().checkoutSessionToken });
        if (!view) {
          // A provisional binding with no backend order means the submission never placed one.
          if (binding && binding.orderId === null) {
            clearPaymentBinding();
            set({ binding: null });
          }
          set({ recovery: "done" });
          return null;
        }

        applyView(view);
        set({ recovery: "done" });
        return view;
      } catch {
        // A failed lookup must not block checkout, but a known pending submission is surfaced.
        set({ recovery: "done", recoveryFailed: binding !== null });
        return null;
      }
    },
    refresh: async (signal) => {
      const orderId = get().binding?.orderId ?? get().view?.orderId;
      if (!orderId) return null;

      try {
        const view = await fetchPaymentStatus(orderId, { sessionToken: currentSessionToken(), signal });
        applyView(view);
        return view;
      } catch {
        return null;
      }
    },
    reset: () => {
      submissionKey = null;
      clearPaymentBinding();
      set({ ...INITIAL_STATE, recovery: "done" });
    },
    retryCard: async (formData) => {
      const orderId = get().binding?.orderId ?? get().view?.orderId;
      if (submitting || !orderId) return null;
      submitting = true;
      set({ error: null, errorUncertain: false, submitting: true });

      try {
        const card = toPaymentCardPayload(formData);
        submissionKey = resolveSubmissionKey(submissionKey, card.token);
        const deviceId = readDeviceId();
        const view = await retryPayment(orderId, {
          card,
          idempotencyKey: submissionKey.key,
          ...(deviceId ? { deviceId } : {}),
          sessionToken: currentSessionToken(),
        });
        submissionKey = null;
        applyView(view);
        return view;
      } catch (error) {
        return failSubmission(set, error);
      } finally {
        submitting = false;
        set({ submitting: false });
      }
    },
    submitCard: async (input) => {
      if (submitting) return null;
      submitting = true;
      set({ error: null, errorUncertain: false, submitting: true });

      try {
        const card = toPaymentCardPayload(formData(input), input.checkout.customer.email);
        submissionKey = resolveSubmissionKey(submissionKey, card.token);
        const sessionToken = input.checkout.sessionToken ?? useCartStore.getState().checkoutSessionToken;
        const generation: CartGeneration = captureCartGeneration(input.submittedLines);

        // Provisional binding so a reload or lost response can still find the order.
        const provisional: PaymentBinding = { createdAt: Date.now(), finalized: false, generation, orderId: null, sessionToken: sessionToken ?? null };
        writePaymentBinding(provisional);
        set({ binding: provisional });

        const deviceId = readDeviceId();
        const request: CheckoutCardPaymentInput = {
          ...input.checkout,
          card,
          ...(deviceId ? { deviceId } : {}),
          idempotencyKey: submissionKey.key,
          quoteId: input.quoteId,
        };

        const view = await sendWithSingleNetworkRetry(request);
        submissionKey = null;
        applyView(view, { generation, sessionToken: sessionToken ?? null });
        return view;
      } catch (error) {
        const result = failSubmission(set, error);
        const failure = toCheckoutApiError(error);
        // A definitive rejection means no order exists: drop the provisional binding.
        if (!isUncertainPaymentError(failure)) {
          clearPaymentBinding();
          set({ binding: null });
        }
        return result;
      } finally {
        submitting = false;
        set({ submitting: false });
      }
    },
  };
});

function formData(input: SubmitCardInput): unknown {
  return input.formData;
}

/** The same submission (same key) is replayed once if the transport itself failed; the backend deduplicates. */
async function sendWithSingleNetworkRetry(request: CheckoutCardPaymentInput): Promise<PaymentView> {
  try {
    return await payCheckoutWithCard(request);
  } catch (error) {
    if (toCheckoutApiError(error).code !== "CHECKOUT_API_UNAVAILABLE") throw error;
    return payCheckoutWithCard(request);
  }
}

function failSubmission(set: (partial: Partial<CheckoutPaymentState>) => void, error: unknown): null {
  const failure = toCheckoutApiError(error, "CHECKOUT_PAYMENT_FAILED", "The payment could not be completed.");
  const uncertain = isUncertainPaymentError(failure);
  if (!uncertain) submissionKey = null;

  set({
    error: { code: failure.code, message: failure.message, ok: false, status: failure.status },
    errorUncertain: uncertain,
  });
  return null;
}

/** Removes only the submitted generation from the cart and clears the draft; callers guard it with `finalized`. */
function releaseSubmittedCart(generation: CartGeneration): void {
  invalidateCheckoutRequests();
  clearCheckoutDraft();
  useCartStore.setState((state) => ({
    items: removeSubmittedGeneration(state.items, generation),
    ...createIdleCheckoutState(null),
  }));
}
