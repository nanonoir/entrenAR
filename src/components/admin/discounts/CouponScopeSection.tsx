"use client";

import { useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { SelectionDrawer } from "@/components/admin/discounts/SelectionDrawer";
import { FormCard, RadioPillGroup } from "@/components/admin/discounts/coupon-form-controls";
import type { DiscountSelectOption } from "@/lib/data/admin/discounts/types";
import type { CouponFormInput } from "@/schemas/admin/discount-schemas";

type CouponScopeSectionProps = {
  categoryOptions: DiscountSelectOption[];
  productOptions: DiscountSelectOption[];
};

export function CouponScopeSection({ categoryOptions, productOptions }: CouponScopeSectionProps) {
  const { formState: { errors }, setValue } = useFormContext<CouponFormInput>();
  const targetType = useWatch({ name: "targetType" });
  const categoryIds = useWatch({ name: "categoryIds" }) ?? [];
  const productIds = useWatch({ name: "productIds" }) ?? [];
  const [drawer, setDrawer] = useState<"categories" | "products" | null>(null);
  const categoryNames = useSelectedLabels(categoryIds, categoryOptions);
  const productNames = useSelectedLabels(productIds, productOptions);

  return (
    <FormCard id="coupon-scope-section" title="Aplicar a" description="Elegí si el cupón aplica a toda la tienda, categorías o productos puntuales.">
      <RadioPillGroup
        label="Alcance"
        name="targetType"
        options={[{ label: "Toda la tienda", value: "all_store" }, { label: "Categorías", value: "categories" }, { label: "Productos", value: "products" }]}
        onChange={(value) => {
          setValue("targetType", value as CouponFormInput["targetType"], { shouldDirty: true, shouldValidate: true });
          if (value !== "categories") setValue("categoryIds", [], { shouldDirty: true, shouldValidate: true });
          if (value !== "products") setValue("productIds", [], { shouldDirty: true, shouldValidate: true });
        }}
      />
      {targetType === "all_store" ? <p className="rounded-2xl bg-surface p-3 text-sm text-text-muted">El cupón podrá ser usado en todos los productos de todas las categorías de la tienda.</p> : null}
      {targetType === "categories" ? <SelectionSummary label="Categorías seleccionadas" names={categoryNames} error={errors.categoryIds?.message} onOpen={() => setDrawer("categories")} /> : null}
      {targetType === "products" ? <SelectionSummary label="Productos seleccionados" names={productNames} error={errors.productIds?.message} onOpen={() => setDrawer("products")} /> : null}
      <SelectionDrawer title="Categorías" description="Seleccioná las categorías a las que querés aplicar el cupón." options={categoryOptions} selectedIds={categoryIds} open={drawer === "categories"} onClose={() => setDrawer(null)} onSelectedIdsChange={(ids) => setValue("categoryIds", ids, { shouldDirty: true, shouldValidate: true })} />
      <SelectionDrawer title="Productos" description="Seleccioná los productos a los que querés aplicar el cupón." options={productOptions} selectedIds={productIds} open={drawer === "products"} onClose={() => setDrawer(null)} onSelectedIdsChange={(ids) => setValue("productIds", ids, { shouldDirty: true, shouldValidate: true })} />
    </FormCard>
  );
}

function SelectionSummary({ error, label, names, onOpen }: { error?: string; label: string; names: string[]; onOpen: () => void }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-text">{label}</p><Button variant="secondary" onClick={onOpen}>{names.length ? "Editar" : "Seleccionar"}</Button></div>
      {names.length ? <div className="flex flex-wrap gap-2">{names.map((name) => <span key={name} className="max-w-full truncate rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-hover">{name}</span>)}</div> : <p className="rounded-2xl bg-surface p-3 text-sm text-text-muted">Todavía no seleccionaste opciones.</p>}
      {error ? <p className="text-xs font-medium text-sale">{error}</p> : null}
    </div>
  );
}

function useSelectedLabels(ids: string[], options: DiscountSelectOption[]) {
  return useMemo(() => ids.map((id) => options.find((option) => option.id === id)?.label).filter((label): label is string => Boolean(label)), [ids, options]);
}
