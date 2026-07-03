"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { ProviderSection } from "@/components/admin/shipping/providers/provider-form/ProviderFormField";
import type { ProviderFormInput } from "@/schemas/admin/shipping-schemas";

export function ModalitiesSection() {
  const { control, formState: { errors }, setValue } = useFormContext<ProviderFormInput>();
  const selected = useWatch({ control, name: "enabledModalities" }) ?? [];
  function toggle(value: "home_delivery" | "branch_delivery") {
    setValue("enabledModalities", selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value], { shouldDirty: true, shouldValidate: true });
  }
  return <ProviderSection title="Modalidades" description="Seleccioná qué opciones estarán disponibles para el cliente."><fieldset className="grid gap-3" aria-invalid={errors.enabledModalities ? true : undefined} aria-describedby={errors.enabledModalities ? "provider-modalities-error" : undefined}><legend className="sr-only">Modalidades del proveedor</legend><label className="flex items-center gap-2 text-sm text-text"><input type="checkbox" checked={selected.includes("home_delivery")} onChange={() => toggle("home_delivery")} />Envío a domicilio</label><label className="flex items-center gap-2 text-sm text-text"><input type="checkbox" checked={selected.includes("branch_delivery")} onChange={() => toggle("branch_delivery")} />Envío a sucursal</label>{errors.enabledModalities?.message ? <p id="provider-modalities-error" className="text-xs font-medium text-sale">{errors.enabledModalities.message}</p> : null}</fieldset></ProviderSection>;
}
