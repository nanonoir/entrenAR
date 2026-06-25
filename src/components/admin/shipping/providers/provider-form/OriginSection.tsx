"use client";

import { ProviderInput, ProviderSection } from "@/components/admin/shipping/providers/provider-form/ProviderFormField";

export function OriginSection() {
  return <ProviderSection title="Remitente y origen" description="Datos usados para preparar futuras solicitudes al operador logístico."><div className="grid gap-4 md:grid-cols-2"><ProviderInput name="origin.senderName" label="Nombre remitente" helperText="Razón social o nombre comercial." /><ProviderInput name="origin.phone" label="Teléfono" helperText="Formato con característica." /><ProviderInput name="origin.email" label="Email" helperText="Correo operativo." /><ProviderInput name="origin.street" label="Calle" helperText="Domicilio de despacho." /><ProviderInput name="origin.number" label="Número" helperText="Altura." /><ProviderInput name="origin.city" label="Ciudad" helperText="Localidad de origen." /><ProviderInput name="origin.province" label="Provincia" helperText="Provincia argentina." /><ProviderInput name="origin.postalCode" label="Código postal" helperText="Ejemplo: 1425." /></div></ProviderSection>;
}
