import Image from "next/image";
import { Building2, Hash, Home, MapPin, User } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/pricing";
import {
  checkoutShippingProviders,
  type CheckoutPickupPoint,
  type CheckoutPostalCodeLocation,
  type CheckoutShippingProvider,
} from "@/lib/data/checkout";
import { cn } from "@/lib/utils";

type DeliveryMethod = "home" | "pickup" | null;

type DeliveryForm = {
  postalCode: string;
  street: string;
  streetNumber: string;
  floor: string;
  city: string;
  neighborhood: string;
  recipient: string;
};

type DeliveryOptionsProps = {
  errors: Partial<Record<keyof DeliveryForm, string>>;
  form: DeliveryForm;
  hasFreeShipping: boolean;
  location: CheckoutPostalCodeLocation | undefined;
  onFieldChange: (field: keyof DeliveryForm, value: string) => void;
  onSelectPickupPoint: (point: CheckoutPickupPoint) => void;
  selectedMethod: DeliveryMethod;
  selectedPickupPointId: string | null;
  selectedProviderId: string;
  onSelectMethod: (method: DeliveryMethod) => void;
  onSelectProvider: (provider: CheckoutShippingProvider) => void;
};

export function DeliveryOptions({
  errors,
  form,
  hasFreeShipping,
  location,
  onFieldChange,
  onSelectPickupPoint,
  onSelectMethod,
  onSelectProvider,
  selectedMethod,
  selectedPickupPointId,
  selectedProviderId,
}: DeliveryOptionsProps) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { id: "home", label: "Enviar a Domicilio" },
          { id: "pickup", label: "Retirar por un Punto" },
        ].map((method) => (
          <button
            className={cn(
              "rounded-card border p-4 text-left font-subtitle text-sm font-semibold uppercase transition",
              selectedMethod === method.id
                ? "border-accent bg-accent-soft text-accent-hover"
                : "border-border bg-surface hover:border-accent",
            )}
            key={method.id}
            onClick={() => onSelectMethod(method.id as DeliveryMethod)}
            type="button"
          >
            {method.label}
          </button>
        ))}
      </div>

      <Input
        errorText={errors.postalCode}
        helperText="Usamos este dato solo para mostrar opciones de envío de prueba."
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
            className={cn(
              "h-11 w-full rounded-button border border-border bg-surface px-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm",
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
          <span className="text-xs text-text-muted">La ciudad se habilita según el código postal ingresado.</span>
          {errors.city ? <span className="text-xs font-medium text-sale">{errors.city}</span> : null}
        </label>
      ) : null}

      {selectedMethod === "home" ? (
        <div className="grid gap-3">
          {checkoutShippingProviders.map((provider) => (
            <button
              className={cn(
                "grid gap-3 rounded-card border bg-surface p-4 text-left transition sm:grid-cols-[96px_1fr_auto] sm:items-center",
                selectedProviderId === provider.id ? "border-accent ring-2 ring-accent/20" : "border-border hover:border-accent",
              )}
              key={provider.id}
              onClick={() => onSelectProvider(provider)}
              type="button"
            >
              <Image alt={provider.name} className="h-8 w-auto object-contain" height={32} src={provider.logoSrc} width={96} />
              <span>
                <strong className="block font-subtitle text-base text-text">{provider.name}</strong>
                <span className="block text-xs text-text-muted">{provider.eta} · {provider.description}</span>
              </span>
              <span className="font-subtitle text-base font-bold text-text">
                {hasFreeShipping ? "Gratis" : formatCurrency(provider.price)}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {selectedMethod === "pickup" && location ? (
        <div className="grid gap-3">
          {location.pickupPoints.map((point) => (
            <button
              className={cn(
                "rounded-card border bg-surface p-4 text-left transition",
                selectedPickupPointId === point.id ? "border-accent ring-2 ring-accent/20" : "border-border hover:border-accent",
              )}
              key={point.id}
              onClick={() => onSelectPickupPoint(point)}
              type="button"
            >
              <strong className="block font-subtitle text-base uppercase text-text">{point.name}</strong>
              <span className="mt-1 block text-sm text-text-muted">{point.address}</span>
              <span className="mt-1 block text-xs text-text-muted">{point.eta}</span>
            </button>
          ))}
        </div>
      ) : null}

      {selectedMethod === "home" ? <div>
        <h3 className="font-subtitle text-lg font-bold uppercase text-text">Completa tu dirección de entrega</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input errorText={errors.street} helperText="Nombre de la calle." id="checkout-street" label="Calle*" onChange={(event) => onFieldChange("street", event.target.value)} trailingIcon={<Home aria-hidden size={16} />} value={form.street} />
          <Input errorText={errors.streetNumber} helperText="Número de puerta." id="checkout-number" label="Número*" onChange={(event) => onFieldChange("streetNumber", event.target.value)} trailingIcon={<Hash aria-hidden size={16} />} value={form.streetNumber} />
          <Input helperText="Opcional." id="checkout-floor" label="Piso/Departamento" onChange={(event) => onFieldChange("floor", event.target.value)} trailingIcon={<Building2 aria-hidden size={16} />} value={form.floor} />
          <Input helperText="Opcional." id="checkout-neighborhood" label="Barrio" onChange={(event) => onFieldChange("neighborhood", event.target.value)} trailingIcon={<MapPin aria-hidden size={16} />} value={form.neighborhood} />
          <Input helperText="Opcional: nombre de quien recibe." id="checkout-recipient" label="¿Quién recibe el pedido?" onChange={(event) => onFieldChange("recipient", event.target.value)} trailingIcon={<User aria-hidden size={16} />} value={form.recipient} />
        </div>
      </div> : null}
    </div>
  );
}
