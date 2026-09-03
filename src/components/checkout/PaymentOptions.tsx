"use client";

import Image from "next/image";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/pricing";
import { DATA_SOURCE, getCheckoutDataSource } from "@/lib/api/config";
import {
  type CheckoutPaymentMethod as ServerCheckoutPaymentMethod,
  type CheckoutPaymentOption,
} from "@/lib/api/checkout/checkout.repository";
import {
  checkoutPaymentMethods,
  type CheckoutPaymentMethodId,
} from "@/lib/data/checkout";
import { cn } from "@/lib/utils";
import { CHECKOUT_ASYNC_STATUS, useCartStore } from "@/stores/cart-store";

type PaymentOptionsProps = {
  selectedPaymentId: CheckoutPaymentMethodId;
  onSelectPayment: (id: CheckoutPaymentMethodId) => void;
};

type PaymentChoice = {
  acceptedMethods: readonly string[];
  description: string;
  helper: string;
  id: CheckoutPaymentMethodId;
  logoSrc: string;
  options: readonly CheckoutPaymentOption[];
  title: string;
};

export function PaymentOptions({ onSelectPayment, selectedPaymentId }: PaymentOptionsProps) {
  const quote = useCartStore((state) => state.quote);
  const quoteStatus = useCartStore((state) => state.quoteStatus);
  const quoteError = useCartStore((state) => state.quoteError);
  const quoteConflict = useCartStore((state) => state.quoteConflict);
  const quoteRetryAvailable = useCartStore((state) => state.quoteRetryAvailable);
  const retryQuote = useCartStore((state) => state.retryQuote);

  const serverQuote = quoteStatus === CHECKOUT_ASYNC_STATUS.SUCCESS ? quote : null;
  const operationError = quoteConflict ?? quoteError;
  const quoteLoading = quoteStatus === CHECKOUT_ASYNC_STATUS.LOADING;
  const isMockSource = getCheckoutDataSource() === DATA_SOURCE.MOCK;
  const paymentChoices = serverQuote
    ? serverQuote.paymentMethods.map(toServerPaymentChoice)
    : checkoutPaymentMethods.map(toMockPaymentChoice);
  const selectedServerMethod = serverQuote?.paymentMethods.find((method) => method.id === selectedPaymentId);
  const selectedPaymentUnavailable = Boolean(serverQuote && !selectedServerMethod);
  const selectedBankConfigurationMissing = Boolean(
    selectedServerMethod
      && selectedPaymentId === "bank-transfer"
      && !selectedServerMethod.bankConfig,
  );

  return (
    <div className="grid gap-3" aria-busy={quoteLoading}>
      {quoteLoading ? (
        <p className="flex items-center gap-2 text-sm text-text-muted" role="status">
          <LoaderCircle aria-hidden className="animate-spin" size={16} />
          Actualizando medios de pago y descuentos.
        </p>
      ) : null}

      {operationError ? (
        <div className="rounded-card border border-sale/40 bg-sale/10 p-3 text-sm text-sale" role="alert">
          <p>{operationError.message}</p>
          {quoteRetryAvailable ? (
            <button
              className="mt-2 inline-flex items-center gap-2 font-semibold underline underline-offset-2"
              onClick={() => void retryQuote()}
              type="button"
            >
              <RefreshCw aria-hidden size={14} />
              Reintentar validación
            </button>
          ) : null}
        </div>
      ) : null}

      {!serverQuote && !quoteLoading ? (
        <p className="rounded-card border border-border bg-background p-3 text-xs text-text-muted" role="status">
          {isMockSource
            ? "Mostramos medios mock para mantener la vista previa disponible."
            : "Los medios se muestran como referencia hasta que el servidor confirme la configuración."}
        </p>
      ) : null}

      <fieldset
        aria-describedby="checkout-payment-options-helper"
        aria-invalid={selectedPaymentUnavailable || selectedBankConfigurationMissing ? true : undefined}
        className="grid gap-3"
      >
        <legend className="font-subtitle text-lg font-bold uppercase text-text">Medio de pago*</legend>
        {paymentChoices.length > 0 ? paymentChoices.map((method) => {
          const selected = selectedPaymentId === method.id;

          return (
            <label
              className={cn(
                "cursor-pointer rounded-card border bg-surface p-4 text-left transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20",
                selected ? "border-accent ring-2 ring-accent/20" : "border-border hover:border-accent",
              )}
              key={method.id}
            >
              <input
                checked={selected}
                className="sr-only text-base md:text-sm"
                name="checkout-payment-method"
                onChange={() => onSelectPayment(method.id)}
                type="radio"
                value={method.id}
              />
              <span className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-4">
                  <span className="flex h-12 w-28 shrink-0 items-center justify-center">
                    <Image alt={method.title} className="max-h-9 max-w-24 object-contain" height={36} src={method.logoSrc} width={112} />
                  </span>
                  <strong className="font-subtitle text-base uppercase text-text">{method.title}</strong>
                </span>
              </span>
              <span className="mt-2 block text-sm text-text-muted">{method.description}</span>
              <span className="mt-1 block text-xs text-text-muted">{method.helper}</span>
              {method.options.length > 0 ? (
                <span className="mt-2 block text-xs font-medium text-text-muted">
                  Opciones confirmadas: {method.options.map((option) => `${option.fee} · ${option.receiveIn}`).join(" / ")}
                </span>
              ) : null}
            </label>
          );
        }) : (
          <p className="rounded-card border border-border bg-background p-3 text-sm text-text-muted">
            No hay medios de pago disponibles para esta cotización.
          </p>
        )}
        <p className="text-xs text-text-muted" id="checkout-payment-options-helper">
          {serverQuote ? "La disponibilidad y las opciones fueron confirmadas por el servidor." : "La disponibilidad final se confirmará al cotizar el pedido."}
        </p>
        {selectedPaymentUnavailable ? (
          <p className="text-sm font-medium text-sale" role="alert">El medio de pago seleccionado ya no está disponible. Elegí otro para continuar.</p>
        ) : null}
        {selectedBankConfigurationMissing ? (
          <p className="text-sm font-medium text-sale" role="alert">La configuración de transferencia bancaria no está disponible para esta cotización.</p>
        ) : null}
      </fieldset>

      {serverQuote && serverQuote.discount > 0 ? (
        <p className="rounded-card border border-accent/40 bg-accent-soft p-3 text-sm font-semibold text-accent-hover">
          Descuento confirmado por el servidor: -{formatCurrency(serverQuote.discount)}
          {serverQuote.coupon?.code ? ` · ${serverQuote.coupon.code}` : ""}.
        </p>
      ) : null}
    </div>
  );
}

function toMockPaymentChoice(method: (typeof checkoutPaymentMethods)[number]): PaymentChoice {
  return {
    acceptedMethods: [],
    description: method.description,
    helper: method.helper,
    id: method.id,
    logoSrc: method.logoSrc,
    options: [],
    title: method.title,
  };
}

function toServerPaymentChoice(method: ServerCheckoutPaymentMethod): PaymentChoice {
  const fallback = checkoutPaymentMethods.find((candidate) => candidate.id === method.id);
  const acceptedMethods = method.acceptedMethods.filter(Boolean);

  return {
    acceptedMethods,
    description: method.description,
    helper: acceptedMethods.length > 0
      ? `Medios aceptados: ${acceptedMethods.join(", ")}.`
      : "Configuración confirmada por el servidor.",
    id: method.id,
    logoSrc: method.logoSrc.startsWith("/") ? method.logoSrc : fallback?.logoSrc ?? "/transfer.svg",
    options: method.options,
    title: method.name,
  };
}
