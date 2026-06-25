"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { ProviderInput, ProviderSection } from "@/components/admin/shipping/providers/provider-form/ProviderFormField";
import type { ProviderFormInput } from "@/schemas/admin/shipping-schemas";

export function WeightRangesSection() {
  const { control, formState: { errors } } = useFormContext<ProviderFormInput>();
  const { append, fields, remove } = useFieldArray({ control, name: "weightRanges" });
  return <ProviderSection title="Rangos de peso" description="Definí costos manuales por peso. Los rangos no pueden superponerse."><div className="grid gap-3">{fields.map((field, index) => <div key={field.id} className="grid gap-3 rounded-2xl border border-border p-3 md:grid-cols-[1fr_1fr_1fr_auto]"><ProviderInput name={`weightRanges.${index}.minGrams`} label="Desde (g)" helperText="Mayor a 0." type="number" /><ProviderInput name={`weightRanges.${index}.maxGrams`} label="Hasta (g)" helperText="Debe superar al mínimo." type="number" /><ProviderInput name={`weightRanges.${index}.cost`} label="Costo" helperText="ARS." type="number" /><Button className="self-end" type="button" variant="ghost" size="icon" aria-label="Eliminar rango" onClick={() => remove(index)}><Trash2 aria-hidden size={16} /></Button></div>)}{typeof errors.weightRanges?.message === "string" ? <p className="text-xs font-medium text-sale">{errors.weightRanges.message}</p> : null}<Button type="button" variant="secondary" size="sm" className="w-fit" onClick={() => append({ id: `range-${Date.now()}`, minGrams: "", maxGrams: "", cost: "" })}><Plus aria-hidden size={16} />Agregar rango</Button></div></ProviderSection>;
}
