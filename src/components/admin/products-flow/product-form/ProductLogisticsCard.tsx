"use client";

import { useFormContext, useWatch } from "react-hook-form";
import type { AdminProductCategory } from "@/lib/data/admin/sales-flow/mock-products";
import type { ProductCreateInput } from "@/schemas/admin/product-schemas";
import { ProductFormCard, ProductFormInput, ProductFormSelect } from "@/components/admin/products-flow/product-form/ProductFormField";
import { ImageDropZone } from "@/components/admin/products-flow/product-form/ImageDropZone";

type ProductLogisticsCardProps = {
  categories: AdminProductCategory[];
};

export function ProductLogisticsCard({ categories }: ProductLogisticsCardProps) {
  const { control, formState: { errors }, register, setValue } = useFormContext<ProductCreateInput>();
  const stockMode = useWatch({ control, name: "stockMode" });
  const visibility = useWatch({ control, name: "visibility" });
  const imageUrl = useWatch({ control, name: "imageUrl" });

  return (
    <ProductFormCard id="product-logistics-section" title="Catálogo y logística" description="Completá categoría, stock y datos operativos básicos.">
      <ProductFormSelect<ProductCreateInput> name="categoryId" label="Categoría" helperText="Seleccioná dónde se agrupa el producto.">
        <option value="">Seleccionar categoría</option>
        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </ProductFormSelect>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium text-text">Tipo de stock</legend>
        <div className="flex flex-wrap gap-3 text-sm text-zinc-700">
          <label className="flex items-center gap-2"><input type="radio" value="limited" {...register("stockMode")} /> Limitado</label>
          <label className="flex items-center gap-2"><input type="radio" value="infinite" {...register("stockMode")} /> Infinito</label>
        </div>
      </fieldset>
      {stockMode !== "infinite" ? <ProductFormInput<ProductCreateInput> name="stockQuantity" label="Stock inicial" helperText="Usá 0 si el producto arranca sin stock." type="number" /> : null}
      <ProductFormInput<ProductCreateInput> name="brand" label="Marca" helperText="Opcional para búsquedas y edición futura." />
      <ImageDropZone label="Imagen principal" value={imageUrl} errorText={errors.imageUrl?.message} onChange={(value) => setValue("imageUrl", value, { shouldDirty: true, shouldValidate: true })} />
      <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
        <label className="flex items-start gap-2"><input className="mt-1 shrink-0" type="checkbox" checked={visibility === "visible"} onChange={(event) => setValue("visibility", event.target.checked ? "visible" : "hidden", { shouldDirty: true, shouldValidate: true })} /> Mostrar en la tienda (si no marcas esta casilla el producto estara oculto, puedes editarlo en cualquier momento)</label>
      </div>
    </ProductFormCard>
  );
}
