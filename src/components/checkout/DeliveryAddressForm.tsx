"use client";

import { Building2, Hash, Home, MapPin, User } from "lucide-react";
import { DELIVERY_METHOD, type DeliveryMethod } from "@/components/checkout/DeliveryMethodOptions";
import { LocalityField } from "@/components/checkout/LocalityField";
import type { DeliveryErrors, DeliveryForm, FieldErrors } from "@/components/checkout/checkout-form.validators";
import { Input } from "@/components/ui/Input";
import { FLOOR_MAX_LENGTH, NEIGHBORHOOD_MAX_LENGTH, STREET_MAX_LENGTH } from "@/lib/checkout-validation";
import type { CheckoutLocality } from "@/lib/data/locations/localities";
import { POSTAL_CODE_MAX_LENGTH, recognizeProvinceFromPostalCode } from "@/lib/data/locations/postal-code";
import { CHECKOUT_PROVINCES, findProvinceById } from "@/lib/data/locations/provinces";
import type { CheckoutPostalCodeLocation } from "@/lib/data/checkout";
import { cn } from "@/lib/utils";

type StructuredDeliveryAddressFormProps = {
  errors: DeliveryErrors;
  form: DeliveryForm;
  onBlurField: (field: keyof DeliveryForm) => void;
  onFieldChange: (field: keyof DeliveryForm, value: string) => void;
  onModeChange: (mode: DeliveryForm["localityMode"]) => void;
  onSelectLocality: (locality: CheckoutLocality) => void;
  onSelectProvince: (provinceId: string) => void;
  selectedMethod: DeliveryMethod;
};

type LegacyDeliveryAddressFormProps = {
  errors: FieldErrors<DeliveryForm>;
  form: DeliveryForm;
  location: CheckoutPostalCodeLocation | undefined;
  onFieldChange: (field: keyof DeliveryForm, value: string) => void;
  selectedMethod: DeliveryMethod;
};

export type DeliveryAddressFormProps = StructuredDeliveryAddressFormProps | LegacyDeliveryAddressFormProps;

/** Keeps the existing DeliveryOptions caller valid until the exact-selection UI migration lands. */
export function DeliveryAddressForm(props: DeliveryAddressFormProps) {
  if ("location" in props) return <LegacyDeliveryAddressForm {...props} />;
  return <StructuredDeliveryAddressForm {...props} />;
}

function StructuredDeliveryAddressForm({
  errors,
  form,
  onBlurField,
  onFieldChange,
  onModeChange,
  onSelectLocality,
  onSelectProvince,
  selectedMethod,
}: StructuredDeliveryAddressFormProps) {
  const recognizedProvince = findProvinceById(recognizeProvinceFromPostalCode(form.postalCode).provinceId ?? "");
  const postalHelper = recognizedProvince
    ? `Reconocimos la provincia: ${recognizedProvince.name}.`
    : "Usamos este dato para confirmar las opciones de entrega disponibles.";
  const provinceDescribedBy = ["checkout-province-helper", errors.provinceId ? "checkout-province-error" : null].filter(Boolean).join(" ");

  return (
    <>
      <Input
        autoCapitalize="characters"
        autoComplete="postal-code"
        errorText={errors.postalCode}
        helperText={postalHelper}
        id="checkout-postal-code"
        inputMode="text"
        label="Código postal*"
        maxLength={POSTAL_CODE_MAX_LENGTH}
        onBlur={() => onBlurField("postalCode")}
        onChange={(event) => onFieldChange("postalCode", event.target.value)}
        placeholder="Ej: 1406 o C1406ABC"
        trailingIcon={<MapPin aria-hidden size={16} />}
        value={form.postalCode}
      />

      <label className="grid gap-2 text-sm font-medium text-text" htmlFor="checkout-province">
        <span>Provincia*</span>
        <select
          aria-describedby={provinceDescribedBy}
          aria-invalid={errors.provinceId ? true : undefined}
          className={cn(
            "h-11 w-full rounded-button border border-border bg-surface px-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm",
            errors.provinceId && "border-sale focus:border-sale focus:ring-sale/20",
          )}
          id="checkout-province"
          onBlur={() => onBlurField("provinceId")}
          onChange={(event) => onSelectProvince(event.target.value)}
          value={form.provinceId}
        >
          <option value="">Seleccioná una provincia</option>
          {CHECKOUT_PROVINCES.map((province) => (
            <option key={province.id} value={province.id}>{province.name}</option>
          ))}
        </select>
        <span className="text-xs text-text-muted" id="checkout-province-helper">
          Podés elegirla o la reconocemos a partir del código postal.
        </span>
        {errors.provinceId ? <span className="text-xs font-medium text-sale" id="checkout-province-error">{errors.provinceId}</span> : null}
      </label>

      <LocalityField
        errorText={errors.city}
        form={form}
        onBlur={() => onBlurField("city")}
        onManualChange={(value) => onFieldChange("city", value)}
        onModeChange={onModeChange}
        onSelect={onSelectLocality}
      />

      {selectedMethod === DELIVERY_METHOD.HOME ? (
        <div>
          <h3 className="font-subtitle text-lg font-bold uppercase text-text">Completá tu dirección de entrega</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input errorText={errors.street} helperText="Nombre de la calle." id="checkout-street" label="Calle*" maxLength={STREET_MAX_LENGTH} onBlur={() => onBlurField("street")} onChange={(event) => onFieldChange("street", event.target.value)} trailingIcon={<Home aria-hidden size={16} />} value={form.street} />
            <Input errorText={errors.streetNumber} helperText="Número de puerta." id="checkout-number" label="Número*" onBlur={() => onBlurField("streetNumber")} onChange={(event) => onFieldChange("streetNumber", event.target.value)} trailingIcon={<Hash aria-hidden size={16} />} value={form.streetNumber} />
            <Input errorText={errors.floor} helperText="Opcional." id="checkout-floor" label="Piso/Departamento" maxLength={FLOOR_MAX_LENGTH} onBlur={() => onBlurField("floor")} onChange={(event) => onFieldChange("floor", event.target.value)} trailingIcon={<Building2 aria-hidden size={16} />} value={form.floor} />
            <Input errorText={errors.neighborhood} helperText="Opcional." id="checkout-neighborhood" label="Barrio" maxLength={NEIGHBORHOOD_MAX_LENGTH} onBlur={() => onBlurField("neighborhood")} onChange={(event) => onFieldChange("neighborhood", event.target.value)} trailingIcon={<MapPin aria-hidden size={16} />} value={form.neighborhood} />
            <Input errorText={errors.recipient} helperText="Opcional: nombre de quien recibe." id="checkout-recipient" label="¿Quién recibe el pedido?" onBlur={() => onBlurField("recipient")} onChange={(event) => onFieldChange("recipient", event.target.value)} trailingIcon={<User aria-hidden size={16} />} value={form.recipient} />
          </div>
        </div>
      ) : null}
    </>
  );
}

function LegacyDeliveryAddressForm({ errors, form, location, onFieldChange, selectedMethod }: LegacyDeliveryAddressFormProps) {
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
        <p className="text-sm font-medium text-sale">No tenemos opciones de entrega para este código postal.</p>
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
            {location.cities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
          <span className="text-xs text-text-muted" id="checkout-city-helper">La ciudad se habilita según el código postal ingresado.</span>
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
