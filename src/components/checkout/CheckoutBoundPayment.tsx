"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { CardPaymentBoundary } from "@/components/checkout/CardPaymentBoundary";
import { ChallengeFrame } from "@/components/checkout/ChallengeFrame";
import { PaymentErrorNotice } from "@/components/checkout/PaymentErrorNotice";
import { usePaymentStatusPolling, useRetryCountdown, useRetryWindowOpen } from "@/components/checkout/use-payment-status-polling";
import { Alert } from "@/components/ui/Alert";
import { Container } from "@/components/ui/Container";
import { BOUND_ORDER_MODE, resolveBoundOrderMode, retryBrickScope } from "@/lib/api/payments/payment-result";
import type { PaymentView } from "@/lib/api/payments/payments.mappers";
import { formatCurrency } from "@/lib/pricing";
import { checkoutRoutes } from "@/lib/routes";
import { useCheckoutPaymentStore } from "@/stores/checkout-payment-store";

interface CheckoutBoundPaymentProps {
  view: PaymentView;
}

/** Checkout view for an order that already exists: finish its 3DS challenge or retry the same order. */
export function CheckoutBoundPayment({ view }: CheckoutBoundPaymentProps) {
  const router = useRouter();
  const mode = resolveBoundOrderMode(view);
  const refresh = useCheckoutPaymentStore((state) => state.refresh);
  const retryCard = useCheckoutPaymentStore((state) => state.retryCard);
  const retryOpen = useRetryWindowOpen(mode === BOUND_ORDER_MODE.RETRY ? view.retry.until : null);

  usePaymentStatusPolling(mode === BOUND_ORDER_MODE.CHALLENGE);

  async function handleRetry(formData: unknown): Promise<void> {
    const next = await retryCard(formData);
    if (!next) throw new Error("PAYMENT_NOT_PLACED");
    if (resolveBoundOrderMode(next) === BOUND_ORDER_MODE.RESULT) router.push(checkoutRoutes.result(next.orderId));
  }

  return (
    <Container className="py-10" size="wide">
      <div className="mx-auto grid max-w-2xl gap-4">
        <h1 className="font-heading text-3xl font-bold text-text">Pedido {view.orderNumber}</h1>

        {mode === BOUND_ORDER_MODE.CHALLENGE && view.challenge ? (
          <>
            <div role="status">
              <Alert title="Verificá tu identidad con el banco" tone="info">
                Tu banco necesita confirmar este pago. Completá la verificación en el recuadro y esperá unos segundos: no cierres esta página.
              </Alert>
            </div>
            <ChallengeFrame onSignal={() => void refresh()} url={view.challenge.url} />
            <p className="flex items-center gap-2 text-sm text-text-muted">
              <LoaderCircle aria-hidden className="animate-spin" size={16} />
              Estamos esperando la confirmación.
            </p>
          </>
        ) : null}

        {mode === BOUND_ORDER_MODE.RETRY ? (
          <>
            <div role="alert">
              <Alert title="El pago fue rechazado" tone="danger">
                <p>Podés intentarlo de nuevo con otra tarjeta para el mismo pedido ({formatCurrency(view.amount)}).</p>
                <RetryCountdown until={view.retry.until} />
              </Alert>
            </div>
            <PaymentErrorNotice />
            {retryOpen ? (
              <CardPaymentBoundary
                amount={view.amount}
                onSubmit={handleRetry}
                scope={retryBrickScope(view)}
              />
            ) : (
              <button
                className="w-fit text-sm font-semibold text-accent underline underline-offset-2"
                onClick={() => void refresh()}
                type="button"
              >
                Actualizar estado
              </button>
            )}
          </>
        ) : null}
      </div>
    </Container>
  );
}

/** Owns the per-second tick so it never re-renders the card Brick above it. */
function RetryCountdown({ until }: { until: string | null }) {
  const secondsLeft = useRetryCountdown(until);
  return (
    <p className="mt-1 text-sm" role="timer">
      {secondsLeft > 0 ? `Tenés ${formatCountdown(secondsLeft)} para reintentar.` : "El tiempo para reintentar terminó."}
    </p>
  );
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}
