"use client";

import { ProviderSection } from "@/components/admin/shipping/providers/provider-form/ProviderFormField";
import { Input } from "@/components/ui/Input";

export function ApiInfoSection() {
  return <ProviderSection title="Integración del operador" description="Campos reservados para una futura conexión con el proveedor."><div className="grid gap-4 md:grid-cols-2"><Input id="provider-api-key" label="API key" helperText="Se configurará cuando exista backend seguro." disabled value="Pendiente" readOnly /><Input id="provider-account" label="Cuenta comercial" helperText="Dato reservado para la integración." disabled value="Pendiente" readOnly /></div></ProviderSection>;
}
