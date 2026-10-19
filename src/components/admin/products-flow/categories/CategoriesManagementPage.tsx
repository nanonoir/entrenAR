"use client";

import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { CategoryForm } from "@/components/admin/products-flow/categories/CategoryForm";
import type { AdminProductCategory } from "@/lib/data/admin/sales-flow/mock-products";
import { useAdminCategoriesStore } from "@/stores/admin-categories-store";

type CategoriesManagementPageProps = {
  categories: AdminProductCategory[];
  fetchedAt?: number;
};

export function CategoriesManagementPage({ categories: initialCategories, fetchedAt }: CategoriesManagementPageProps) {
  const categories = useAdminCategoriesStore((state) => state.categories);
  const hasLoaded = useAdminCategoriesStore((state) => state.hasLoaded);
  const pendingAction = useAdminCategoriesStore((state) => state.pendingAction);
  const error = useAdminCategoriesStore((state) => state.error);
  const syncError = useAdminCategoriesStore((state) => state.syncError);
  const clearError = useAdminCategoriesStore((state) => state.clearError);
  const initializeCategories = useAdminCategoriesStore((state) => state.initializeCategories);
  const toggleCategoryVisibility = useAdminCategoriesStore((state) => state.toggleCategoryVisibility);
  const deleteCategory = useAdminCategoriesStore((state) => state.deleteCategory);
  const [creatingParentId, setCreatingParentId] = useState<string | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<AdminProductCategory | null>(null);
  const isPending = pendingAction !== null;

  useEffect(() => {
    clearError();
    initializeCategories(initialCategories, fetchedAt);
  }, [clearError, fetchedAt, initialCategories, initializeCategories]);

  const sourceCategories = hasLoaded ? categories : initialCategories;

  // Failures surface in the store `error`; the modal/list read it from there.
  const toggleVisibility = (id: string) => { void toggleCategoryVisibility(id).catch(() => undefined); };
  const confirmDelete = (category: AdminProductCategory) => {
    void deleteCategory(category.id).then(() => setDeleteTarget(null)).catch(() => undefined);
  };
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
          <Button size="sm" disabled={isPending} onClick={() => setCreatingParentId("")}><Plus aria-hidden size={16} />Crear categoría</Button>
        </div>
      </header>

      {error && !deleteTarget ? <p role="alert" className="rounded-2xl border border-sale/30 p-3 text-sm font-medium text-sale">{error}</p> : null}
      {syncError ? <p role="status" className="rounded-2xl border border-amber-200 p-3 text-sm font-medium text-amber-700">{syncError}</p> : null}

      {creatingParentId !== undefined ? <CategoryForm categories={sourceCategories} parentId={creatingParentId || undefined} onDone={() => setCreatingParentId(undefined)} /> : null}

      <section className="grid gap-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        {rootCategories.map((category) => (
          <CategoryNode
            key={category.id}
            category={category}
            categories={sourceCategories}
            onCreateChild={setCreatingParentId}
            disabled={isPending}
            pendingId={pendingAction?.id}
            onDelete={(target) => { clearError(); setDeleteTarget(target); }}
            onToggleVisibility={toggleVisibility}
          />
        ))}
      </section>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-category-title">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
            <h2 id="delete-category-title" className="text-lg font-semibold text-zinc-950">Eliminar categoría</h2>
            <p className="mt-2 text-sm text-zinc-600">Se eliminará «{deleteTarget.name}» junto con sus subcategorías. Si algún producto está asociado a ellas, el servidor no permitirá eliminarla. Esta acción es irreversible.</p>
            {error ? <p role="alert" className="mt-3 rounded-2xl border border-sale/30 p-3 text-sm font-medium text-sale">{error}</p> : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" disabled={isPending} onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button variant="danger" disabled={isPending} onClick={() => confirmDelete(deleteTarget)}>{isPending ? "Eliminando…" : "Eliminar"}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type CategoryNodeProps = { categories: AdminProductCategory[]; category: AdminProductCategory; disabled: boolean; pendingId?: string; onCreateChild: (id: string) => void; onDelete: (category: AdminProductCategory) => void; onToggleVisibility: (id: string) => void; visited?: Set<string> };

function CategoryNode({ categories, category, disabled, pendingId, onCreateChild, onDelete, onToggleVisibility, visited = new Set<string>() }: CategoryNodeProps) {
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
          <Button variant="secondary" size="sm" disabled={disabled} onClick={() => onCreateChild(category.id)}><Plus aria-hidden size={14} />Subcategoría</Button>
          <Button aria-busy={pendingId === category.id} aria-label={category.visibility === "visible" ? `Ocultar ${category.name}` : `Mostrar ${category.name}`} variant="secondary" size="icon" disabled={disabled} onClick={() => onToggleVisibility(category.id)}>{category.visibility === "visible" ? <Eye aria-hidden size={16} /> : <EyeOff aria-hidden size={16} />}</Button>
          <LinkButton aria-label={`Editar ${category.name}`} variant="secondary" size="icon" href={`/admin/productos/categorias/${category.id}`}><Pencil aria-hidden size={16} /></LinkButton>
          <Button aria-label={`Eliminar ${category.name}`} variant="danger" size="icon" disabled={disabled} onClick={() => onDelete(category)}><Trash2 aria-hidden size={16} /></Button>
        </div>
      </div>
      {children.length > 0 ? <div className="relative ml-2 grid gap-2 border-l border-zinc-200 pl-4">{children.map((child) => <CategoryNode key={child.id} category={child} categories={categories} disabled={disabled} pendingId={pendingId} onCreateChild={onCreateChild} onDelete={onDelete} onToggleVisibility={onToggleVisibility} visited={nextVisited} />)}</div> : null}
    </article>
  );
}
