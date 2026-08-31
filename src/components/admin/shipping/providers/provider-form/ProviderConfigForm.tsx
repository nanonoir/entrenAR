"use client";

import { useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { FormProvider, useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { FormActions } from "@/components/admin/form-actions/FormActions";
import { scrollToFirstError } from "@/components/admin/utils/scroll-to-error";
import { applyCommerceFieldIssues, focusFirstCommerceError } from "@/components/admin/ui/CommerceFieldIssues";
import { OriginSection } from "@/components/admin/shipping/providers/provider-form/OriginSection";
import { ModalitiesSection } from "@/components/admin/shipping/providers/provider-form/ModalitiesSection";
import { WeightRangesSection } from "@/components/admin/shipping/providers/provider-form/WeightRangesSection";
import { ApiInfoSection } from "@/components/admin/shipping/providers/provider-form/ApiInfoSection";
import { ProviderInput, ProviderSection } from "@/components/admin/shipping/providers/provider-form/ProviderFormField";
import { DEFAULT_WEIGHT_RANGES, normalizeDecimalInput, providerFormSchema, type ProviderFormInput, type ProviderFormValues } from "@/schemas/admin/shipping-schemas";
import type { ShippingProviderConfig } from "@/lib/data/admin/shipping/shipping-config";
import { useAdminShippingStore } from "@/stores/admin-shipping-store";

type ProviderConfigFormProps = { provider: ShippingProviderConfig; interceptNavigation: (href: string) => void; onDirtyChange?: (isDirty: boolean) => void; onSubmit: (values: ProviderFormValues) => Promise<boolean | void> | boolean | void };

function toInput(provider: ShippingProviderConfig): ProviderFormInput {
  const costsById = new Map(provider.weightRanges.map((range) => [range.id, range.cost]));
  return { ...provider, weightRanges: DEFAULT_WEIGHT_RANGES.map((range) => ({ ...range, minGrams: String(range.minGrams), maxGrams: String(range.maxGrams), cost: String(costsById.get(range.id) ?? range.cost) })), freeShippingThreshold: provider.freeShippingThreshold ? String(provider.freeShippingThreshold) : "" };
}

export function ProviderConfigForm({ interceptNavigation, onDirtyChange, onSubmit, provider }: ProviderConfigFormProps) {
  const clearError = useAdminShippingStore((state) => state.clearError);
  const apiError = useAdminShippingStore((state) => state.error);
  const methods = useForm<ProviderFormInput, unknown, ProviderFormValues>({ resolver: zodResolver(providerFormSchema), defaultValues: toInput(provider), mode: "onBlur" });
  const { formState: { errors, isDirty, isSubmitting }, handleSubmit, setError } = methods;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!apiError) return;

    const firstField = applyCommerceFieldIssues(apiError.issues, resolveProviderField, setError);
    if (!firstField) return;

    const frame = window.requestAnimationFrame(focusFirstCommerceError);
    return () => window.cancelAnimationFrame(frame);
  }, [apiError, setError]);

  function scrollToInvalidSection(invalidErrors: typeof errors) {
    scrollToFirstError(invalidErrors, invalidErrors.weightRanges ? ["provider-weight-ranges-section"] : []);
  }

  function submit(status: "configured_inactive" | "active") {
    clearError();
    void handleSubmit((values) => onSubmit({ ...values, status }), scrollToInvalidSection)();
  }
  return <FormProvider {...methods}><form className="grid gap-5" noValidate onSubmit={(event) => event.preventDefault()}>{Object.keys(errors).length || apiError ? <div id="provider-form-error" role="alert" className="flex items-start gap-2 rounded-2xl border border-sale/30 bg-white p-3 text-sm font-medium text-sale"><AlertTriangle aria-hidden className="mt-0.5 shrink-0" /><span>{apiError?.message ?? "Revisá los campos marcados antes de guardar."}</span></div> : null}<OriginSection /><ModalitiesSection /><ProviderSection title="Beneficio comercial" description="Opcional para preparar futuras promociones de envío."><ProviderInput name="freeShippingThreshold" label="Envío gratis desde" helperText="Opcional. Monto en ARS." type="number" normalize={normalizeDecimalInput} /></ProviderSection><WeightRangesSection /><ApiInfoSection /><FormActions><Button type="button" variant="secondary" onClick={() => interceptNavigation("/admin/envios/medios-de-envio")}>Cancelar</Button><Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => submit("configured_inactive")}>{isSubmitting ? <><Loader2 aria-hidden className="animate-spin" size={16} />Guardando…</> : "Guardar configuración"}</Button><Button type="button" disabled={isSubmitting} onClick={() => submit("active")}>{isSubmitting ? <><Loader2 aria-hidden className="animate-spin" size={16} />Guardando…</> : "Guardar y activar"}</Button></FormActions></form></FormProvider>;
}

const PROVIDER_FIELD = {
  ENABLED_MODALITIES: "enabledModalities",
  FREE_SHIPPING_THRESHOLD: "freeShippingThreshold",
  NAME: "name",
  ORIGIN_CITY: "origin.city",
  ORIGIN_EMAIL: "origin.email",
  ORIGIN_NUMBER: "origin.number",
  ORIGIN_PHONE: "origin.phone",
  ORIGIN_POSTAL_CODE: "origin.postalCode",
  ORIGIN_PROVINCE: "origin.province",
  ORIGIN_SENDER_NAME: "origin.senderName",
  ORIGIN_STREET: "origin.street",
  STATUS: "status",
  WEIGHT_RANGES: "weightRanges",
} as const;

type ProviderField = (typeof PROVIDER_FIELD)[keyof typeof PROVIDER_FIELD] | `weightRanges.${number}.cost` | `weightRanges.${number}.maxGrams` | `weightRanges.${number}.minGrams`;

function resolveProviderField(field: string): FieldPath<ProviderFormInput> | undefined {
  if (Object.values(PROVIDER_FIELD).includes(field as (typeof PROVIDER_FIELD)[keyof typeof PROVIDER_FIELD])) return field as ProviderField;
  if (/^weightRanges\.\d+\.(?:cost|maxGrams|minGrams)$/.test(field)) return field as ProviderField;
  if (/^weightRanges\.\d+$/.test(field)) return "weightRanges";
  return undefined;
}
