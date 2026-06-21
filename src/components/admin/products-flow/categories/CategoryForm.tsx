"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { ImageDropZone } from "@/components/admin/products-flow/product-form/ImageDropZone";
import type { AdminProductCategory } from "@/lib/data/admin/sales-flow/mock-products";
import { categoryFormSchema, type CategoryFormInput, type CategoryFormValues } from "@/schemas/admin/product-schemas";
import { useAdminCategoriesStore } from "@/stores/admin-categories-store";
import { cn } from "@/lib/utils";

type CategoryFormProps = {
  categories: AdminProductCategory[];
  category?: AdminProductCategory;
  parentId?: string;
  onDone?: () => void;
};

function defaultValues(category?: AdminProductCategory, parentId?: string): CategoryFormInput {
  return {
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    description: category?.description ?? "",
    imageUrl: category?.imageUrl ?? "",
    googleShoppingCategory: category?.googleShoppingCategory ?? "",
    seoTitle: category?.seoTitle ?? "",
    seoDescription: category?.seoDescription ?? "",
    visibility: category?.visibility ?? "visible",
    parentId: category?.parentId ?? parentId ?? "",
  };
}

function getDescendantCategoryIds(categoryId: string, categories: AdminProductCategory[]) {
  const descendants = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    categories.forEach((item) => {
      if (item.parentId && (item.parentId === categoryId || descendants.has(item.parentId)) && !descendants.has(item.id)) {
        descendants.add(item.id);
        changed = true;
      }
    });
  }
  return descendants;
}

export function CategoryForm({ categories, category, onDone, parentId }: CategoryFormProps) {
  const router = useRouter();
  const createCategory = useAdminCategoriesStore((state) => state.createCategory);
  const updateCategory = useAdminCategoriesStore((state) => state.updateCategory);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { control, formState: { errors }, handleSubmit, register, setValue } = useForm<CategoryFormInput, unknown, CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: defaultValues(category, parentId),
    mode: "onBlur",
  });
  const imageUrl = useWatch({ control, name: "imageUrl" });
  const unavailableParentIds = category ? getDescendantCategoryIds(category.id, categories).add(category.id) : new Set<string>();
  const parentOptions = categories.filter((item) => !unavailableParentIds.has(item.id));

  async function onSubmit(data: CategoryFormValues) {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      if (category) {
        await updateCategory(category.id, data);
        setMessage("Categoría actualizada.");
      } else {
        await createCategory(data);
        setMessage("Categoría creada.");
      }
      onDone?.();
      if (category) router.push("/admin/productos/categorias");
    } catch {
      setSubmitError(category ? "No se pudieron guardar los cambios. Intentá nuevamente." : "No se pudo crear la categoría. Intentá nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      {message ? <p className="rounded-2xl border border-green-200 p-3 text-sm font-medium text-green-700">{message}</p> : null}
      {submitError ? <p className="rounded-2xl border border-sale/30 p-3 text-sm font-medium text-sale">{submitError}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Input id="category-name" label="Nombre" helperText="Nombre visible de la categoría." errorText={errors.name?.message} {...register("name")} />
        <Input id="category-slug" label="URL slug" helperText="Se genera automáticamente desde el nombre si lo dejás en blanco" errorText={errors.slug?.message} {...register("slug")} />
      </div>
      <Textarea id="category-description" label="Descripción" helperText="Máximo 140 caracteres." errorText={errors.description?.message} {...register("description")} />
      <div className="grid gap-4 md:grid-cols-2">
        <ImageDropZone label="Imagen" value={imageUrl} errorText={errors.imageUrl?.message} onChange={(value) => setValue("imageUrl", value, { shouldDirty: true, shouldValidate: true })} />
        <Input id="category-shopping" label="Google Shopping" helperText="Campo preparado para integración futura." errorText={errors.googleShoppingCategory?.message} {...register("googleShoppingCategory")} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Input id="category-seo-title" label="Título SEO" helperText="Máximo 70 caracteres." errorText={errors.seoTitle?.message} {...register("seoTitle")} />
        <Input id="category-seo-description" label="Descripción SEO" helperText="Máximo 160 caracteres." errorText={errors.seoDescription?.message} {...register("seoDescription")} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-text" htmlFor="category-parent">
          Categoría padre
          <select id="category-parent" className="h-11 rounded-button border border-border bg-surface px-3 text-base outline-none md:text-sm" {...register("parentId")}>
            <option value="">Sin padre</option>
            {parentOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-text" htmlFor="category-visibility">
          Visibilidad
          <select id="category-visibility" className="h-11 rounded-button border border-border bg-surface px-3 text-base outline-none md:text-sm" {...register("visibility")}>
            <option value="visible">Visible</option>
            <option value="hidden">Oculta</option>
          </select>
        </label>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={() => onDone ? onDone() : router.push("/admin/productos/categorias")}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting} className={cn(isSubmitting && "opacity-70")}>{isSubmitting ? "Guardando…" : category ? "Guardar cambios" : "Crear categoría"}</Button>
      </div>
    </form>
  );
}
