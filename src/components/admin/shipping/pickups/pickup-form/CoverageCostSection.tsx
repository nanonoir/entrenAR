"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { PickupInput, PickupSection } from "@/components/admin/shipping/pickups/pickup-form/PickupFormField";
import { normalizeDecimalInput, normalizeDigitsOnly } from "@/schemas/admin/shipping-schemas";
import type { PickupPointFormInput } from "@/schemas/admin/shipping-schemas";

const provinces = ["Buenos Aires", "Córdoba", "Santa Fe", "Mendoza", "Tucumán"];

export function CoverageCostSection() {
  const { control, formState: { errors }, register, setValue } = useFormContext<PickupPointFormInput>();
  const costType = useWatch({ control, name: "costType" });
  const coverageType = useWatch({ control, name: "coverageType" });
  const selectedProvinces = useWatch({ control, name: "provinces" }) ?? [];
  function toggleProvince(province: string) {
    setValue("provinces", selectedProvinces.includes(province) ? selectedProvinces.filter((item) => item !== province) : [...selectedProvinces, province], { shouldDirty: true, shouldValidate: true });
  }
  return <PickupSection title="Preparación, costo y cobertura" description="Definí reglas operativas para el punto de retiro."><div className="grid gap-4 md:grid-cols-2"><PickupInput name="preparationHours" label="Tiempo de preparación" helperText="Horas necesarias antes del retiro." type="number" normalize={normalizeDigitsOnly} /><label className="grid gap-2 text-sm font-medium text-text">Costo<select aria-invalid={errors.costType ? true : undefined} aria-describedby={errors.costType ? "pickup-cost-type-error" : undefined} className="h-11 rounded-button border border-border bg-surface px-3 text-base md:text-sm" {...register("costType")}><option value="free">Sin costo</option><option value="fixed">Con costo</option></select>{errors.costType?.message ? <span id="pickup-cost-type-error" className="text-xs font-medium text-sale">{errors.costType.message}</span> : null}</label>{costType === "fixed" ? <PickupInput name="fixedCost" label="Costo fijo" helperText="Monto en ARS." type="number" normalize={normalizeDecimalInput} /> : null}<label className="grid gap-2 text-sm font-medium text-text">Cobertura<select aria-invalid={errors.coverageType ? true : undefined} aria-describedby={errors.coverageType ? "pickup-coverage-type-error" : undefined} className="h-11 rounded-button border border-border bg-surface px-3 text-base md:text-sm" {...register("coverageType")}><option value="all">Todas las provincias</option><option value="provinces">Provincias específicas</option></select>{errors.coverageType?.message ? <span id="pickup-coverage-type-error" className="text-xs font-medium text-sale">{errors.coverageType.message}</span> : null}</label></div>{coverageType === "provinces" ? <fieldset className="grid gap-2" aria-invalid={errors.provinces ? true : undefined} aria-describedby={errors.provinces ? "pickup-provinces-error" : undefined}><legend className="text-sm font-medium text-text">Provincias</legend><div className="flex flex-wrap gap-2">{provinces.map((province) => <label key={province} className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-text"><input type="checkbox" checked={selectedProvinces.includes(province)} onChange={() => toggleProvince(province)} />{province}</label>)}</div>{errors.provinces?.message ? <p id="pickup-provinces-error" className="text-xs font-medium text-sale">{errors.provinces.message}</p> : null}</fieldset> : null}</PickupSection>;
}
