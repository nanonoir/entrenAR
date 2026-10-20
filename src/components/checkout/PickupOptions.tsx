"use client";

import {
  deliveryCardClass,
  type PickupChoice,
} from "@/components/checkout/delivery-options.utils";

export type PickupOptionsProps = {
  errorText?: string;
  onSelectPickupPoint: (id: string) => void;
  pickupChoices: readonly PickupChoice[];
  quoteReady: boolean;
  selectedPickupPointId: string | null;
  selectedPickupUnavailable: boolean;
};

export function PickupOptions({
  errorText,
  onSelectPickupPoint,
  pickupChoices,
  quoteReady,
  selectedPickupPointId,
  selectedPickupUnavailable,
}: PickupOptionsProps) {
  const describedBy = ["checkout-pickup-options-helper", errorText ? "checkout-pickup-options-error" : null]
    .filter(Boolean)
    .join(" ");

  return (
    <fieldset className="grid gap-3" aria-describedby={describedBy}>
      <legend className="font-subtitle text-lg font-bold uppercase text-text">Punto de retiro*</legend>
      {pickupChoices.length > 0 ? pickupChoices.map((choice) => {
        const selected = choice.id === selectedPickupPointId;

        return (
          <label className={deliveryCardClass(selected)} key={choice.id}>
            <input
              checked={selected}
              className="sr-only text-base md:text-sm"
              name="checkout-pickup-point"
              onChange={() => onSelectPickupPoint(choice.id)}
              type="radio"
              value={choice.id}
            />
            <span>
              <strong className="block font-subtitle text-base uppercase text-text">{choice.name}</strong>
              <span className="mt-1 block text-sm text-text-muted">{choice.address}</span>
              <span className="mt-1 block text-xs text-text-muted">{choice.eta}</span>
            </span>
          </label>
        );
      }) : (
        <p className="rounded-card border border-border bg-background p-3 text-sm text-text-muted">
          {quoteReady
            ? "No hay puntos de retiro disponibles para tu ubicación."
            : "Ingresá tu provincia y código postal para consultar puntos de retiro."}
        </p>
      )}
      <p className="text-xs text-text-muted" id="checkout-pickup-options-helper">
        {quoteReady ? "Puntos de retiro disponibles para tu pedido." : "La disponibilidad final se confirma al cotizar el pedido."}
      </p>
      {errorText ? <p className="text-xs font-medium text-sale" id="checkout-pickup-options-error">{errorText}</p> : null}
      {selectedPickupUnavailable ? (
        <p className="text-sm font-medium text-sale" role="alert">El punto de retiro seleccionado ya no está disponible. Elegí otro para continuar.</p>
      ) : null}
    </fieldset>
  );
}
