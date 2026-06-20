"use client";

import { AlertTriangle, ArrowLeft, Copy, Eye, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { ProductIdentityCard } from "@/components/admin/products-flow/product-form/ProductIdentityCard";
import { ProductLogisticsCard } from "@/components/admin/products-flow/product-form/ProductLogisticsCard";
import { ProductPricingCard } from "@/components/admin/products-flow/product-form/ProductPricingCard";
import { ProductAdvancedDrawersCard, type ProductAdvancedDrawerType } from "@/components/admin/products-flow/product-form/ProductAdvancedDrawersCard";
import { getProductHref } from "@/lib/routes";
import type { AdminProduct, AdminProductCategory } from "@/lib/data/admin/sales-flow/mock-products";
import { productCreateSchema, type ProductCreateInput, type ProductCreateValues } from "@/schemas/admin/product-schemas";
import { useAdminProductsStore } from "@/stores/admin-products-store";

type ProductCreateFormPageProps = {
  categories: AdminProductCategory[];
  mode?: "create" | "edit";
  product?: AdminProduct;
};

const defaultValues: ProductCreateInput = {
  name: "",
  slug: "",
  sku: "",
  categoryIds: [],
  description: "",
  imageUrl: "",
  salePrice: "",
  promotionalPrice: "",
  stockMode: "limited",
  stockQuantity: "0",
  visibility: "visible",
  brand: "",
  tags: "",
  seoTitle: "",
  seoDescription: "",
  highlightSections: [],
  variantProperties: [],
  variantCombinations: [],
};

function slugifyCategory(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildProductDefaultValues(product?: AdminProduct): ProductCreateInput {
  if (!product) return defaultValues;
  return {
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    categoryIds: product.categoryIds ?? [product.categoryId],
    description: `${product.name} listo para completar con descripción comercial.`,
    imageUrl: product.imageUrl ?? "",
    salePrice: String(product.salePrice),
    promotionalPrice: product.promotionalPrice ? String(product.promotionalPrice) : "",
    stockMode: product.stock.type,
    stockQuantity: product.stock.type === "limited" ? String(product.stock.quantity) : "0",
    visibility: product.visibility,
    brand: "",
    tags: product.tags.join(", "),
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
    highlightSections: product.highlightSections,
    variantProperties: product.variantProperties,
    variantCombinations: product.variantCombinations,
  };
}

export function ProductCreateFormPage({ categories, mode = "create", product }: ProductCreateFormPageProps) {
  const router = useRouter();
  const createProduct = useAdminProductsStore((state) => state.createProduct);
  const updateProduct = useAdminProductsStore((state) => state.updateProduct);
  const duplicateProduct = useAdminProductsStore((state) => state.duplicateProduct);
  const deleteProduct = useAdminProductsStore((state) => state.deleteProduct);
  const initializeProducts = useAdminProductsStore((state) => state.initializeProducts);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mediaWarning, setMediaWarning] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localCategories, setLocalCategories] = useState<AdminProductCategory[]>(() => categories);
  const [advancedDrawer, setAdvancedDrawer] = useState<ProductAdvancedDrawerType>(null);
  const methods = useForm<ProductCreateInput, unknown, ProductCreateValues>({
    resolver: zodResolver(productCreateSchema),
    defaultValues: buildProductDefaultValues(product),
    mode: "onBlur",
  });

  const { formState: { errors, isDirty }, handleSubmit, reset, setFocus } = methods;

  useEffect(() => {
    if (product) initializeProducts([product]);
  }, [initializeProducts, product]);

  function createLocalCategory(name: string) {
    const slug = slugifyCategory(name) || `categoria-${Date.now()}`;
    const category: AdminProductCategory = {
      id: `cat-local-${slug}-${Date.now()}`,
      name,
      slug,
      visibility: "visible",
    };
    setLocalCategories((current) => [...current, category]);
    return category;
  }

  async function onSubmit(data: ProductCreateValues) {
    setSubmitError(null);
    setMediaWarning(data.imageUrl ? null : "El producto se guardará sin imagen principal. Podés agregarla más adelante.");
    setIsSubmitting(true);
    try {
      const categoryNames = localCategories.filter((item) => data.categoryIds.includes(item.id)).map((item) => item.name).join(", ");
      if (mode === "edit" && product) {
        const updated = await updateProduct(product.id, { ...data, categoryName: categoryNames || "Sin categoría" });
        reset(buildProductDefaultValues(updated));
        setStatusMessage("Cambios guardados.");
      } else {
        await createProduct({ ...data, categoryName: categoryNames || "Sin categoría" });
        router.push("/admin/productos");
      }
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
    else if (errors.categoryIds) setFocus("name");
  }

  const submitForm = handleSubmit(onSubmit, onInvalid);
  const title = mode === "edit" ? "Editar producto" : "Agregar producto";
  const description = mode === "edit" ? "Actualizá los datos principales del producto." : "Creá un producto base en el catálogo administrable.";

  async function handleDuplicate() {
    if (!product) return;
    const duplicate = await duplicateProduct(product.id);
    if (duplicate) router.push(`/admin/productos/${duplicate.id}`);
  }

  async function handleCopyId() {
    if (!product) return;
    await navigator.clipboard?.writeText(product.id);
    setStatusMessage("ID copiado al portapapeles.");
  }

  async function handleDelete() {
    if (!product) return;
    await deleteProduct(product.id);
    router.push("/admin/productos");
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl min-w-0 gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Productos</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">{title}</h1>
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
          {mode === "edit" ? <p className="mt-2 text-sm font-medium text-zinc-600">{isDirty ? "Cambios sin guardar" : "Sin cambios pendientes"}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {product ? <LinkButton href={getProductHref(product.publicSlug)} target="_blank" variant="secondary" size="sm"><Eye aria-hidden size={16} />Vista tienda</LinkButton> : null}
          {product ? <Button type="button" variant="secondary" size="sm" onClick={handleCopyId}><Copy aria-hidden size={16} />Copiar ID</Button> : null}
          <LinkButton href="/admin/productos" variant="secondary" size="sm"><ArrowLeft aria-hidden size={16} />Volver</LinkButton>
        </div>
      </div>

      {submitError ? <FormAlert>{submitError}</FormAlert> : null}
      {mediaWarning ? <FormAlert>{mediaWarning}</FormAlert> : null}
      {statusMessage ? <div className="rounded-2xl border border-green-200 bg-white p-3 text-sm font-medium text-green-700">{statusMessage}</div> : null}

      <FormProvider {...methods}>
        <form onSubmit={submitForm} noValidate className="grid gap-5">
          <ProductIdentityCard />
          <ProductPricingCard />
          <ProductLogisticsCard categories={localCategories} onOpenCategoryDrawer={() => setAdvancedDrawer("category")} />
          <ProductAdvancedDrawersCard categories={localCategories} openDrawer={advancedDrawer} onOpenDrawerChange={setAdvancedDrawer} onCreateCategory={createLocalCategory} />
          <div className="flex flex-col-reverse gap-2 pb-4 sm:flex-row sm:justify-between">
            {product ? <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={handleDuplicate}>Duplicar</Button><Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}><Trash2 aria-hidden size={16} />Borrar</Button></div> : <span />}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <LinkButton href="/admin/productos" variant="secondary" size="md">Cancelar</LinkButton>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando…" : mode === "edit" ? "Guardar cambios" : "Guardar producto"}</Button>
            </div>
          </div>
        </form>
      </FormProvider>
      {deleteOpen ? <DeleteConfirmModal productName={product?.name ?? "producto"} onCancel={() => setDeleteOpen(false)} onConfirm={handleDelete} /> : null}
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

function DeleteConfirmModal({ onCancel, onConfirm, productName }: { onCancel: () => void; onConfirm: () => void; productName: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-product-title">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
        <h2 id="delete-product-title" className="text-lg font-semibold text-zinc-950">Confirmar eliminación</h2>
        <p className="mt-2 text-sm text-zinc-600">Vas a borrar <strong>{productName}</strong> del catálogo en memoria. Esta acción no afecta un backend real.</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button type="button" variant="danger" onClick={onConfirm}>Borrar producto</Button>
        </div>
      </div>
    </div>
  );
}
