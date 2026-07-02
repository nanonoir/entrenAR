"use client";

import { useId, useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { SelectionDrawer } from "@/components/admin/discounts/SelectionDrawer";
import { FormCard } from "@/components/admin/discounts/coupon-form-controls";
import type { DiscountSelectOption } from "@/lib/data/admin/discounts/types";
import type { ShippingDiscountFormInput } from "@/schemas/admin/discount-schemas";

type ShippingConditionsSectionProps = {
  shippingMethodOptions: DiscountSelectOption[];
  zoneOptions: DiscountSelectOption[];
};

export function ShippingMethodsSection({ shippingMethodOptions }: Pick<ShippingConditionsSectionProps, "shippingMethodOptions">) {
  const { formState: { errors }, register, setValue } = useFormContext<ShippingDiscountFormInput>();
  const shippingMethodIds = useWatch({ name: "shippingMethodIds" }) ?? [];
  const [drawerOpen, setDrawerOpen] = useState(false);
  const methodNames = useSelectedLabels(shippingMethodIds, shippingMethodOptions);

  return (
    <FormCard id="shipping-methods-section" title="Medios de envío" description="Seleccioná con qué medios querés ofrecer envío gratis.">
      <SelectionSummary label="Medios seleccionados" names={methodNames} emptyText="Todavía no seleccionaste medios de envío." error={errors.shippingMethodIds?.message} onOpen={() => setDrawerOpen(true)} />
      <Checkbox id="shipping-cheapest" label="Ofrecer descuento solo en el medio de envío de menor costo." {...register("onlyCheapestShippingMethod")} />
      <SelectionDrawer title="Medios de envío" description="Seleccioná con qué medios querés ofrecer envío gratis." options={shippingMethodOptions} selectedIds={shippingMethodIds} open={drawerOpen} onClose={() => setDrawerOpen(false)} onSelectedIdsChange={(ids) => setValue("shippingMethodIds", ids, { shouldDirty: true, shouldValidate: true })} />
    </FormCard>
  );
}

export function ShippingConditionsSection({ zoneOptions }: Pick<ShippingConditionsSectionProps, "zoneOptions">) {
  const { formState: { errors }, register, setValue } = useFormContext<ShippingDiscountFormInput>();
  const zoneTargetType = useWatch({ name: "zoneTargetType" });
  const zoneIds = useWatch({ name: "zoneIds" }) ?? [];
  const [drawerOpen, setDrawerOpen] = useState(false);
  const zoneNames = useSelectedLabels(zoneIds, zoneOptions);
  const minimumAmountId = useId();

  return (
    <FormCard id="shipping-conditions-section" title="Límites de uso" description="Definí las condiciones de tu oferta de envío gratis.">
      <Checkbox id="shipping-combine" label="Permitir combinar con otras promociones. Ej.: precio promocional, cupones y otras." {...register("canCombineWithPromotions")} />
      <fieldset className="grid gap-2" aria-invalid={errors.zoneTargetType ? true : undefined} aria-describedby={errors.zoneTargetType ? "shipping-zone-target-error" : undefined}>
        <legend className="text-sm font-semibold text-text">Zonas de envío</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[{ label: "Todas", value: "all" }, { label: "Específicas", value: "specific" }].map((option) => (
            <label key={option.value} className="cursor-pointer">
              <input
                type="radio"
                value={option.value}
                className="peer sr-only"
                {...register("zoneTargetType", {
                  onChange: (event) => {
                    const value = event.currentTarget.value as ShippingDiscountFormInput["zoneTargetType"];
                    setValue("zoneTargetType", value, { shouldDirty: true, shouldValidate: true });
                    if (value === "all") setValue("zoneIds", [], { shouldDirty: true, shouldValidate: true });
                  },
                })}
              />
              <span className="block rounded-2xl border border-border bg-surface px-3 py-3 text-center text-sm font-semibold text-text transition peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent-hover">{option.label}</span>
            </label>
          ))}
        </div>
        {errors.zoneTargetType?.message ? <p id="shipping-zone-target-error" className="text-xs font-medium text-sale">{errors.zoneTargetType.message}</p> : null}
      </fieldset>
      {zoneTargetType === "all" ? <p className="rounded-2xl bg-surface p-3 text-sm text-text-muted">El envío gratis se va a aplicar a todas las zonas.</p> : null}
      {zoneTargetType === "specific" ? <SelectionSummary label="Zonas seleccionadas" names={zoneNames} emptyText="Todavía no seleccionaste zonas." error={errors.zoneIds?.message} onOpen={() => setDrawerOpen(true)} /> : null}
      <Input id={minimumAmountId} label="Monto del carrito mayor de" helperText={errors.minimumCartAmount ? undefined : "Puede ser 0. No puede ser negativo."} errorText={errors.minimumCartAmount?.message} type="number" inputMode="decimal" {...register("minimumCartAmount", { valueAsNumber: true })} />
      <SelectionDrawer title="Zonas de envío" description="Seleccioná las zonas a las que querés aplicar el envío gratis." options={zoneOptions} selectedIds={zoneIds} open={drawerOpen} onClose={() => setDrawerOpen(false)} onSelectedIdsChange={(ids) => setValue("zoneIds", ids, { shouldDirty: true, shouldValidate: true })} />
    </FormCard>
  );
}

function SelectionSummary({ emptyText, error, label, names, onOpen }: { emptyText: string; error?: string; label: string; names: string[]; onOpen: () => void }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-text">{label}</p><Button variant="secondary" onClick={onOpen}>{names.length ? "Editar" : "Seleccionar"}</Button></div>
      <div aria-describedby={error ? `${label}-error` : undefined} aria-invalid={error ? true : undefined} data-error-section={label}>
        {names.length ? <div className="flex flex-wrap gap-2">{names.map((name) => <span key={name} className="max-w-full truncate rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-hover">{name}</span>)}</div> : <p className="rounded-2xl bg-surface p-3 text-sm text-text-muted">{emptyText}</p>}
      </div>
      {error ? <p id={`${label}-error`} className="text-xs font-medium text-sale">{error}</p> : null}
    </div>
  );
}

function useSelectedLabels(ids: string[], options: DiscountSelectOption[]) {
  return useMemo(() => ids.map((id) => options.find((option) => option.id === id)?.label).filter((label): label is string => Boolean(label)), [ids, options]);
}
