"use client";

import { useState, useSyncExternalStore } from "react";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";
import { LoaderCircle } from "lucide-react";
import { getMercadoPagoPublicKey } from "@/components/checkout/use-checkout-card-payment";
import { Alert } from "@/components/ui/Alert";

interface CardPaymentBoundaryProps {
  /** Amount the Brick displays; the backend always recomputes the charge from the quote. */
  amount: number;
  quoteId: string;
  /** Resolves when the payment was placed and throws otherwise so the Brick re-enables its button. */
  onSubmit: (quoteId: string, formData: unknown) => Promise<void>;
}

let sdkInitialized = false;

function subscribeNever(): () => void {
  return () => undefined;
}

function ensureSdk(): boolean {
  const publicKey = getMercadoPagoPublicKey();
  if (!publicKey) return false;
  if (!sdkInitialized) {
    initMercadoPago(publicKey, { locale: "es-AR" });
    sdkInitialized = true;
  }
  return true;
}

/**
 * The only card pay action. The `key` remounts the Brick whenever the quote or its amount changes,
 * so a stale amount is never combined with a new quote.
 */
export function CardPaymentBoundary(props: CardPaymentBoundaryProps) {
  return <CardPaymentBrick key={`${props.quoteId}:${props.amount}`} {...props} />;
}

function CardPaymentBrick({ amount, onSubmit, quoteId }: CardPaymentBoundaryProps) {
  // Client-only: the SDK touches `window`, so it is initialized only after hydration.
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  const [ready, setReady] = useState(false);
  const [sdkFailed, setSdkFailed] = useState(false);
  const mounted = hydrated && ensureSdk();
  const loadFailed = sdkFailed || (hydrated && !mounted);

  if (loadFailed) {
    return (
      <div role="alert">
        <Alert title="Pago con tarjeta no disponible" tone="warning">
          No pudimos cargar el formulario de tarjeta. Elegí otro medio de pago o intentá más tarde.
        </Alert>
      </div>
    );
  }

  return (
    <div aria-busy={!ready} className="grid gap-3">
      {!ready ? (
        <p className="flex items-center gap-2 text-sm text-text-muted" role="status">
          <LoaderCircle aria-hidden className="animate-spin" size={16} />
          Cargando formulario de tarjeta…
        </p>
      ) : null}
      {mounted ? (
        <CardPayment
          customization={{ paymentMethods: { maxInstallments: 12, minInstallments: 1 }, visual: { hidePaymentButton: false } }}
          initialization={{ amount }}
          locale="es-AR"
          onError={() => setSdkFailed(true)}
          onReady={() => setReady(true)}
          onSubmit={async (formData) => onSubmit(quoteId, formData)}
        />
      ) : null}
    </div>
  );
}
