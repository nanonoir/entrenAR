"use client";

import type { ProductCreateInput } from "@/schemas/admin/product-schemas";
import { ProductFormCard, ProductFormInput } from "@/components/admin/products-flow/product-form/ProductFormField";

export function ProductPricingCard() {
  return (
    <ProductFormCard id="product-pricing-section" title="Precios" description="Cargá el precio base y un promocional opcional menor al precio.">
      <div className="grid gap-4 md:grid-cols-2">
        <ProductFormInput<ProductCreateInput> name="salePrice" label="Precio" helperText="Debe ser mayor a 0. Ejemplo: 52900" inputMode="decimal" />
        <ProductFormInput<ProductCreateInput> name="promotionalPrice" label="Promocional" helperText="Opcional. Debe ser menor al precio." inputMode="decimal" />
      </div>
    </ProductFormCard>
  );
}
