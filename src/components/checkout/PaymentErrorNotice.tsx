"use client";

import { RefreshCw } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { getPaymentErrorMessage, isStaleQuotePaymentError } from "@/lib/api/payments/payment-errors";
import { useCheckoutPaymentStore } from "@/stores/checkout-payment-store";

interface PaymentErrorNoticeProps {
  onRefreshQuote?: () => void | Promise<unknown>;
}

/** Shows the last card-submission failure; an uncertain one offers a status check instead of a blind retry. */
export function PaymentErrorNotice({ onRefreshQuote }: PaymentErrorNoticeProps) {
  const error = useCheckoutPaymentStore((state) => state.error);
  const uncertain = useCheckoutPaymentStore((state) => state.errorUncertain);
  const recover = useCheckoutPaymentStore((state) => state.recover);
  const clearError = useCheckoutPaymentStore((state) => state.clearError);

  if (!error) return null;

  return (
    <div role="alert">
      <Alert title={uncertain ? "No pudimos confirmar el pago" : "No pudimos procesar el pago"} tone="danger">
        <p>{getPaymentErrorMessage(error)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {uncertain ? (
            <Button
              onClick={() => {
                clearError();
                void recover();
              }}
              size="sm"
              variant="secondary"
            >
              <RefreshCw aria-hidden className="mr-2 inline" size={14} />
              Verificar estado del pago
            </Button>
          ) : null}
          {!uncertain && onRefreshQuote && isStaleQuotePaymentError(error) ? (
            <Button
              onClick={() => {
                clearError();
                void onRefreshQuote();
              }}
              size="sm"
              variant="secondary"
            >
              <RefreshCw aria-hidden className="mr-2 inline" size={14} />
              Actualizar cotización
            </Button>
          ) : null}
        </div>
      </Alert>
    </div>
  );
}
