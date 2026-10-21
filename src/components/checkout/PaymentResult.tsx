"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { usePaymentStatusPolling, useRetryCountdown } from "@/components/checkout/use-payment-status-polling";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/LinkButton";
import { fetchPaymentStatus } from "@/lib/api/payments/payments.api";
import {
  isFinalPaymentResult,
  PAYMENT_RESULT_KIND,
  resolvePaymentResult,
  type PaymentResultKind,
} from "@/lib/api/payments/payment-result";
import type { PaymentView } from "@/lib/api/payments/payments.mappers";
import { getPaymentErrorMessage } from "@/lib/api/payments/payment-errors";
import { toCheckoutApiError } from "@/lib/api/checkout/client";
import { formatCurrency } from "@/lib/pricing";
import { checkoutRoutes } from "@/lib/routes";
import { useCartStore } from "@/stores/cart-store";
import { useCheckoutPaymentStore } from "@/stores/checkout-payment-store";

interface PaymentResultProps {
  orderId: string;
}

type Tone = "danger" | "info" | "success" | "warning";

const COPY: Record<PaymentResultKind, { body: string; title: string; tone: Tone }> = {
  [PAYMENT_RESULT_KIND.ACTION_REQUIRED]: {
    body: "Tu banco necesita confirmar el pago. Volvé al checkout para completar la verificación.",
    title: "Falta confirmar el pago",
    tone: "warning",
  },
  [PAYMENT_RESULT_KIND.APPROVED]: {
    body: "Recibimos tu pago y tu pedido está confirmado. Te enviaremos novedades por email.",
    title: "¡Pago aprobado!",
    tone: "success",
  },
  [PAYMENT_RESULT_KIND.ATTENTION]: {
    body: "Este pago fue revertido. Si no lo esperabas, escribinos con tu número de pedido.",
    title: "El pago requiere atención",
    tone: "warning",
  },
  [PAYMENT_RESULT_KIND.ENDED]: {
    body: "El pedido venció o fue cancelado y no se realizó ningún cobro. Podés iniciar una compra nueva.",
    title: "El pedido ya no está activo",
    tone: "info",
  },
  [PAYMENT_RESULT_KIND.PROCESSING]: {
    body: "Tu pago está siendo procesado o revisado. Esta página se actualiza sola; te avisaremos por email cuando se confirme.",
    title: "Estamos procesando tu pago",
    tone: "info",
  },
  [PAYMENT_RESULT_KIND.REJECTED]: {
    body: "El pago fue rechazado y no se realizó ningún cobro.",
    title: "El pago fue rechazado",
    tone: "danger",
  },
  [PAYMENT_RESULT_KIND.VERIFYING]: {
    body: "Todavía no tenemos la confirmación final. No vuelvas a pagar: estamos verificando el estado de tu pedido.",
    title: "Estamos verificando tu pago",
    tone: "info",
  },
};

/** Result of an order, derived only from the backend status; query parameters are never read. */
export function PaymentResult({ orderId }: PaymentResultProps) {
  const storeView = useCheckoutPaymentStore((state) => state.view);
  const acceptView = useCheckoutPaymentStore((state) => state.acceptView);
  const reset = useCheckoutPaymentStore((state) => state.reset);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const view = storeView?.orderId === orderId ? storeView : null;
  const kind = view ? resolvePaymentResult(view) : null;
  const final = kind !== null && isFinalPaymentResult(kind);
  const finalRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    finalRef.current = final;
  }, [final]);

  useEffect(() => {
    const controller = new AbortController();
    const { binding } = useCheckoutPaymentStore.getState();
    const sessionToken = binding?.sessionToken ?? useCartStore.getState().checkoutSessionToken;

    fetchPaymentStatus(orderId, { sessionToken, signal: controller.signal })
      .then((loaded) => {
        setLoadError(null);
        acceptView(loaded);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(getPaymentErrorMessage(toCheckoutApiError(error)));
      });

    return () => controller.abort();
  }, [acceptView, attempt, orderId]);

  useEffect(() => {
    // A finished order must not keep resurrecting the result when the customer returns to checkout.
    return () => {
      if (finalRef.current) reset();
    };
  }, [reset]);

  useEffect(() => {
    if (kind) headingRef.current?.focus();
  }, [kind]);

  usePaymentStatusPolling(Boolean(view) && !final);

  if (!view || !kind) {
    return (
      <Container className="py-10" size="wide">
        <div className="mx-auto max-w-2xl">
          {loadError ? (
            <div role="alert">
              <Alert title="No pudimos cargar el pedido" tone="danger">
                <p>{loadError}</p>
                <Button className="mt-3" onClick={() => setAttempt((current) => current + 1)} size="sm" variant="secondary">
                  Reintentar
                </Button>
              </Alert>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-text-muted" role="status">
              <LoaderCircle aria-hidden className="animate-spin" size={16} />
              Verificando el estado de tu pedido…
            </p>
          )}
        </div>
      </Container>
    );
  }

  const copy = COPY[kind];

  return (
    <Container className="py-10" size="wide">
      <div className="mx-auto grid max-w-2xl gap-4">
        <h1 className="font-heading text-3xl font-bold text-text outline-none" ref={headingRef} tabIndex={-1}>
          Pedido {view.orderNumber}
        </h1>
        <div aria-live="polite" role="status">
          <Alert title={copy.title} tone={copy.tone}>
            <p>{copy.body}</p>
            <p className="mt-2 text-sm">Total del pedido: <strong>{formatCurrency(view.amount)}</strong></p>
            {!final ? (
              <p className="mt-2 flex items-center gap-2 text-sm">
                <LoaderCircle aria-hidden className="animate-spin" size={14} />
                Actualizando…
              </p>
            ) : null}
          </Alert>
        </div>
        <ResultActions kind={kind} view={view} />
      </div>
    </Container>
  );
}

function ResultActions({ kind, view }: { kind: PaymentResultKind; view: PaymentView }) {
  const reset = useCheckoutPaymentStore((state) => state.reset);
  const secondsLeft = useRetryCountdown(kind === PAYMENT_RESULT_KIND.REJECTED ? view.retry.until : null);

  if (kind === PAYMENT_RESULT_KIND.ACTION_REQUIRED) {
    return <LinkButton className="w-fit" href={checkoutRoutes.checkout}>Continuar la verificación</LinkButton>;
  }

  if (kind === PAYMENT_RESULT_KIND.REJECTED) {
    const canRetry = view.retry.eligible && secondsLeft > 0;

    return (
      <div className="grid gap-3">
        {canRetry ? (
          <>
            <p className="text-sm text-text-muted" role="timer">
              Podés reintentar con otra tarjeta durante {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}.
            </p>
            <LinkButton className="w-fit" href={checkoutRoutes.checkout}>Reintentar el pago</LinkButton>
          </>
        ) : (
          <>
            <p className="text-sm text-text-muted">Ya no se puede reintentar este pedido. Iniciá una compra nueva.</p>
            <LinkButton className="w-fit" href={checkoutRoutes.checkout} onClick={reset}>Iniciar nueva compra</LinkButton>
          </>
        )}
      </div>
    );
  }

  if (kind === PAYMENT_RESULT_KIND.ENDED) {
    return <LinkButton className="w-fit" href={checkoutRoutes.checkout} onClick={reset}>Iniciar nueva compra</LinkButton>;
  }

  return <LinkButton className="w-fit" href="/" variant="secondary">Seguir comprando</LinkButton>;
}
