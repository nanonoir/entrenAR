import { Package, Plus } from "lucide-react";
import type { FieldArrayWithId, FieldErrors, UseFieldArrayRemove, UseFormRegister, UseFormSetValue } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import type { OrderFormInput } from "@/components/admin/sales-flow/OrderFormSchema";
import { ProductLineItem } from "@/components/admin/sales-flow/order-form/ProductLineItem";
import { cn } from "@/lib/utils";

type ProductsSectionProps = {
  fields: FieldArrayWithId<OrderFormInput, "products", "id">[];
  watchedProducts?: OrderFormInput["products"];
  errors: FieldErrors<OrderFormInput>;
  productError?: string;
  register: UseFormRegister<OrderFormInput>;
  setValue: UseFormSetValue<OrderFormInput>;
  remove: UseFieldArrayRemove;
  onOpenDrawer: () => void;
};

export function ProductsSection({ fields, watchedProducts, errors, productError, register, setValue, remove, onOpenDrawer }: ProductsSectionProps) {
  return (
    <section id="products-section" className={cn("rounded-3xl border bg-white p-5 shadow-sm", productError ? "border-sale bg-red-50/40" : "border-zinc-200")} aria-describedby={productError ? "products-section-error" : undefined}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-zinc-950">Productos</h2>
        <Button type="button" variant="secondary" size="sm" onClick={onOpenDrawer}>
          <Plus aria-hidden size={16} />
          Agregar producto
        </Button>
      </div>

      {productError && <p id="products-section-error" className="mb-3 text-sm font-medium text-sale">{productError}</p>}

      {fields.length === 0 ? (
        <button type="button" onClick={onOpenDrawer} className={cn("flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed py-8 text-center transition hover:border-accent hover:bg-accent-soft/40", productError ? "border-sale bg-white" : "border-zinc-200")}>
          <Package aria-hidden size={32} className="text-zinc-300" />
          <span className="text-sm font-semibold text-zinc-500">Ningún producto agregado</span>
          <span className="text-xs text-zinc-400">Hacé clic para buscar del catálogo</span>
        </button>
      ) : (
        <div className="divide-y divide-zinc-100">
          {fields.map((field, index) => {
            const watchedProduct = watchedProducts?.[index];
            return (
              <ProductLineItem
                key={field.id}
                fieldId={field.id}
                index={index}
                name={field.name}
                quantity={watchedProduct?.quantity ?? 1}
                unitPrice={watchedProduct?.unitPrice}
                register={register}
                setValue={setValue}
                errors={errors.products}
                onRemove={() => remove(index)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
