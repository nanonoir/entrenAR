"use client";

import { AlertTriangle } from "lucide-react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { OriginSection } from "@/components/admin/shipping/providers/provider-form/OriginSection";
import { ModalitiesSection } from "@/components/admin/shipping/providers/provider-form/ModalitiesSection";
import { WeightRangesSection } from "@/components/admin/shipping/providers/provider-form/WeightRangesSection";
import { ApiInfoSection } from "@/components/admin/shipping/providers/provider-form/ApiInfoSection";
import { ProviderInput, ProviderSection } from "@/components/admin/shipping/providers/provider-form/ProviderFormField";
import { providerFormSchema, type ProviderFormInput, type ProviderFormValues } from "@/schemas/admin/shipping-schemas";
import type { ShippingProviderConfig } from "@/lib/data/admin/shipping/shipping-config";

type ProviderConfigFormProps = { provider: ShippingProviderConfig; onSubmit: (values: ProviderFormValues) => void };

function toInput(provider: ShippingProviderConfig): ProviderFormInput {
  return { ...provider, weightRanges: provider.weightRanges.length ? provider.weightRanges.map((range) => ({ ...range, minGrams: String(range.minGrams), maxGrams: String(range.maxGrams), cost: String(range.cost) })) : [{ id: "range-default", minGrams: "", maxGrams: "", cost: "" }], freeShippingThreshold: provider.freeShippingThreshold ? String(provider.freeShippingThreshold) : "" };
}

export function ProviderConfigForm({ onSubmit, provider }: ProviderConfigFormProps) {
  const methods = useForm<ProviderFormInput, unknown, ProviderFormValues>({ resolver: zodResolver(providerFormSchema), defaultValues: toInput(provider), mode: "onBlur" });
  const { formState: { errors, isSubmitting }, handleSubmit, setValue } = methods;
  function submit(status: "configured_inactive" | "active") {
    setValue("status", status, { shouldDirty: true, shouldValidate: true });
    void handleSubmit(onSubmit, () => document.getElementById("provider-form-error")?.scrollIntoView({ behavior: "smooth", block: "center" }))();
  }
  return <FormProvider {...methods}><form className="grid gap-5" noValidate onSubmit={(event) => event.preventDefault()}>{Object.keys(errors).length ? <div id="provider-form-error" role="alert" className="flex items-start gap-2 rounded-2xl border border-sale/30 bg-white p-3 text-sm font-medium text-sale"><AlertTriangle aria-hidden className="mt-0.5 shrink-0" size={16} />Revisá los campos marcados antes de guardar.</div> : null}<OriginSection /><ModalitiesSection /><ProviderSection title="Beneficio comercial" description="Opcional para preparar futuras promociones de envío."><ProviderInput name="freeShippingThreshold" label="Envío gratis desde" helperText="Opcional. Monto en ARS." type="number" /></ProviderSection><WeightRangesSection /><ApiInfoSection /><div className="flex flex-col-reverse gap-2 pb-4 sm:flex-row sm:justify-end"><LinkButton href="/admin/envios/medios-de-envio" variant="secondary">Cancelar</LinkButton><Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => submit("configured_inactive")}>Guardar configuración</Button><Button type="button" disabled={isSubmitting} onClick={() => submit("active")}>Guardar y activar</Button></div></form></FormProvider>;
}
