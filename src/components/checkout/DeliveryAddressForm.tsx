"use client";

import { Building2, Hash, Home, MapPin, User } from "lucide-react";
import { DELIVERY_METHOD, type DeliveryMethod } from "@/components/checkout/DeliveryMethodOptions";
import type { DeliveryForm, FieldErrors } from "@/components/checkout/checkout-form.validators";
import { Input } from "@/components/ui/Input";
import type { CheckoutPostalCodeLocation } from "@/lib/data/checkout";
import { cn } from "@/lib/utils";

export type DeliveryAddressFormProps = {
  errors: FieldErrors<DeliveryForm>;
  form: DeliveryForm;
  location: CheckoutPostalCodeLocation | undefined;
  onFieldChange: (field: keyof DeliveryForm, value: string) => void;
  selectedMethod: DeliveryMethod;
};

export function DeliveryAddressForm({
  errors,
  form,
  location,
  onFieldChange,
  selectedMethod,
}: DeliveryAddressFormProps) {
  return (
    <>
      <Input
        errorText={errors.postalCode}
        helperText="Usamos este dato para confirmar las opciones de entrega disponibles."
        id="checkout-postal-code"
        inputMode="numeric"
        label="Código postal*"
        onChange={(event) => onFieldChange("postalCode", event.target.value)}
        trailingIcon={<MapPin aria-hidden size={16} />}
        value={form.postalCode}
      />

      {location ? (
        <div className="rounded-card border border-border bg-background p-4 text-sm text-text-muted">
          Provincia detectada: <strong className="text-text">{location.province}</strong>
        </div>
      ) : form.postalCode ? (
        <p className="text-sm font-medium text-sale">No tenemos datos mock para este código postal.</p>
      ) : null}

      {location ? (
        <label className="grid gap-2 text-sm font-medium text-text" htmlFor="checkout-city">
          <span>Ciudad*</span>
          <select
            aria-describedby={errors.city ? "checkout-city-helper checkout-city-error" : "checkout-city-helper"}
            aria-invalid={errors.city ? true : undefined}
            className={cn(
              "h-11 w-full rounded-button border border-border bg-surface px-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm",
              errors.city && "border-sale focus:border-sale focus:ring-sale/20",
            )}
            id="checkout-city"
            onChange={(event) => onFieldChange("city", event.target.value)}
            value={form.city}
          >
            <option value="">Seleccioná una ciudad</option>
            {location.cities.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
          <span className="text-xs text-text-muted" id="checkout-city-helper">
            La ciudad se habilita según el código postal ingresado.
          </span>
          {errors.city ? <span className="text-xs font-medium text-sale" id="checkout-city-error">{errors.city}</span> : null}
        </label>
      ) : null}

      {selectedMethod === DELIVERY_METHOD.HOME ? (
        <div>
          <h3 className="font-subtitle text-lg font-bold uppercase text-text">Completá tu dirección de entrega</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input errorText={errors.street} helperText="Nombre de la calle." id="checkout-street" label="Calle*" onChange={(event) => onFieldChange("street", event.target.value)} trailingIcon={<Home aria-hidden size={16} />} value={form.street} />
            <Input errorText={errors.streetNumber} helperText="Número de puerta." id="checkout-number" label="Número*" onChange={(event) => onFieldChange("streetNumber", event.target.value)} trailingIcon={<Hash aria-hidden size={16} />} value={form.streetNumber} />
            <Input helperText="Opcional." id="checkout-floor" label="Piso/Departamento" onChange={(event) => onFieldChange("floor", event.target.value)} trailingIcon={<Building2 aria-hidden size={16} />} value={form.floor} />
            <Input helperText="Opcional." id="checkout-neighborhood" label="Barrio" onChange={(event) => onFieldChange("neighborhood", event.target.value)} trailingIcon={<MapPin aria-hidden size={16} />} value={form.neighborhood} />
            <Input helperText="Opcional: nombre de quien recibe." id="checkout-recipient" label="¿Quién recibe el pedido?" onChange={(event) => onFieldChange("recipient", event.target.value)} trailingIcon={<User aria-hidden size={16} />} value={form.recipient} />
          </div>
        </div>
      ) : null}
    </>
  );
}
