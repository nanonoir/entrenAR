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
  void categories;

  return (
    <Drawer open={open} onClose={onClose} title="Filtros" className="flex flex-col h-full min-h-0">
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="grid gap-6">
            <FilterSection title="Stock">
              <PlainOption name="product-stock-filter" label="Todos" checked={draftFilters.stock === "all"} onChange={() => onDraftChange({ ...draftFilters, stock: "all" })} />
              <PlainOption name="product-stock-filter" label="Con stock" checked={draftFilters.stock === "available"} onChange={() => onDraftChange({ ...draftFilters, stock: "available" })} />
              <PlainOption name="product-stock-filter" label="Sin stock" checked={draftFilters.stock === "out"} onChange={() => onDraftChange({ ...draftFilters, stock: "out" })} />
              <PlainOption name="product-stock-filter" label="Stock infinito" checked={draftFilters.stock === "infinite"} onChange={() => onDraftChange({ ...draftFilters, stock: "infinite" })} />
            </FilterSection>

            <FilterSection title="Precio">
              <PlainOption name="product-price-filter" label="Todos" checked={draftFilters.priceType === "all"} onChange={() => onDraftChange({ ...draftFilters, priceType: "all" })} />
              <PlainOption name="product-price-filter" label="Con promocional" checked={draftFilters.priceType === "promotional"} onChange={() => onDraftChange({ ...draftFilters, priceType: "promotional" })} />
              <PlainOption name="product-price-filter" label="Sin promocional" checked={draftFilters.priceType === "regular"} onChange={() => onDraftChange({ ...draftFilters, priceType: "regular" })} />
            </FilterSection>

            <FilterSection title="Visibilidad">
              <PlainOption name="product-visibility-filter" label="Todas" checked={draftFilters.visibility === "all"} onChange={() => onDraftChange({ ...draftFilters, visibility: "all" })} />
              <PlainOption name="product-visibility-filter" label="Visible" checked={draftFilters.visibility === "visible"} onChange={() => onDraftChange({ ...draftFilters, visibility: "visible" })} />
              <PlainOption name="product-visibility-filter" label="Oculto" checked={draftFilters.visibility === "hidden"} onChange={() => onDraftChange({ ...draftFilters, visibility: "hidden" })} />
            </FilterSection>
          </div>
        </div>
        <div className="shrink-0 border-t border-border p-4">
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
      <legend className="text-sm font-semibold uppercase tracking-wide text-text-muted">{title}</legend>
      <div className="grid gap-2">{children}</div>
    </fieldset>
  );
}

function PlainOption({ checked, label, name, onChange }: { checked: boolean; label: string; name: string; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-text">
      <input type="checkbox" name={name} checked={checked} onChange={onChange} className="size-4 shrink-0 rounded border-border text-accent focus:ring-accent" />
      <span>{label}</span>
    </label>
  );
}
