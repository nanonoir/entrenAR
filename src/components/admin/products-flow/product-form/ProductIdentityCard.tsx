"use client";

import type { ProductCreateInput } from "@/schemas/admin/product-schemas";
import { ProductFormCard, ProductFormInput, ProductFormTextarea } from "@/components/admin/products-flow/product-form/ProductFormField";

export function ProductIdentityCard() {
  return (
    <ProductFormCard id="product-identity-section" title="Identidad" description="Definí cómo se reconoce el producto dentro del catálogo.">
      <div className="grid gap-4 md:grid-cols-2">
        <ProductFormInput<ProductCreateInput> name="name" label="Nombre del producto" helperText="Mínimo 3 caracteres." />
      </div>
      <ProductFormTextarea<ProductCreateInput> name="description" label="Descripción" helperText="Incluí información clara para administración y futura ficha pública." />
    </ProductFormCard>
  );
}
