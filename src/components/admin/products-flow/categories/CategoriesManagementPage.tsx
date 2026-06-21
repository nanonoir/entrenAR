"use client";

import { Eye, EyeOff, HelpCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { CategoryForm } from "@/components/admin/products-flow/categories/CategoryForm";
import type { AdminProductCategory } from "@/lib/data/admin/sales-flow/mock-products";
import { useAdminCategoriesStore } from "@/stores/admin-categories-store";

type CategoriesManagementPageProps = {
  categories: AdminProductCategory[];
};

export function CategoriesManagementPage({ categories: initialCategories }: CategoriesManagementPageProps) {
  const categories = useAdminCategoriesStore((state) => state.categories);
  const initializeCategories = useAdminCategoriesStore((state) => state.initializeCategories);
  const toggleCategoryVisibility = useAdminCategoriesStore((state) => state.toggleCategoryVisibility);
  const deleteCategory = useAdminCategoriesStore((state) => state.deleteCategory);
  const [creatingParentId, setCreatingParentId] = useState<string | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<AdminProductCategory | null>(null);

  useEffect(() => {
    initializeCategories(initialCategories);
  }, [initialCategories, initializeCategories]);

  const sourceCategories = categories.length > 0 ? categories : initialCategories;
  const rootCategories = useMemo(() => sourceCategories.filter((category) => !category.parentId), [sourceCategories]);

  return (
    <div className="mx-auto grid w-full max-w-5xl min-w-0 gap-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Productos</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">Categorías</h1>
          <p className="mt-1 text-sm text-zinc-500">Administrá categorías y subcategorías sin sincronización pública garantizada.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm"><HelpCircle aria-hidden size={16} />Ayuda</Button>
          <Button size="sm" onClick={() => setCreatingParentId("")}><Plus aria-hidden size={16} />Crear categoría</Button>
        </div>
      </header>

      {creatingParentId !== undefined ? <CategoryForm categories={sourceCategories} parentId={creatingParentId || undefined} onDone={() => setCreatingParentId(undefined)} /> : null}

      <section className="grid gap-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        {rootCategories.map((category) => (
          <CategoryNode
            key={category.id}
            category={category}
            categories={sourceCategories}
            onCreateChild={setCreatingParentId}
            onDelete={setDeleteTarget}
            onToggleVisibility={toggleCategoryVisibility}
          />
        ))}
      </section>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-category-title">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
            <h2 id="delete-category-title" className="text-lg font-semibold text-zinc-950">Eliminar categoría</h2>
            <p className="mt-2 text-sm text-zinc-600">Si eliminás esta categoría, se eliminarán automáticamente los productos que pertenezcan solo a esta categoría. Revisá antes de continuar: esta acción es irreversible.</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button variant="danger" onClick={() => { deleteCategory(deleteTarget.id); setDeleteTarget(null); }}>Eliminar</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CategoryNode({ categories, category, onCreateChild, onDelete, onToggleVisibility, visited = new Set<string>() }: { categories: AdminProductCategory[]; category: AdminProductCategory; onCreateChild: (id: string) => void; onDelete: (category: AdminProductCategory) => void; onToggleVisibility: (id: string) => void; visited?: Set<string> }) {
  const nextVisited = new Set(visited).add(category.id);
  const children = categories.filter((item) => item.parentId === category.id && !nextVisited.has(item.id));
  return (
    <article className="relative grid gap-3 rounded-2xl border border-zinc-100 p-3 before:absolute before:left-[-17px] before:top-6 before:hidden before:h-px before:w-4 before:bg-zinc-200 [&_article]:ml-4 [&_article]:border-l-accent/20 [&_article]:before:block">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-zinc-950">{category.name}</h2>
          <p className="truncate text-sm text-zinc-500">/{category.slug} · {category.visibility === "visible" ? "Visible" : "Oculta"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => onCreateChild(category.id)}><Plus aria-hidden size={14} />Subcategoría</Button>
          <Button aria-label={category.visibility === "visible" ? `Ocultar ${category.name}` : `Mostrar ${category.name}`} variant="secondary" size="icon" onClick={() => onToggleVisibility(category.id)}>{category.visibility === "visible" ? <Eye aria-hidden size={16} /> : <EyeOff aria-hidden size={16} />}</Button>
          <LinkButton aria-label={`Editar ${category.name}`} variant="secondary" size="icon" href={`/admin/productos/categorias/${category.id}`}><Pencil aria-hidden size={16} /></LinkButton>
          <Button aria-label={`Eliminar ${category.name}`} variant="danger" size="icon" onClick={() => onDelete(category)}><Trash2 aria-hidden size={16} /></Button>
        </div>
      </div>
      {children.length > 0 ? <div className="relative ml-2 grid gap-2 border-l border-zinc-200 pl-4">{children.map((child) => <CategoryNode key={child.id} category={child} categories={categories} onCreateChild={onCreateChild} onDelete={onDelete} onToggleVisibility={onToggleVisibility} visited={nextVisited} />)}</div> : null}
    </article>
  );
}
