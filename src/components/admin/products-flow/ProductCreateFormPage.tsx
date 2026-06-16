"use client";

import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { ProductIdentityCard } from "@/components/admin/products-flow/product-form/ProductIdentityCard";
import { ProductLogisticsCard } from "@/components/admin/products-flow/product-form/ProductLogisticsCard";
import { ProductPricingCard } from "@/components/admin/products-flow/product-form/ProductPricingCard";
import type { AdminProductCategory } from "@/lib/data/admin/sales-flow/mock-products";
import { productCreateSchema, type ProductCreateInput, type ProductCreateValues } from "@/schemas/admin/product-schemas";
import { useAdminProductsStore } from "@/stores/admin-products-store";

type ProductCreateFormPageProps = {
  categories: AdminProductCategory[];
};

const defaultValues: ProductCreateInput = {
  name: "",
  slug: "",
  sku: "",
  categoryId: "",
  description: "",
  imageUrl: "",
  salePrice: "",
  promotionalPrice: "",
  stockMode: "limited",
  stockQuantity: "0",
  visibility: "visible",
  brand: "",
  tags: "",
  shippingRequired: true,
  missingLogistics: false,
};

export function ProductCreateFormPage({ categories }: ProductCreateFormPageProps) {
  const router = useRouter();
  const createProduct = useAdminProductsStore((state) => state.createProduct);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mediaWarning, setMediaWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const methods = useForm<ProductCreateInput, unknown, ProductCreateValues>({
    resolver: zodResolver(productCreateSchema),
    defaultValues,
    mode: "onBlur",
  });

  const { formState: { errors }, handleSubmit, setFocus } = methods;

  async function onSubmit(data: ProductCreateValues) {
    setSubmitError(null);
    setMediaWarning(data.imageUrl ? null : "El producto se guardará sin imagen principal. Podés agregarla más adelante.");
    setIsSubmitting(true);
    try {
      const category = categories.find((item) => item.id === data.categoryId);
      await createProduct({ ...data, categoryName: category?.name ?? "Sin categoría" });
      router.push("/admin/productos");
    } finally {
      setIsSubmitting(false);
    }
  }

  function onInvalid() {
    setSubmitError("Debés completar todos los campos obligatorios correctamente.");
    const firstInvalidSectionId = errors.name || errors.sku || errors.slug || errors.description
      ? "product-identity-section"
      : errors.salePrice || errors.promotionalPrice
        ? "product-pricing-section"
        : "product-logistics-section";
    document.getElementById(firstInvalidSectionId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (errors.name) setFocus("name");
    else if (errors.sku) setFocus("sku");
    else if (errors.salePrice) setFocus("salePrice");
    else if (errors.categoryId) setFocus("categoryId");
  }

  const submitForm = handleSubmit(onSubmit, onInvalid);

  return (
    <div className="mx-auto grid w-full max-w-4xl min-w-0 gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Productos</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">Agregar producto</h1>
          <p className="mt-1 text-sm text-zinc-500">Creá un producto base en el catálogo administrable.</p>
        </div>
        <LinkButton href="/admin/productos" variant="secondary" size="sm">
          <ArrowLeft aria-hidden size={16} />
          Volver al listado
        </LinkButton>
      </div>

      {submitError ? <FormAlert>{submitError}</FormAlert> : null}
      {mediaWarning ? <FormAlert>{mediaWarning}</FormAlert> : null}

      <FormProvider {...methods}>
        <form onSubmit={submitForm} noValidate className="grid gap-5">
          <ProductIdentityCard />
          <ProductPricingCard />
          <ProductLogisticsCard categories={categories} />
          <div className="flex flex-col-reverse gap-2 pb-4 sm:flex-row sm:justify-end">
            <LinkButton href="/admin/productos" variant="secondary" size="md">Cancelar</LinkButton>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando…" : "Guardar producto"}</Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}

function FormAlert({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-sale/30 bg-white p-3 text-sm font-medium text-sale">
      <AlertTriangle aria-hidden className="mt-0.5 shrink-0" size={16} />
      {children}
    </div>
  );
}
