"use client";

import { deliveryChoiceClass } from "@/components/checkout/delivery-options.utils";

export const DELIVERY_METHOD = {
  HOME: "home",
  PICKUP: "pickup",
} as const;

export type DeliveryMethod = (typeof DELIVERY_METHOD)[keyof typeof DELIVERY_METHOD] | null;

export type DeliveryMethodOptionsProps = {
  onSelectMethod: (method: DeliveryMethod) => void;
  selectedMethod: DeliveryMethod;
};

export function DeliveryMethodOptions({
  onSelectMethod,
  selectedMethod,
}: DeliveryMethodOptionsProps) {
  return (
    <fieldset className="grid gap-3" aria-describedby="checkout-delivery-method-helper">
      <legend className="font-subtitle text-lg font-bold uppercase text-text">Método de entrega*</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={deliveryChoiceClass(selectedMethod === DELIVERY_METHOD.HOME)}>
          <input
            checked={selectedMethod === DELIVERY_METHOD.HOME}
            className="sr-only text-base md:text-sm"
            name="checkout-delivery-method"
            onChange={() => onSelectMethod(DELIVERY_METHOD.HOME)}
            type="radio"
            value={DELIVERY_METHOD.HOME}
          />
          <span>Enviar a Domicilio</span>
        </label>
        <label className={deliveryChoiceClass(selectedMethod === DELIVERY_METHOD.PICKUP)}>
          <input
            checked={selectedMethod === DELIVERY_METHOD.PICKUP}
            className="sr-only text-base md:text-sm"
            name="checkout-delivery-method"
            onChange={() => onSelectMethod(DELIVERY_METHOD.PICKUP)}
            type="radio"
            value={DELIVERY_METHOD.PICKUP}
          />
          <span>Retirar por un Punto</span>
        </label>
      </div>
      <p className="text-xs text-text-muted" id="checkout-delivery-method-helper">
        Elegí cómo querés recibir tu pedido.
      </p>
    </fieldset>
  );
}
