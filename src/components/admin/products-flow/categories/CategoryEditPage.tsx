"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { LinkButton } from "@/components/ui/LinkButton";
import { CategoryForm } from "@/components/admin/products-flow/categories/CategoryForm";
import type { AdminProductCategory } from "@/lib/data/admin/sales-flow/mock-products";
import { useAdminCategoriesStore } from "@/stores/admin-categories-store";

export function CategoryEditPage({ categories, category }: { categories: AdminProductCategory[]; category: AdminProductCategory }) {
  const initializeCategories = useAdminCategoriesStore((state) => state.initializeCategories);

  useEffect(() => {
    initializeCategories(categories);
  }, [categories, initializeCategories]);

  return (
    <div className="mx-auto grid w-full max-w-4xl min-w-0 gap-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Categorías</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">Editar categoría</h1>
          <p className="mt-1 text-sm text-zinc-500">Actualizá los datos visibles, SEO y estado de la categoría.</p>
        </div>
        <LinkButton href="/admin/productos/categorias" variant="secondary" size="sm"><ArrowLeft aria-hidden size={16} />Volver</LinkButton>
      </header>
      <CategoryForm categories={categories} category={category} />
    </div>
  );
}
