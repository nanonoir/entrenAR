"use client";

import { useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { SelectionDrawer } from "@/components/admin/discounts/SelectionDrawer";
import { FormCard } from "@/components/admin/discounts/coupon-form-controls";
import type { DiscountSelectOption } from "@/lib/data/admin/discounts/types";
import type { ShippingDiscountFormInput } from "@/schemas/admin/discount-schemas";

type ShippingScopeSectionProps = {
  categoryOptions: DiscountSelectOption[];
};

export function ShippingScopeSection({ categoryOptions }: ShippingScopeSectionProps) {
  const { formState: { errors }, register, setValue } = useFormContext<ShippingDiscountFormInput>();
  const targetType = useWatch({ name: "targetType" });
  const categoryIds = useWatch({ name: "categoryIds" }) ?? [];
  const [drawerOpen, setDrawerOpen] = useState(false);
  const categoryNames = useSelectedLabels(categoryIds, categoryOptions);

  return (
    <FormCard id="shipping-scope-section" title="Aplicar a" description="Elegí si el envío gratis aplica a toda la tienda o a categorías específicas.">
      <fieldset className="grid gap-2" aria-invalid={errors.targetType ? true : undefined} aria-describedby={errors.targetType ? "shipping-target-type-error" : undefined}>
        <legend className="text-sm font-semibold text-text">Alcance</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[{ label: "Toda la tienda", value: "all_store" }, { label: "Categorías", value: "categories" }].map((option) => (
            <label key={option.value} className="cursor-pointer">
              <input
                type="radio"
                value={option.value}
                className="peer sr-only"
                {...register("targetType", {
                  onChange: (event) => {
                    const value = event.currentTarget.value as ShippingDiscountFormInput["targetType"];
                    setValue("targetType", value, { shouldDirty: true, shouldValidate: true });
                    if (value !== "categories") setValue("categoryIds", [], { shouldDirty: true, shouldValidate: true });
                  },
                })}
              />
              <span className="block rounded-2xl border border-border bg-surface px-3 py-3 text-center text-sm font-semibold text-text transition peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent-hover">{option.label}</span>
            </label>
          ))}
        </div>
        {errors.targetType?.message ? <p id="shipping-target-type-error" className="text-xs font-medium text-sale">{errors.targetType.message}</p> : null}
      </fieldset>
      {targetType === "all_store" ? <p className="rounded-2xl bg-surface p-3 text-sm text-text-muted">El envío gratis se va a aplicar a todos los productos de todas las categorías de la tienda.</p> : null}
      {targetType === "categories" ? <SelectionSummary label="Categorías seleccionadas" names={categoryNames} error={errors.categoryIds?.message} onOpen={() => setDrawerOpen(true)} /> : null}
      <SelectionDrawer title="Categorías" description="Seleccioná las categorías a las que querés aplicar el envío gratis." options={categoryOptions} selectedIds={categoryIds} open={drawerOpen} onClose={() => setDrawerOpen(false)} onSelectedIdsChange={(ids) => setValue("categoryIds", ids, { shouldDirty: true, shouldValidate: true })} />
    </FormCard>
  );
}

function SelectionSummary({ error, label, names, onOpen }: { error?: string; label: string; names: string[]; onOpen: () => void }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-text">{label}</p><Button variant="secondary" onClick={onOpen}>{names.length ? "Editar categorías" : "Seleccionar"}</Button></div>
      <div aria-describedby={error ? "shipping-categoryIds-error" : undefined} aria-invalid={error ? true : undefined} data-error-section="categoryIds">
        {names.length ? <div className="flex flex-wrap gap-2">{names.map((name) => <span key={name} className="max-w-full truncate rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-hover">{name}</span>)}</div> : <p className="rounded-2xl bg-surface p-3 text-sm text-text-muted">Todavía no seleccionaste categorías.</p>}
      </div>
      {error ? <p id="shipping-categoryIds-error" className="text-xs font-medium text-sale">{error}</p> : null}
    </div>
  );
}

function useSelectedLabels(ids: string[], options: DiscountSelectOption[]) {
  return useMemo(() => ids.map((id) => options.find((option) => option.id === id)?.label).filter((label): label is string => Boolean(label)), [ids, options]);
}
