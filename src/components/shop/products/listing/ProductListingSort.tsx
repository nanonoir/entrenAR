"use client";

import { ArrowDownUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { cn } from "@/lib/utils";
import type { ProductListingSortOption, ProductListingSortValue } from "@/types/product-listing";

type ProductListingSortProps = {
  options: ProductListingSortOption[];
  value: ProductListingSortValue;
  mobileOpen: boolean;
  onOpenMobile: () => void;
  onCloseMobile: () => void;
  onChange: (value: ProductListingSortValue) => void;
};

export function ProductListingSort({
  options,
  value,
  mobileOpen,
  onOpenMobile,
  onCloseMobile,
  onChange,
}: ProductListingSortProps) {
  return (
    <>
      <label className="hidden items-center gap-3 text-sm font-medium text-text lg:flex">
        <span>Ordenar por</span>
        <select
          className="h-10 min-w-48 rounded-button border border-border bg-surface px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          onChange={(event) => onChange(event.target.value as ProductListingSortValue)}
          value={value}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <Button className="lg:hidden" onClick={onOpenMobile} size="sm" variant="secondary">
        <ArrowDownUp aria-hidden size={16} />
        Ordenar por
      </Button>

      <Drawer onClose={onCloseMobile} open={mobileOpen} title="Ordenar por">
        <div className="grid gap-2 p-4">
          {options.map((option) => (
            <button
              className={cn(
                "flex min-h-12 items-center justify-between rounded-button border px-4 text-left font-subtitle text-sm font-semibold uppercase transition",
                option.value === value
                  ? "border-accent bg-accent-soft text-accent-hover"
                  : "border-border bg-white text-text hover:border-text",
              )}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                onCloseMobile();
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </Drawer>
    </>
  );
}
