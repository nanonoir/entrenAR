"use client";

import { AdminFilterDrawer, FilterOptionGroup, type FilterOption } from "@/components/admin/filters";
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

const stockOptions = [
  { value: "all", label: "Todos" },
  { value: "available", label: "Con stock" },
  { value: "out", label: "Sin stock" },
  { value: "infinite", label: "Stock infinito" },
] satisfies readonly FilterOption[];

const priceOptions = [
  { value: "all", label: "Todos" },
  { value: "promotional", label: "Con promocional" },
  { value: "regular", label: "Sin promocional" },
] satisfies readonly FilterOption[];

const visibilityOptions = [
  { value: "all", label: "Todas" },
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Oculto" },
] satisfies readonly FilterOption[];

export function ProductFilterDrawer({ categories, draftFilters, open, onApply, onClear, onClose, onDraftChange }: ProductFilterDrawerProps) {
  // Category filtering is intentionally out of scope for this normalization; keep the public prop stable.
  void categories;

  return (
    <AdminFilterDrawer open={open} title="Filtros" onApply={onApply} onClear={onClear} onClose={onClose}>
      <FilterOptionGroup label="Stock" name="product-stock-filter" value={draftFilters.stock} options={stockOptions} onChange={(stock) => onDraftChange({ ...draftFilters, stock })} />
      <FilterOptionGroup label="Precio" name="product-price-filter" value={draftFilters.priceType} options={priceOptions} onChange={(priceType) => onDraftChange({ ...draftFilters, priceType })} />
      <FilterOptionGroup label="Visibilidad" name="product-visibility-filter" value={draftFilters.visibility} options={visibilityOptions} onChange={(visibility) => onDraftChange({ ...draftFilters, visibility })} />
    </AdminFilterDrawer>
  );
}
