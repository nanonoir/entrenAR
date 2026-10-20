"use client";

import Image from "next/image";

import {
  deliveryCardClass,
  formatShippingPrice,
  type ShippingChoice,
} from "@/components/checkout/delivery-options.utils";

export type ShippingOptionsProps = {
  errorText?: string;
  onSelectShipping: (selection: { id: string; providerId: string }) => void;
  /** A refreshing quote shows neutral prices instead of stale ones. */
  quoteLoading: boolean;
  quoteReady: boolean;
  selectedShippingId: string | null;
  selectedShippingUnavailable: boolean;
  shippingChoices: readonly ShippingChoice[];
};

export function ShippingOptions({
  errorText,
  onSelectShipping,
  quoteLoading,
  quoteReady,
  selectedShippingId,
  selectedShippingUnavailable,
  shippingChoices,
}: ShippingOptionsProps) {
  const describedBy = ["checkout-shipping-options-helper", errorText ? "checkout-shipping-options-error" : null]
    .filter(Boolean)
    .join(" ");

  return (
    <fieldset className="grid gap-3" aria-describedby={describedBy}>
      <legend className="font-subtitle text-lg font-bold uppercase text-text">Opción de envío*</legend>
      {quoteReady && shippingChoices.length > 0 ? shippingChoices.map((choice) => {
        const selected = choice.id === selectedShippingId;

        return (
          <label className={deliveryCardClass(selected)} key={choice.id}>
            <input
              checked={selected}
              className="sr-only text-base md:text-sm"
              name="checkout-shipping-option"
              onChange={() => onSelectShipping({ id: choice.id, providerId: choice.providerId })}
              type="radio"
              value={choice.id}
            />
            <span className="grid gap-3 sm:grid-cols-[96px_1fr_auto] sm:items-center">
              {choice.logoSrc ? (
                <Image alt="" className="h-8 w-auto object-contain" height={32} src={choice.logoSrc} width={96} />
              ) : <span aria-hidden />}
              <span>
                <strong className="block font-subtitle text-base text-text">{choice.carrierName}</strong>
                <span className="block text-xs text-text-muted">
                  {[choice.serviceLabel, choice.eta].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="font-subtitle text-base font-bold text-text">
                {quoteLoading ? "Calculando…" : formatShippingPrice(choice.price)}
              </span>
            </span>
          </label>
        );
      }) : (
        <p className="rounded-card border border-border bg-background p-3 text-sm text-text-muted">
          {quoteReady
            ? "No hay opciones de envío a domicilio disponibles para esta cotización."
            : "Completá tu código postal y localidad para ver las opciones de envío."}
        </p>
      )}
      <p className="text-xs text-text-muted" id="checkout-shipping-options-helper">
        {quoteReady ? "Opciones de envío a domicilio disponibles para tu pedido." : "El costo se calcula cuando elegís un servicio."}
      </p>
      {errorText ? <p className="text-xs font-medium text-sale" id="checkout-shipping-options-error">{errorText}</p> : null}
      {selectedShippingUnavailable && !quoteLoading ? (
        <p className="text-sm font-medium text-sale" role="alert">La opción de envío seleccionada ya no está disponible. Elegí otra para continuar.</p>
      ) : null}
    </fieldset>
  );
}
