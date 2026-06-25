"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { ProviderInput, ProviderSection } from "@/components/admin/shipping/providers/provider-form/ProviderFormField";
import { normalizeDecimalInput, type ProviderFormInput } from "@/schemas/admin/shipping-schemas";

const rangeLabels = ["Hasta 1 kg", "1 kg a 3 kg", "3 kg a 5 kg", "5 kg a 10 kg", "Más de 10 kg"];

export function WeightRangesSection() {
  const { control, formState: { errors } } = useFormContext<ProviderFormInput>();
  const { fields } = useFieldArray({ control, name: "weightRanges" });
  return <ProviderSection id="provider-weight-ranges-section" title="Configurar precio según rango de peso" description="Los rangos base ya están definidos. Ajustá solo el costo de cada banda."><div className="grid gap-3">{fields.map((field, index) => <div key={field.id} className="grid gap-3 rounded-2xl border border-border p-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] md:items-start"><div className="grid content-start gap-2"><span className="text-sm font-medium text-text">Rango</span><span className="rounded-button border border-border bg-surface px-3 py-3 text-sm font-semibold text-text">{rangeLabels[index] ?? `Rango ${index + 1}`}</span></div><ProviderInput name={`weightRanges.${index}.cost`} label="Precio" helperText="ARS. Puede ser 0." type="number" normalize={normalizeDecimalInput} /></div>)}{typeof errors.weightRanges?.message === "string" ? <p id="provider-weight-ranges-error" tabIndex={-1} className="text-xs font-medium text-sale">{errors.weightRanges.message}</p> : null}</div></ProviderSection>;
}
