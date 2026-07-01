"use client";

import { Filter, Search } from "lucide-react";
import { AdminFilterDrawer, FilterOptionGroup, type FilterOption } from "@/components/admin/filters";
import { Button } from "@/components/ui/Button";

export type CouponSort = "code-asc" | "code-desc" | "newest" | "oldest" | "most-used" | "least-used";
export type CouponFiltersState = {
  discountType: "all" | "percentage" | "fixed" | "free_shipping";
  includesShipping: "all" | "yes" | "no";
  usage: "all" | "unlimited" | "limited";
  validity: "all" | "unlimited" | "period";
  minimumCart: "all" | "none" | "with";
  maxDiscount: "all" | "none" | "with";
  status: "all" | "active" | "inactive";
};

export const defaultCouponFilters: CouponFiltersState = {
  discountType: "all",
  includesShipping: "all",
  usage: "all",
  validity: "all",
  minimumCart: "all",
  maxDiscount: "all",
  status: "all",
};

const sortLabels: Record<CouponSort, string> = {
  "code-asc": "A-Z",
  "code-desc": "Z-A",
  newest: "Más nuevo",
  oldest: "Más viejo",
  "most-used": "Más usado",
  "least-used": "Menos usado",
};

const discountTypeOptions = [
  { value: "all", label: "Todos" },
  { value: "percentage", label: "Porcentaje" },
  { value: "fixed", label: "Monto fijo" },
  { value: "free_shipping", label: "Envío gratis" },
] satisfies readonly FilterOption[];

const shippingOptions = [
  { value: "all", label: "Todos" },
  { value: "yes", label: "Sí" },
  { value: "no", label: "No" },
] satisfies readonly FilterOption[];

const usageOptions = [
  { value: "all", label: "Todos" },
  { value: "unlimited", label: "Ilimitado" },
  { value: "limited", label: "Limitado" },
] satisfies readonly FilterOption[];

const validityOptions = [
  { value: "all", label: "Todos" },
  { value: "unlimited", label: "Ilimitado" },
  { value: "period", label: "Periodo" },
] satisfies readonly FilterOption[];

const minimumCartOptions = [
  { value: "all", label: "Todos" },
  { value: "none", label: "Sin mínimo" },
  { value: "with", label: "Con mínimo" },
] satisfies readonly FilterOption[];

const maxDiscountOptions = [
  { value: "all", label: "Todos" },
  { value: "none", label: "Sin tope" },
  { value: "with", label: "Con tope" },
] satisfies readonly FilterOption[];

const statusOptions = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Activado" },
  { value: "inactive", label: "Desactivado" },
] satisfies readonly FilterOption[];

type CouponFiltersProps = {
  draftFilters: CouponFiltersState;
  filterOpen: boolean;
  search: string;
  sort: CouponSort;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  onDraftFiltersChange: (filters: CouponFiltersState) => void;
  onFilterOpenChange: (open: boolean) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (sort: CouponSort) => void;
};

export function CouponFilters({ draftFilters, filterOpen, search, sort, onApplyFilters, onClearFilters, onDraftFiltersChange, onFilterOpenChange, onSearchChange, onSortChange }: CouponFiltersProps) {
  return (
    <div className="rounded-3xl border border-border bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
        <label className="relative grid gap-2 text-sm font-medium text-text" htmlFor="coupon-search">
          <span>Buscar por código</span>
          <input id="coupon-search" aria-label="Buscar por código" className="h-11 w-full rounded-button border border-border bg-surface px-3 pr-10 text-base outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm" type="search" value={search} onChange={(event) => onSearchChange(event.currentTarget.value)} />
          <Search aria-hidden className="pointer-events-none absolute bottom-3 right-3 text-text-muted" size={16} />
        </label>
        <Button variant="secondary" onClick={() => onFilterOpenChange(true)}><Filter aria-hidden size={16} />Filtrar</Button>
        <label className="grid gap-2 text-sm font-medium text-text" htmlFor="coupon-sort">
          <span>Ordenamiento</span>
          <select id="coupon-sort" className="h-11 rounded-button border border-border bg-surface px-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm" value={sort} onChange={(event) => onSortChange(event.currentTarget.value as CouponSort)}>
            {Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <AdminFilterDrawer open={filterOpen} onApply={onApplyFilters} onClear={onClearFilters} onClose={() => onFilterOpenChange(false)}>
        <FilterOptionGroup label="Tipo de descuento" name="coupon-discount-type" value={draftFilters.discountType} options={discountTypeOptions} onChange={(value) => onDraftFiltersChange({ ...draftFilters, discountType: value })} />
        <FilterOptionGroup label="Envío incluido" name="coupon-includes-shipping" value={draftFilters.includesShipping} options={shippingOptions} onChange={(value) => onDraftFiltersChange({ ...draftFilters, includesShipping: value })} />
        <FilterOptionGroup label="Cantidad de usos" name="coupon-usage" value={draftFilters.usage} options={usageOptions} onChange={(value) => onDraftFiltersChange({ ...draftFilters, usage: value })} />
        <FilterOptionGroup label="Vigencia" name="coupon-validity" value={draftFilters.validity} options={validityOptions} onChange={(value) => onDraftFiltersChange({ ...draftFilters, validity: value })} />
        <FilterOptionGroup label="Monto mínimo del carrito" name="coupon-minimum-cart" value={draftFilters.minimumCart} options={minimumCartOptions} onChange={(value) => onDraftFiltersChange({ ...draftFilters, minimumCart: value })} />
        <FilterOptionGroup label="Tope máximo de descuento" name="coupon-max-discount" value={draftFilters.maxDiscount} options={maxDiscountOptions} onChange={(value) => onDraftFiltersChange({ ...draftFilters, maxDiscount: value })} />
        <FilterOptionGroup label="Estado" name="coupon-status" value={draftFilters.status} options={statusOptions} onChange={(value) => onDraftFiltersChange({ ...draftFilters, status: value })} />
      </AdminFilterDrawer>
    </div>
  );
}
