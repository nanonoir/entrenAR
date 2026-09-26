"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import type { AdminProductCategory } from "@/lib/data/admin/sales-flow/mock-products";
import type { ProductCreateInput } from "@/schemas/admin/product-schemas";
import { ProductFormCard, ProductFormInput } from "@/components/admin/products-flow/product-form/ProductFormField";

type ProductLogisticsCardProps = {
  categories: AdminProductCategory[];
  onOpenCategoryDrawer: () => void;
};

export function ProductLogisticsCard({ categories, onOpenCategoryDrawer }: ProductLogisticsCardProps) {
  const { control, formState: { errors }, setValue } = useFormContext<ProductCreateInput>();
  const visibility = useWatch({ control, name: "visibility" });
  const categoryIds = useWatch({ control, name: "categoryIds" }) ?? [];
  const selectedCategories = categories.filter((category) => categoryIds.includes(category.id));

  return (
    <ProductFormCard id="product-logistics-section" title="Catálogo y logística" description="Completá categoría, stock y datos operativos básicos.">
      <div className="grid gap-2 text-sm text-text">
        <span className="font-medium">Categorías seleccionadas</span>
        <p id="product-categoryIds-helper" className="text-text-muted">{selectedCategories.length ? selectedCategories.map((category) => category.name).join(", ") : "Seleccioná una o más categorías para clasificar el producto."}</p>
        <Button type="button" size="sm" variant="secondary" className="w-fit" onClick={onOpenCategoryDrawer}>Seleccionar categorías</Button>
        <div aria-invalid={errors.categoryIds ? true : undefined} aria-describedby={errors.categoryIds ? "product-categoryIds-error" : "product-categoryIds-helper"} data-error-section="categoryIds" tabIndex={-1} />
        {errors.categoryIds?.message ? <p id="product-categoryIds-error" className="text-xs font-medium text-sale">{errors.categoryIds.message}</p> : null}
      </div>
      <ProductFormInput<ProductCreateInput> name="brand" label="Marca" helperText="Opcional para búsquedas y edición futura." />
      <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
        <label className="flex items-start gap-2"><input className="mt-1 shrink-0" type="checkbox" checked={visibility === "visible"} aria-describedby={errors.visibility ? "product-visibility-error" : "product-visibility-helper"} aria-invalid={errors.visibility ? true : undefined} onChange={(event) => setValue("visibility", event.target.checked ? "visible" : "hidden", { shouldDirty: true, shouldValidate: true })} /> <span id="product-visibility-helper">Mostrar en la tienda. Si desmarcás esta opción, el producto queda oculto y podés volver a editarlo cuando quieras.</span></label>
        {errors.visibility?.message ? <p id="product-visibility-error" className="text-xs font-medium text-sale">{errors.visibility.message}</p> : null}
      </div>
    </ProductFormCard>
  );
}
