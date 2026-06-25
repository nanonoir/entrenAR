"use client";

import type { ProductCreateInput } from "@/schemas/admin/product-schemas";
import { ProductFormCard, ProductFormInput } from "@/components/admin/products-flow/product-form/ProductFormField";

export function ProductShippingDataCard() {
  return (
    <ProductFormCard
      id="product-shipping-data-section"
      title="Datos para envío"
      description="Definí peso y dimensiones para futuras reglas de cotización logística."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <ProductFormInput<ProductCreateInput> name="weightGrams" label="Peso" helperText="Opcional. En gramos, mayor a 0." inputMode="decimal" />
        <ProductFormInput<ProductCreateInput> name="heightCm" label="Alto" helperText="Opcional. En centímetros, mayor a 0." inputMode="decimal" />
        <ProductFormInput<ProductCreateInput> name="widthCm" label="Ancho" helperText="Opcional. En centímetros, mayor a 0." inputMode="decimal" />
        <ProductFormInput<ProductCreateInput> name="lengthCm" label="Largo" helperText="Opcional. En centímetros, mayor a 0." inputMode="decimal" />
      </div>
      <p className="rounded-2xl border border-border bg-surface p-3 text-sm text-text-muted">
        Si el producto queda incompleto, una futura integración podrá usar dimensiones estándar o estimadas sin afectar el checkout actual.
      </p>
    </ProductFormCard>
  );
}
