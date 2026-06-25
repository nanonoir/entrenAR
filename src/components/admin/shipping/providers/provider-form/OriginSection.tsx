"use client";

import { ProviderInput, ProviderSection } from "@/components/admin/shipping/providers/provider-form/ProviderFormField";
import { normalizeDigitsOnly, normalizeNameLike, normalizeStreetLike } from "@/schemas/admin/shipping-schemas";

export function OriginSection() {
  return <ProviderSection title="Remitente y origen" description="Datos usados para preparar futuras solicitudes al operador logístico."><div className="grid gap-4 md:grid-cols-2"><ProviderInput name="origin.senderName" label="Nombre remitente" helperText="Razón social o nombre comercial." normalize={normalizeNameLike} /><ProviderInput name="origin.phone" label="Teléfono" helperText="Formato con característica." /><ProviderInput name="origin.email" label="Email" helperText="Correo operativo." /><ProviderInput name="origin.street" label="Calle" helperText="Domicilio de despacho." normalize={normalizeStreetLike} /><ProviderInput name="origin.number" label="Número" helperText="Altura." normalize={normalizeDigitsOnly} /><ProviderInput name="origin.city" label="Ciudad" helperText="Localidad de origen." normalize={normalizeNameLike} /><ProviderInput name="origin.province" label="Provincia" helperText="Provincia argentina." normalize={normalizeNameLike} /><ProviderInput name="origin.postalCode" label="Código postal" helperText="Ejemplo: 1425." normalize={normalizeDigitsOnly} /></div></ProviderSection>;
}
