"use client";

import { useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { FormActions } from "@/components/admin/form-actions/FormActions";
import { OriginSection } from "@/components/admin/shipping/providers/provider-form/OriginSection";
import { ModalitiesSection } from "@/components/admin/shipping/providers/provider-form/ModalitiesSection";
import { WeightRangesSection } from "@/components/admin/shipping/providers/provider-form/WeightRangesSection";
import { ApiInfoSection } from "@/components/admin/shipping/providers/provider-form/ApiInfoSection";
import { ProviderInput, ProviderSection } from "@/components/admin/shipping/providers/provider-form/ProviderFormField";
import { DEFAULT_WEIGHT_RANGES, normalizeDecimalInput, providerFormSchema, type ProviderFormInput, type ProviderFormValues } from "@/schemas/admin/shipping-schemas";
import type { ShippingProviderConfig } from "@/lib/data/admin/shipping/shipping-config";

type ProviderConfigFormProps = { provider: ShippingProviderConfig; interceptNavigation: (href: string) => void; onDirtyChange?: (isDirty: boolean) => void; onSubmit: (values: ProviderFormValues) => void };

function toInput(provider: ShippingProviderConfig): ProviderFormInput {
  const costsById = new Map(provider.weightRanges.map((range) => [range.id, range.cost]));
  return { ...provider, weightRanges: DEFAULT_WEIGHT_RANGES.map((range) => ({ ...range, minGrams: String(range.minGrams), maxGrams: String(range.maxGrams), cost: String(costsById.get(range.id) ?? range.cost) })), freeShippingThreshold: provider.freeShippingThreshold ? String(provider.freeShippingThreshold) : "" };
}

export function ProviderConfigForm({ interceptNavigation, onDirtyChange, onSubmit, provider }: ProviderConfigFormProps) {
  const methods = useForm<ProviderFormInput, unknown, ProviderFormValues>({ resolver: zodResolver(providerFormSchema), defaultValues: toInput(provider), mode: "onBlur" });
  const { formState: { errors, isDirty, isSubmitting }, handleSubmit } = methods;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  function scrollToInvalidSection(invalidErrors: typeof errors) {
    const targetId = invalidErrors.weightRanges ? "provider-weight-ranges-section" : "provider-form-error";
    const target = document.getElementById(targetId);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus({ preventScroll: true });
  }

  function submit(status: "configured_inactive" | "active") {
    void handleSubmit((values) => onSubmit({ ...values, status }), scrollToInvalidSection)();
  }
  return <FormProvider {...methods}><form className="grid gap-5" noValidate onSubmit={(event) => event.preventDefault()}>{Object.keys(errors).length ? <div id="provider-form-error" role="alert" className="flex items-start gap-2 rounded-2xl border border-sale/30 bg-white p-3 text-sm font-medium text-sale"><AlertTriangle aria-hidden className="mt-0.5 shrink-0" size={16} />Revisá los campos marcados antes de guardar.</div> : null}<OriginSection /><ModalitiesSection /><ProviderSection title="Beneficio comercial" description="Opcional para preparar futuras promociones de envío."><ProviderInput name="freeShippingThreshold" label="Envío gratis desde" helperText="Opcional. Monto en ARS." type="number" normalize={normalizeDecimalInput} /></ProviderSection><WeightRangesSection /><ApiInfoSection /><FormActions><Button type="button" variant="secondary" onClick={() => interceptNavigation("/admin/envios/medios-de-envio")}>Cancelar</Button><Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => submit("configured_inactive")}>{isSubmitting ? <><Loader2 aria-hidden className="animate-spin" size={16} />Guardando…</> : "Guardar configuración"}</Button><Button type="button" disabled={isSubmitting} onClick={() => submit("active")}>{isSubmitting ? <><Loader2 aria-hidden className="animate-spin" size={16} />Guardando…</> : "Guardar y activar"}</Button></FormActions></form></FormProvider>;
}
