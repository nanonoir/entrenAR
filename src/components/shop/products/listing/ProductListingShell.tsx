"use client";

import { SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductGrid } from "@/components/shop/products/ProductGrid";
import { QuickBuyController } from "@/components/shop/quick-buy/QuickBuyController";
import { ProductListingFilters } from "@/components/shop/products/listing/ProductListingFilters";
import { ProductListingSort } from "@/components/shop/products/listing/ProductListingSort";
import type { ProductListingResult, ProductListingSortValue } from "@/types/product-listing";

type ProductListingShellProps = {
  listing: ProductListingResult;
};

function setCsvParam(params: URLSearchParams, key: string, value: string) {
  const values = (params.get(key) ?? "").split(",").filter(Boolean);
  const nextValues = values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];

  if (nextValues.length === 0) {
    params.delete(key);
  } else {
    params.set(key, nextValues.join(","));
  }
}

export function ProductListingShell({ listing }: ProductListingShellProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function pushParams(params: URLSearchParams) {
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  function handleToggleFilter(paramName: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    setCsvParam(params, paramName, value);
    pushParams(params);
  }

  function handleApplyPrice(precioMin?: string, precioMax?: string) {
    const params = new URLSearchParams(searchParams.toString());
    const min = precioMin?.trim();
    const max = precioMax?.trim();

    if (min) {
      params.set("precioMin", min);
    } else {
      params.delete("precioMin");
    }

    if (max) {
      params.set("precioMax", max);
    } else {
      params.delete("precioMax");
    }

    pushParams(params);
  }

  function handleSortChange(value: ProductListingSortValue) {
    const params = new URLSearchParams(searchParams.toString());

    if (value === "relevantes") {
      params.delete("orden");
    } else {
      params.set("orden", value);
    }

    pushParams(params);
  }

  function handleClearFilters() {
    const params = new URLSearchParams(searchParams.toString());

    Array.from(params.keys()).forEach((key) => {
      if (
        key === "marca" ||
        key === "categoria" ||
        key === "subcategoria" ||
        key === "precioMin" ||
        key === "precioMax" ||
        key === "orden" ||
        key.startsWith("f_")
      ) {
        params.delete(key);
      }
    });

    pushParams(params);
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-5xl leading-none sm:text-6xl">{listing.context.title}</h1>
          <p className="mt-3 text-sm font-semibold uppercase text-text-muted">
            {listing.totalCount} productos encontrados
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="lg:hidden" onClick={() => setFiltersOpen(true)} size="sm" variant="secondary">
            <SlidersHorizontal aria-hidden size={16} />
            Filtros
          </Button>
          <ProductListingSort
            mobileOpen={sortOpen}
            onChange={handleSortChange}
            onCloseMobile={() => setSortOpen(false)}
            onOpenMobile={() => setSortOpen(true)}
            options={listing.sortOptions}
            value={listing.filterState.sort}
          />
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block">
          <ProductListingFilters
            filterState={listing.filterState}
            groups={listing.filterGroups}
            onApplyPrice={handleApplyPrice}
            onClearFilters={handleClearFilters}
            onToggleFilter={handleToggleFilter}
            priceBounds={listing.priceBounds}
          />
        </aside>

        <div>
          {listing.products.length > 0 ? (
            <QuickBuyController>
              <ProductGrid cardDensity="compactMobile" products={listing.products} />
            </QuickBuyController>
          ) : (
            <EmptyState
              action={
                <Button onClick={handleClearFilters} variant="secondary">
                  Limpiar filtros
                </Button>
              }
              description="Probá quitando alguna marca, categoría o rango de precio."
              title="No encontramos productos con esos filtros."
            />
          )}
        </div>
      </div>

      <Drawer onClose={() => setFiltersOpen(false)} open={filtersOpen} side="left" title="Filtros">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ProductListingFilters
              compact
              filterState={listing.filterState}
              groups={listing.filterGroups}
              onApplyPrice={handleApplyPrice}
              onClearFilters={handleClearFilters}
              onToggleFilter={handleToggleFilter}
              priceBounds={listing.priceBounds}
            />
          </div>
          <div className="border-t border-border p-4">
            <Button className="w-full" onClick={() => setFiltersOpen(false)}>
              Ver productos
            </Button>
          </div>
        </div>
      </Drawer>
    </>
  );
}
