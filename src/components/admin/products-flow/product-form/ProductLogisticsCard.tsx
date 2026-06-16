"use client";

import { useFormContext } from "react-hook-form";
import type { AdminProductCategory } from "@/lib/data/admin/sales-flow/mock-products";
import type { ProductCreateInput } from "@/schemas/admin/product-schemas";
import { ProductFormCard, ProductFormInput, ProductFormSelect } from "@/components/admin/products-flow/product-form/ProductFormField";

type ProductLogisticsCardProps = {
  categories: AdminProductCategory[];
};

export function ProductLogisticsCard({ categories }: ProductLogisticsCardProps) {
  const { register, watch } = useFormContext<ProductCreateInput>();
  const stockMode = watch("stockMode");

  return (
    <ProductFormCard id="product-logistics-section" title="Catálogo y logística" description="Completá categoría, stock y datos operativos básicos.">
      <div className="grid gap-4 md:grid-cols-2">
        <ProductFormSelect<ProductCreateInput> name="categoryId" label="Categoría" helperText="Seleccioná dónde se agrupa el producto.">
          <option value="">Seleccionar categoría</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </ProductFormSelect>
        <ProductFormSelect<ProductCreateInput> name="visibility" label="Visibilidad" helperText="Define si aparece como visible u oculto en administración.">
          <option value="visible">Visible</option>
          <option value="hidden">Oculto</option>
        </ProductFormSelect>
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium text-text">Tipo de stock</legend>
        <div className="flex flex-wrap gap-3 text-sm text-zinc-700">
          <label className="flex items-center gap-2"><input type="radio" value="limited" {...register("stockMode")} /> Limitado</label>
          <label className="flex items-center gap-2"><input type="radio" value="infinite" {...register("stockMode")} /> Infinito</label>
        </div>
      </fieldset>
      {stockMode !== "infinite" ? <ProductFormInput<ProductCreateInput> name="stockQuantity" label="Stock inicial" helperText="Usá 0 si el producto arranca sin stock." type="number" /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <ProductFormInput<ProductCreateInput> name="brand" label="Marca" helperText="Opcional para búsquedas y edición futura." />
        <ProductFormInput<ProductCreateInput> name="tags" label="Etiquetas" helperText="Opcional. Separalas con coma." />
      </div>
      <ProductFormInput<ProductCreateInput> name="imageUrl" label="Imagen principal" helperText="Opcional en esta fase. Si falta, se mostrará una advertencia pero no bloquea el guardado." />
      <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
        <label className="flex items-center gap-2"><input type="checkbox" {...register("shippingRequired")} /> Requiere envío</label>
        <label className="flex items-center gap-2"><input type="checkbox" {...register("missingLogistics")} /> Marcar logística pendiente</label>
      </div>
    </ProductFormCard>
  );
}
