"use client";

import { Check, PlusCircle, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { AdminProductCategory } from "@/lib/data/admin/sales-flow/mock-products";

type ProductCategoryListProps = {
  categories: AdminProductCategory[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCreateCategory: (name: string) => AdminProductCategory;
};

function getCategoryPath(category: AdminProductCategory, categories: AdminProductCategory[]) {
  const byId = new Map(categories.map((item) => [item.id, item]));
  const path = [category.name];
  const visited = new Set([category.id]);
  let parentId = category.parentId;

  while (parentId) {
    if (visited.has(parentId)) break;
    const parent = byId.get(parentId);
    if (!parent) break;
    path.unshift(parent.name);
    visited.add(parent.id);
    parentId = parent.parentId;
  }

  return path.join(" / ");
}

export function ProductCategoryList({ categories, onChange, onCreateCategory, selectedIds }: ProductCategoryListProps) {
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [createError, setCreateError] = useState("");
  const categoryPaths = useMemo(() => new Map(categories.map((category) => [category.id, getCategoryPath(category, categories)])), [categories]);
  const { matchedCategories, visibleCategories } = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = query ? categories.filter((category) => (categoryPaths.get(category.id) ?? category.name).toLowerCase().includes(query)) : categories;
    const selectedNotMatched = categories.filter((category) => selectedIds.includes(category.id) && !matches.some((match) => match.id === category.id));
    return { matchedCategories: matches, visibleCategories: [...matches, ...selectedNotMatched] };
  }, [categories, categoryPaths, search, selectedIds]);

  function toggleCategory(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((categoryId) => categoryId !== id) : [...selectedIds, id]);
  }

  function createCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      setCreateError("Ingresá un nombre para crear la categoría.");
      return;
    }
    const created = onCreateCategory(name);
    onChange(Array.from(new Set([...selectedIds, created.id])));
    setNewCategoryName("");
    setIsCreating(false);
    setSearch("");
    setCreateError("");
  }

  return (
    <div className="flex flex-col gap-2">
      <Input id="category-search" label="Buscar categoría" helperText="Busca por nombre o ruta completa de jerarquía." value={search} onChange={(event) => setSearch(event.target.value)} />
      {isCreating ? (
        <div className="grid gap-2 border-y border-border py-2">
          <Input id="new-category-name" label="Nueva categoría" helperText="Se crea y queda seleccionada para continuar la edición." errorText={createError} value={newCategoryName} onChange={(event) => { setNewCategoryName(event.target.value); setCreateError(""); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); createCategory(); } }} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={createCategory}><Check aria-hidden size={16} />Crear</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => { setIsCreating(false); setNewCategoryName(""); }}><X aria-hidden size={16} />Cancelar</Button>
          </div>
        </div>
      ) : (
        <button type="button" className="flex w-full items-center gap-2 border-y border-border py-2 text-left font-semibold text-accent" onClick={() => setIsCreating(true)}>
          <PlusCircle aria-hidden className="shrink-0" size={18} />
          Crear categoría
        </button>
      )}
      <fieldset className="grid">
        <legend className="sr-only">Categorías del producto</legend>
        {matchedCategories.length === 0 && search.trim() ? <p className="py-2 text-sm text-text-muted">No hay categorías para esa búsqueda. Las seleccionadas siguen visibles debajo.</p> : null}
        {visibleCategories.map((category) => {
          const path = categoryPaths.get(category.id) ?? category.name;
          const selected = selectedIds.includes(category.id);
          return (
            <label key={category.id} className="flex w-full items-center justify-between gap-3 border-b border-border py-2 text-text">
              <span className="min-w-0 truncate" title={path}>
                <span className={selected ? "font-semibold" : undefined}>{path}</span>
              </span>
              <input type="checkbox" checked={selected} onChange={() => toggleCategory(category.id)} className="shrink-0" />
            </label>
          );
        })}
      </fieldset>
    </div>
  );
}
