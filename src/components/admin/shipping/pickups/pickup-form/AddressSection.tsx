"use client";

import { PickupInput, PickupSection } from "@/components/admin/shipping/pickups/pickup-form/PickupFormField";
import { normalizeDigitsOnly, normalizeNameLike, normalizePhone, normalizePostalCode, normalizeStreetLike } from "@/schemas/admin/shipping-schemas";

export function AddressSection() {
  return <PickupSection title="Dirección" description="Ubicación visible para preparar retiros."><div className="grid gap-4 md:grid-cols-2"><PickupInput name="name" label="Nombre del punto" helperText="Ejemplo: Local Palermo." normalize={normalizeNameLike} /><PickupInput name="address.street" label="Calle" helperText="Nombre de la calle." normalize={normalizeStreetLike} /><PickupInput name="address.number" label="Número" helperText="Altura." normalize={normalizeDigitsOnly} /><PickupInput name="address.city" label="Ciudad" helperText="Localidad." normalize={normalizeNameLike} /><PickupInput name="address.province" label="Provincia" helperText="Provincia argentina." normalize={normalizeNameLike} /><PickupInput name="address.postalCode" label="Código postal" helperText="Ejemplo: C1425 o 1425." normalize={normalizePostalCode} /><PickupInput name="contactName" label="Contacto" helperText="Opcional." normalize={normalizeNameLike} /><PickupInput name="contactPhone" label="Teléfono" helperText="Opcional. Ejemplo: +54 11 4567-8901." normalize={normalizePhone} /></div></PickupSection>;
}
