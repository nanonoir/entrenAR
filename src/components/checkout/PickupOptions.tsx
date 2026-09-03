"use client";

import type { CheckoutQuote } from "@/lib/api/checkout/checkout.repository";
import {
  deliveryCardClass,
  isPickupChoiceSelected,
  type PickupChoice,
} from "@/components/checkout/delivery-options.utils";
import type { CheckoutPickupPoint as MockCheckoutPickupPoint } from "@/lib/data/checkout";

export type PickupOptionsProps = {
  onSelectPickupPoint: (point: MockCheckoutPickupPoint) => void;
  pickupChoices: readonly PickupChoice[];
  selectedPickupPointId: string | null;
  selectedPickupUnavailable: boolean;
  serverQuote: CheckoutQuote | null;
};

export function PickupOptions({
  onSelectPickupPoint,
  pickupChoices,
  selectedPickupPointId,
  selectedPickupUnavailable,
  serverQuote,
}: PickupOptionsProps) {
  return (
    <fieldset className="grid gap-3" aria-describedby="checkout-pickup-options-helper">
      <legend className="font-subtitle text-lg font-bold uppercase text-text">Punto de retiro*</legend>
      {pickupChoices.length > 0 ? pickupChoices.map((choice) => (
        <label className={deliveryCardClass(isPickupChoiceSelected(choice, selectedPickupPointId))} key={choice.id}>
          <input
            checked={isPickupChoiceSelected(choice, selectedPickupPointId)}
            className="sr-only text-base md:text-sm"
            name="checkout-pickup-point"
            onChange={() => onSelectPickupPoint(choice.point)}
            type="radio"
            value={choice.id}
          />
          <span>
            <strong className="block font-subtitle text-base uppercase text-text">{choice.name}</strong>
            <span className="mt-1 block text-sm text-text-muted">{choice.address}</span>
            <span className="mt-1 block text-xs text-text-muted">{choice.eta}</span>
          </span>
        </label>
      )) : (
        <p className="rounded-card border border-border bg-background p-3 text-sm text-text-muted">
          Ingresá un código postal válido para consultar puntos de retiro.
        </p>
      )}
      <p className="text-xs text-text-muted" id="checkout-pickup-options-helper">
        {serverQuote ? "Estos puntos fueron confirmados por el servidor." : "Los puntos disponibles pertenecen a la configuración mock."}
      </p>
      {selectedPickupUnavailable ? (
        <p className="text-sm font-medium text-sale" role="alert">El punto de retiro seleccionado ya no está disponible. Elegí otro para continuar.</p>
      ) : null}
    </fieldset>
  );
}
