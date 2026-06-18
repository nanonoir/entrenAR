"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import type { AdminProductCategory } from "@/lib/data/admin/sales-flow/mock-products";

export type ProductFilters = {
  categoryIds: string[];
  stock: "all" | "available" | "out" | "infinite";
  priceType: "all" | "promotional" | "regular";
  visibility: "all" | "visible" | "hidden";
};

export const defaultProductFilters: ProductFilters = {
  categoryIds: [],
  stock: "all",
  priceType: "all",
  visibility: "all",
};

type ProductFilterDrawerProps = {
  categories: AdminProductCategory[];
  draftFilters: ProductFilters;
  open: boolean;
  onClose: () => void;
  onApply: () => void;
  onClear: () => void;
  onDraftChange: (filters: ProductFilters) => void;
};

export function ProductFilterDrawer({ categories, draftFilters, open, onApply, onClear, onClose, onDraftChange }: ProductFilterDrawerProps) {
  function toggleCategory(categoryId: string) {
    onDraftChange({
      ...draftFilters,
      categoryIds: draftFilters.categoryIds.includes(categoryId)
        ? draftFilters.categoryIds.filter((id) => id !== categoryId)
        : [...draftFilters.categoryIds, categoryId],
    });
  }

  return (
    <Drawer open={open} onClose={onClose} title="Filtros" className="flex flex-col h-full min-h-0">
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="grid gap-6">
            <FilterSection title="Categoría">
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${draftFilters.categoryIds.includes(category.id) ? "border-accent bg-accent text-on-accent" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"}`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Stock">
              <RadioOption label="Todos" checked={draftFilters.stock === "all"} onChange={() => onDraftChange({ ...draftFilters, stock: "all" })} />
              <RadioOption label="Con stock" checked={draftFilters.stock === "available"} onChange={() => onDraftChange({ ...draftFilters, stock: "available" })} />
              <RadioOption label="Sin stock" checked={draftFilters.stock === "out"} onChange={() => onDraftChange({ ...draftFilters, stock: "out" })} />
              <RadioOption label="Stock infinito" checked={draftFilters.stock === "infinite"} onChange={() => onDraftChange({ ...draftFilters, stock: "infinite" })} />
            </FilterSection>

            <FilterSection title="Precio">
              <RadioOption label="Todos" checked={draftFilters.priceType === "all"} onChange={() => onDraftChange({ ...draftFilters, priceType: "all" })} />
              <RadioOption label="Con promocional" checked={draftFilters.priceType === "promotional"} onChange={() => onDraftChange({ ...draftFilters, priceType: "promotional" })} />
              <RadioOption label="Sin promocional" checked={draftFilters.priceType === "regular"} onChange={() => onDraftChange({ ...draftFilters, priceType: "regular" })} />
            </FilterSection>

            <FilterSection title="Visibilidad">
              <RadioOption label="Todas" checked={draftFilters.visibility === "all"} onChange={() => onDraftChange({ ...draftFilters, visibility: "all" })} />
              <RadioOption label="Visible" checked={draftFilters.visibility === "visible"} onChange={() => onDraftChange({ ...draftFilters, visibility: "visible" })} />
              <RadioOption label="Oculto" checked={draftFilters.visibility === "hidden"} onChange={() => onDraftChange({ ...draftFilters, visibility: "hidden" })} />
            </FilterSection>
          </div>
        </div>
        <div className="shrink-0 border-t border-zinc-200 p-4">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={onClear}>
              <X aria-hidden size={16} />
              Limpiar
            </Button>
            <Button onClick={onApply}>Aplicar</Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function FilterSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</legend>
      <div className="grid gap-2">{children}</div>
    </fieldset>
  );
}

function RadioOption({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-700">
      <input type="radio" checked={checked} onChange={onChange} className="shrink-0" />
      {label}
    </label>
  );
}
