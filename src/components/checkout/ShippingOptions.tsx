"use client";

import Image from "next/image";

import type { CheckoutQuote } from "@/lib/api/checkout/checkout.repository";
import type { CheckoutShippingProvider } from "@/lib/data/checkout";
import { formatCurrency } from "@/lib/pricing";
import {
  deliveryCardClass,
  isShippingChoiceSelected,
  type ShippingChoice,
} from "@/components/checkout/delivery-options.utils";

export type ShippingOptionsProps = {
  hasFreeShipping: boolean;
  onSelectProvider: (provider: CheckoutShippingProvider) => void;
  selectedProviderId: string;
  selectedShippingUnavailable: boolean;
  serverQuote: CheckoutQuote | null;
  shippingChoices: readonly ShippingChoice[];
};

export function ShippingOptions({
  hasFreeShipping,
  onSelectProvider,
  selectedProviderId,
  selectedShippingUnavailable,
  serverQuote,
  shippingChoices,
}: ShippingOptionsProps) {
  return (
    <fieldset className="grid gap-3" aria-describedby="checkout-shipping-options-helper">
      <legend className="font-subtitle text-lg font-bold uppercase text-text">Opción de envío*</legend>
      {shippingChoices.length > 0 ? shippingChoices.map((choice) => (
        <label
          className={deliveryCardClass(isShippingChoiceSelected(choice, selectedProviderId))}
          key={`${choice.id}-${choice.label}`}
        >
          <input
            checked={isShippingChoiceSelected(choice, selectedProviderId)}
            className="sr-only text-base md:text-sm"
            name="checkout-shipping-option"
            onChange={() => onSelectProvider(choice.provider)}
            type="radio"
            value={choice.id}
          />
          <span className="grid gap-3 sm:grid-cols-[96px_1fr_auto] sm:items-center">
            <Image alt={choice.provider.name} className="h-8 w-auto object-contain" height={32} src={choice.logoSrc} width={96} />
            <span>
              <strong className="block font-subtitle text-base text-text">{choice.label}</strong>
              <span className="block text-xs text-text-muted">{choice.eta} · {choice.description}</span>
            </span>
            <span className="font-subtitle text-base font-bold text-text">
              {serverQuote ? (choice.price === 0 ? "Gratis" : formatCurrency(choice.price)) : (hasFreeShipping ? "Gratis" : formatCurrency(choice.price))}
            </span>
          </span>
        </label>
      )) : (
        <p className="rounded-card border border-border bg-background p-3 text-sm text-text-muted">
          No hay opciones de envío disponibles para esta cotización.
        </p>
      )}
      <p className="text-xs text-text-muted" id="checkout-shipping-options-helper">
        {serverQuote ? "Estas opciones fueron confirmadas por el servidor." : "La cotización final confirmará costo y disponibilidad."}
      </p>
      {selectedShippingUnavailable ? (
        <p className="text-sm font-medium text-sale" role="alert">La opción de envío seleccionada ya no está disponible. Elegí otra para continuar.</p>
      ) : null}
    </fieldset>
  );
}
