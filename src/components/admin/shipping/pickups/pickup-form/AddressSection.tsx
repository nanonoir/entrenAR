"use client";

import { PickupInput, PickupSection } from "@/components/admin/shipping/pickups/pickup-form/PickupFormField";

export function AddressSection() {
  return <PickupSection title="Dirección" description="Ubicación visible para preparar retiros."><div className="grid gap-4 md:grid-cols-2"><PickupInput name="name" label="Nombre del punto" helperText="Ejemplo: Local Palermo." /><PickupInput name="address.street" label="Calle" helperText="Nombre de la calle." /><PickupInput name="address.number" label="Número" helperText="Altura." /><PickupInput name="address.city" label="Ciudad" helperText="Localidad." /><PickupInput name="address.province" label="Provincia" helperText="Provincia argentina." /><PickupInput name="address.postalCode" label="Código postal" helperText="Ejemplo: 1425." /><PickupInput name="contactName" label="Contacto" helperText="Opcional." /><PickupInput name="contactPhone" label="Teléfono" helperText="Opcional." /></div></PickupSection>;
}
