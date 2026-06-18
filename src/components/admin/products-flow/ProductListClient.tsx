"use client";

import { Download, Filter, Plus, Search, SlidersHorizontal, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { ProductFilterDrawer, defaultProductFilters, type ProductFilters } from "@/components/admin/products-flow/ProductFilterDrawer";
import { ProductTable } from "@/components/admin/products-flow/ProductTable";
import type { AdminProduct, AdminProductCategory } from "@/lib/data/admin/sales-flow/mock-products";
import { useAdminProductsStore } from "@/stores/admin-products-store";

type ProductSort = "newest" | "oldest" | "price-asc" | "price-desc" | "az" | "za" | "best-selling" | "manual";

type ProductListClientProps = {
  categories: AdminProductCategory[];
  products: AdminProduct[];
};

const sortOptions: Array<{ label: string; value: ProductSort }> = [
  { label: "Más nuevo", value: "newest" },
  { label: "Menor precio", value: "price-asc" },
  { label: "Mayor precio", value: "price-desc" },
  { label: "A - Z", value: "az" },
  { label: "Z - A", value: "za" },
  { label: "Más viejo", value: "oldest" },
  { label: "Más vendidos", value: "best-selling" },
  { label: "Orden manual", value: "manual" },
];

function getEffectivePrice(product: AdminProduct) {
  return product.promotionalPrice ?? product.salePrice;
}

function matchesFilters(product: AdminProduct, filters: ProductFilters) {
  if (filters.categoryIds.length > 0 && !filters.categoryIds.includes(product.categoryId)) return false;
  if (filters.stock === "available" && product.stock.type === "limited" && product.stock.quantity <= 0) return false;
  if (filters.stock === "available" && product.stock.type !== "infinite" && product.stock.quantity <= 0) return false;
  if (filters.stock === "out" && (product.stock.type === "infinite" || product.stock.quantity > 0)) return false;
  if (filters.stock === "infinite" && product.stock.type !== "infinite") return false;
  if (filters.priceType === "promotional" && !product.promotionalPrice) return false;
  if (filters.priceType === "regular" && product.promotionalPrice) return false;
  if (filters.visibility !== "all" && product.visibility !== filters.visibility) return false;
  return true;
}

export function ProductListClient({ categories, products: initialProducts }: ProductListClientProps) {
  const products = useAdminProductsStore((state) => state.products);
  const initializeProducts = useAdminProductsStore((state) => state.initializeProducts);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ProductSort>("newest");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<ProductFilters>(defaultProductFilters);
  const [draftFilters, setDraftFilters] = useState<ProductFilters>(defaultProductFilters);

  useEffect(() => {
    initializeProducts(initialProducts);
  }, [initialProducts, initializeProducts]);

  const sourceProducts = products.length > 0 ? products : initialProducts;
  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...sourceProducts]
      .filter((product) => {
        const searchable = [product.name, product.sku, product.categoryName, ...product.tags].join(" ").toLowerCase();
        return query === "" || searchable.includes(query);
      })
      .filter((product) => matchesFilters(product, appliedFilters))
      .sort((a, b) => {
        if (sort === "price-asc") return getEffectivePrice(a) - getEffectivePrice(b);
        if (sort === "price-desc") return getEffectivePrice(b) - getEffectivePrice(a);
        if (sort === "az") return a.name.localeCompare(b.name);
        if (sort === "za") return b.name.localeCompare(a.name);
        if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sort === "best-selling") return b.salesCount - a.salesCount;
        if (sort === "manual") return a.manualOrder - b.manualOrder;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [appliedFilters, search, sort, sourceProducts]);

  return (
    <>
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Gestión</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">Productos</h1>
          <p className="mt-1 text-sm text-zinc-500">
            <span className="font-semibold text-zinc-800">{visibleProducts.length}</span> de {sourceProducts.length} productos
          </p>
        </div>
        <div className="grid w-full min-w-0 grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:flex sm:flex-wrap lg:w-auto lg:justify-end">
          <LinkButton className="w-full sm:w-auto" variant="secondary" size="sm" href="/admin/productos/organizar">
            <SlidersHorizontal aria-hidden size={16} />
            Organizar
          </LinkButton>
          <LinkButton className="w-full sm:w-auto" variant="secondary" size="sm" href="/admin/productos/importar-exportar">
            <Download aria-hidden size={16} />
            Exportar
          </LinkButton>
          <LinkButton className="w-full sm:w-auto" variant="secondary" size="sm" href="/admin/productos/importar-exportar">
            <Upload aria-hidden size={16} />
            Importar
          </LinkButton>
          <LinkButton className="w-full sm:w-auto" variant="primary" size="sm" href="/admin/productos/nuevo">
            <Plus aria-hidden size={16} />
            Agregar producto
          </LinkButton>
        </div>
      </div>

      <div className="grid w-full min-w-0 max-w-full gap-3 overflow-hidden rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
        <label className="flex h-11 w-full min-w-0 max-w-full items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-zinc-600 shadow-sm transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
          <Search aria-hidden size={16} className="shrink-0 text-zinc-400" />
          <span className="sr-only">Buscar productos</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, SKU o palabra clave..."
            className="w-full min-w-0 max-w-full flex-1 bg-transparent text-base outline-none placeholder:text-zinc-400 md:text-sm"
            aria-label="Buscar productos"
          />
        </label>
        <label className="flex h-11 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-600 shadow-sm">
          Orden
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as ProductSort)}
            className="min-w-0 bg-transparent text-base font-semibold text-zinc-900 outline-none md:text-sm"
            aria-label="Ordenar productos"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(true)}>
          <Filter aria-hidden size={16} />
          Filtros
        </Button>
      </div>

      <ProductTable products={visibleProducts} />

      <ProductFilterDrawer
        categories={categories}
        draftFilters={draftFilters}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onApply={() => {
          setAppliedFilters(draftFilters);
          setDrawerOpen(false);
        }}
        onClear={() => {
          setDraftFilters(defaultProductFilters);
          setAppliedFilters(defaultProductFilters);
          setDrawerOpen(false);
        }}
        onDraftChange={setDraftFilters}
      />
    </>
  );
}
