"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { PickupInput, PickupSection } from "@/components/admin/shipping/pickups/pickup-form/PickupFormField";
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
  return <PickupSection title="Preparación, costo y cobertura" description="Definí reglas operativas para el punto de retiro."><div className="grid gap-4 md:grid-cols-2"><PickupInput name="preparationHours" label="Tiempo de preparación" helperText="Horas necesarias antes del retiro." type="number" /><label className="grid gap-2 text-sm font-medium text-text">Costo<select className="h-11 rounded-button border border-border bg-surface px-3 text-base md:text-sm" {...register("costType")}><option value="free">Sin costo</option><option value="fixed">Con costo</option></select></label>{costType === "fixed" ? <PickupInput name="fixedCost" label="Costo fijo" helperText="Monto en ARS." type="number" /> : null}<label className="grid gap-2 text-sm font-medium text-text">Cobertura<select className="h-11 rounded-button border border-border bg-surface px-3 text-base md:text-sm" {...register("coverageType")}><option value="all">Todas las provincias</option><option value="provinces">Provincias específicas</option></select></label></div>{coverageType === "provinces" ? <fieldset className="grid gap-2"><legend className="text-sm font-medium text-text">Provincias</legend><div className="flex flex-wrap gap-2">{provinces.map((province) => <label key={province} className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-text"><input type="checkbox" checked={selectedProvinces.includes(province)} onChange={() => toggleProvince(province)} />{province}</label>)}</div>{errors.provinces?.message ? <p className="text-xs font-medium text-sale">{errors.provinces.message}</p> : null}</fieldset> : null}</PickupSection>;
}
