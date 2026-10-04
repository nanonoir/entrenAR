"use client";

import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductGrid } from "@/components/shop/products/ProductGrid";
import { QuickBuyController } from "@/components/shop/quick-buy/QuickBuyController";
import { ProductListingFilters } from "@/components/shop/products/listing/ProductListingFilters";
import { ProductListingSort } from "@/components/shop/products/listing/ProductListingSort";
import { resetListingPage, withListingPage } from "@/components/shop/products/listing/listing-query";
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
    const params = resetListingPage(new URLSearchParams(searchParams.toString()));
    setCsvParam(params, paramName, value);
    pushParams(params);
  }

  function handleApplyPrice(precioMin?: string, precioMax?: string) {
    const params = resetListingPage(new URLSearchParams(searchParams.toString()));
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
    const params = resetListingPage(new URLSearchParams(searchParams.toString()));

    if (value === "relevantes") {
      params.delete("orden");
    } else {
      params.set("orden", value);
    }

    pushParams(params);
  }

  function handleClearFilters() {
    const params = resetListingPage(new URLSearchParams(searchParams.toString()));

    Array.from(params.keys()).forEach((key) => {
      if (
        key === "marca" ||
        key === "categoria" ||
        key === "subcategoria" ||
        key === "precioMin" ||
        key === "precioMax" ||
        key === "orden"
      ) {
        params.delete(key);
      }
    });

    pushParams(params);
  }

  function handlePageChange(page: number) {
    pushParams(withListingPage(new URLSearchParams(searchParams.toString()), page));
  }

  const hasActiveFilters = listing.filterState.brandSlugs.length > 0
    || listing.filterState.categorySlugs.length > 0
    || listing.filterState.subcategorySlugs.length > 0
    || listing.filterState.precioMin !== undefined
    || listing.filterState.precioMax !== undefined;
  const currentQuery = searchParams.toString();
  const outOfRangePage = listing.totalCount > 0 && listing.products.length === 0;

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
          {listing.status === "error" ? (
            <div aria-live="assertive" className="rounded-card border border-border bg-white p-6" role="alert">
              <h2 className="font-subtitle text-lg font-semibold">No pudimos cargar el catálogo</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">No pudimos cargar los productos. Intenta nuevamente más tarde.</p>
              <a className="mt-4 inline-flex min-h-11 items-center rounded-button px-2 font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" href={currentQuery ? `${pathname}?${currentQuery}` : pathname}>
                Reintentar
              </a>
            </div>
          ) : listing.products.length > 0 ? (
            <QuickBuyController>
              <ProductGrid products={listing.products} />
            </QuickBuyController>
          ) : (
            <EmptyState
              action={
                <Button onClick={outOfRangePage ? () => handlePageChange(listing.totalPages) : handleClearFilters} variant="secondary">
                  {outOfRangePage ? "Ir a la última página" : "Limpiar filtros"}
                </Button>
              }
              description={outOfRangePage
                ? "Esta página ya no tiene resultados. Vuelve a una página disponible."
                : hasActiveFilters || listing.context.type === "search"
                ? "Ajusta los filtros o prueba con otros términos de búsqueda."
                : `Todavía no hay productos disponibles en ${listing.context.title}.`}
              title={outOfRangePage
                ? "No hay productos en esta página."
                : hasActiveFilters || listing.context.type === "search"
                ? "No encontramos productos con esos filtros."
                : "No hay productos disponibles."}
            />
          )}
        </div>
      </div>

      {listing.totalPages > 1 ? (
        <nav aria-label="Paginación de productos" className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <Button aria-label="Página anterior" className="min-h-11" disabled={listing.page <= 1} onClick={() => handlePageChange(listing.page - 1)} size="sm" variant="secondary">
            <ChevronLeft aria-hidden size={16} />
            Anterior
          </Button>
          <span aria-live="polite" className="px-2 text-sm font-medium text-text-muted">
            Página {listing.page} de {listing.totalPages}
          </span>
          <Button aria-label="Página siguiente" className="min-h-11" disabled={listing.page >= listing.totalPages} onClick={() => handlePageChange(listing.page + 1)} size="sm" variant="secondary">
            Siguiente
            <ChevronRight aria-hidden size={16} />
          </Button>
        </nav>
      ) : null}

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
