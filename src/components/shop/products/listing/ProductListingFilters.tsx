"use client";

import { FilterX } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import type {
  ProductListingFilterGroup,
  ProductListingFilterOption,
  ProductListingFilterState,
} from "@/types/product-listing";

type ProductListingFiltersProps = {
  groups: ProductListingFilterGroup[];
  filterState: ProductListingFilterState;
  priceBounds: {
    min: number;
    max: number;
  };
  compact?: boolean;
  onToggleFilter: (paramName: string, value: string) => void;
  onApplyPrice: (precioMin?: string, precioMax?: string) => void;
  onClearFilters: () => void;
};

function getSelectedValues(group: ProductListingFilterGroup, filterState: ProductListingFilterState) {
  if (group.paramName === "marca") {
    return filterState.brandSlugs;
  }

  if (group.paramName === "categoria") {
    return filterState.categorySlugs;
  }

  if (group.paramName === "subcategoria") {
    return filterState.subcategorySlugs;
  }

  return [];
}

function getClampedPrice(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function ProductListingPriceFilter({
  filterState,
  priceBounds,
  onApplyPrice,
}: Pick<ProductListingFiltersProps, "filterState" | "priceBounds" | "onApplyPrice">) {
  const minBound = priceBounds.min;
  const maxBound = priceBounds.max;
  const [minValue, setMinValue] = useState(filterState.precioMin ?? minBound);
  const [maxValue, setMaxValue] = useState(filterState.precioMax ?? maxBound);
  const range = Math.max(maxBound - minBound, 1);
  const minPercent = ((minValue - minBound) / range) * 100;
  const maxPercent = ((maxValue - minBound) / range) * 100;

  function handlePriceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApplyPrice(String(minValue), String(maxValue));
  }

  function handleMinChange(value: string) {
    const nextValue = getClampedPrice(Number(value), minBound, maxValue);
    setMinValue(nextValue);
  }

  function handleMaxChange(value: string) {
    const nextValue = getClampedPrice(Number(value), minValue, maxBound);
    setMaxValue(nextValue);
  }

  return (
    <form className="grid gap-4" onSubmit={handlePriceSubmit}>
      <div className="grid grid-cols-2 gap-3">
        <Input
          inputMode="numeric"
          label="Mínimo"
          min={minBound}
          name="precioMin"
          onChange={(event) => handleMinChange(event.target.value)}
          placeholder={String(minBound)}
          type="number"
          value={minValue}
        />
        <Input
          inputMode="numeric"
          label="Máximo"
          max={maxBound}
          name="precioMax"
          onChange={(event) => handleMaxChange(event.target.value)}
          placeholder={String(maxBound)}
          type="number"
          value={maxValue}
        />
      </div>
      <Button className="w-full" size="sm" type="submit" variant="secondary">
        Aplicar precio
      </Button>
      <div className="relative h-8">
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-zinc-200" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent"
          style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }}
        />
        <input
          aria-label="Precio mínimo"
          className="pointer-events-none absolute inset-x-0 top-1/2 h-1 w-full -translate-y-1/2 appearance-none bg-transparent accent-accent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-md"
          max={maxBound}
          min={minBound}
          onChange={(event) => handleMinChange(event.target.value)}
          type="range"
          value={minValue}
        />
        <input
          aria-label="Precio máximo"
          className="pointer-events-none absolute inset-x-0 top-1/2 h-1 w-full -translate-y-1/2 appearance-none bg-transparent accent-accent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-md"
          max={maxBound}
          min={minBound}
          onChange={(event) => handleMaxChange(event.target.value)}
          type="range"
          value={maxValue}
        />
      </div>
    </form>
  );
}

function FilterOption({
  group,
  option,
  selectedValues,
  selectedSubcategories,
  onToggleFilter,
}: {
  group: ProductListingFilterGroup;
  option: ProductListingFilterOption;
  selectedValues: string[];
  selectedSubcategories: string[];
  onToggleFilter: ProductListingFiltersProps["onToggleFilter"];
}) {
  return (
    <div className="grid gap-2">
      <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-button px-2 text-sm transition hover:bg-black/5">
        <span className="flex items-center gap-3">
          <input
            checked={selectedValues.includes(option.id)}
            className="h-4 w-4 accent-accent"
            onChange={() => onToggleFilter(group.paramName, option.id)}
            type="checkbox"
          />
          <span>{option.label}</span>
        </span>
        <span className="text-xs text-text-muted">{option.count}</span>
      </label>

      {option.children && option.children.length > 0 ? (
        <div className="ml-5 grid gap-1 border-l border-border pl-3">
          {option.children.map((child) => (
            <label
              className="flex min-h-9 cursor-pointer items-center justify-between gap-3 rounded-button px-2 text-sm transition hover:bg-black/5"
              key={child.id}
            >
              <span className="flex items-center gap-3">
                <input
                  checked={selectedSubcategories.includes(child.id)}
                  className="h-4 w-4 accent-accent"
                  onChange={() => onToggleFilter("subcategoria", child.id)}
                  type="checkbox"
                />
                <span>{child.label}</span>
              </span>
              <span className="text-xs text-text-muted">{child.count}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProductListingFilters({
  groups,
  filterState,
  priceBounds,
  compact = false,
  onToggleFilter,
  onApplyPrice,
  onClearFilters,
}: ProductListingFiltersProps) {
  return (
    <div className={cn("grid gap-4", compact ? "px-4 py-5" : "")}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-subtitle text-lg font-semibold uppercase">Filtros</h2>
        <Button onClick={onClearFilters} size="sm" variant="ghost">
          <FilterX aria-hidden size={16} />
          Limpiar
        </Button>
      </div>

      <details className="rounded-card border border-border bg-white p-4" open>
        <summary className="cursor-pointer font-subtitle text-sm font-semibold uppercase">Precio</summary>
        <div className="pt-4">
          <ProductListingPriceFilter
            filterState={filterState}
            key={`${filterState.precioMin ?? "min"}-${filterState.precioMax ?? "max"}-${priceBounds.min}-${priceBounds.max}`}
            onApplyPrice={onApplyPrice}
            priceBounds={priceBounds}
          />
        </div>
      </details>

      {groups.map((group) => {
        const selectedValues = getSelectedValues(group, filterState);

        return (
          <details className="rounded-card border border-border bg-white p-4" key={group.id}>
            <summary className="cursor-pointer font-subtitle text-sm font-semibold uppercase">
              {group.label}
            </summary>
            <div className="grid gap-2 pt-3">
              {group.options.map((option) => (
                <FilterOption
                  group={group}
                  key={option.id}
                  onToggleFilter={onToggleFilter}
                  option={option}
                  selectedSubcategories={filterState.subcategorySlugs}
                  selectedValues={selectedValues}
                />
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
