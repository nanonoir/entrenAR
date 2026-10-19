"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, History, PackageOpen, Search } from "lucide-react";
import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { InlineStockCell } from "@/components/admin/products-flow/inventory/InlineStockCell";
import {
  INVENTORY_STOCK_FILTER,
  defaultInventoryViewState,
  filterInventoryProducts,
  paginateInventory,
  parseInventoryViewState,
  serializeInventoryViewState,
  type InventoryStockFilter,
  type InventoryViewState,
} from "@/lib/data/admin/inventory-view";
import type { AdminProduct } from "@/lib/data/admin/sales-flow/mock-products";
import { useAdminProductsStore } from "@/stores/admin-products-store";

type InventoryPageProps = { products: AdminProduct[] };

const STOCK_FILTER_LABELS: Record<InventoryStockFilter, string> = {
  all: "Todo el stock",
  available: "Con stock",
  infinite: "Stock infinito",
  out: "Agotados",
};

export function InventoryPage(props: InventoryPageProps) {
  return <Suspense fallback={<div className="min-h-64" aria-busy="true" />}><InventoryPageContent {...props} /></Suspense>;
}

function InventoryPageContent({ products: initialProducts }: InventoryPageProps) {
  const products = useAdminProductsStore((state) => state.products);
  const initializeProducts = useAdminProductsStore((state) => state.initializeProducts);
  const searchParams = useSearchParams();
  // Search, filters and page live in the URL so returning from a history page restores the same view.
  const [view, setView] = useState<InventoryViewState>(() => parseInventoryViewState(searchParams));

  useEffect(() => { initializeProducts(initialProducts); }, [initialProducts, initializeProducts]);

  function updateView(patch: Partial<InventoryViewState>, resetPage = true) {
    const next = { ...view, ...patch, ...(resetPage ? { page: 1 } : {}) };
    setView(next);
    const query = serializeInventoryViewState(next);
    window.history.replaceState(window.history.state, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
  }

  const allProducts = useMemo(() => (products.length > 0 ? products : initialProducts).toSorted((a, b) => a.name.localeCompare(b.name)), [initialProducts, products]);
  const categories = useMemo(() => {
    const byId = new Map<string, string>();
    for (const product of allProducts) if (product.categoryId && product.categoryName) byId.set(product.categoryId, product.categoryName);
    return [...byId].map(([id, name]) => ({ id, name })).toSorted((a, b) => a.name.localeCompare(b.name));
  }, [allProducts]);
  const filtered = useMemo(() => filterInventoryProducts(allProducts, view), [allProducts, view]);
  const pageData = paginateInventory(filtered, view.page);
  const sourceProducts = pageData.items;
  const hasFilters = view.query.trim() !== "" || view.stock !== INVENTORY_STOCK_FILTER.ALL || view.categoryId !== "";

  return (
    <div className="mx-auto grid w-full max-w-6xl min-w-0 gap-5">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Productos</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">Inventario</h1>
        <p className="mt-1 text-sm text-zinc-500">Gestioná stock por producto y variante con historial en memoria.</p>
      </header>
      <div className="grid w-full min-w-0 gap-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_200px_220px] lg:items-center">
        <label className="flex h-11 min-w-0 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-zinc-600 shadow-sm transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
          <Search aria-hidden size={16} className="shrink-0 text-zinc-400" />
          <span className="sr-only">Buscar en inventario</span>
          <input type="search" value={view.query} onChange={(event) => updateView({ query: event.target.value })} placeholder="Buscar por nombre o SKU..." aria-label="Buscar en inventario" className="w-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-zinc-400 md:text-sm" />
        </label>
        <select aria-label="Filtrar por stock" value={view.stock} onChange={(event) => updateView({ stock: event.target.value as InventoryStockFilter })} className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-base text-zinc-700 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm">
          {Object.values(INVENTORY_STOCK_FILTER).map((value) => <option key={value} value={value}>{STOCK_FILTER_LABELS[value]}</option>)}
        </select>
        <select aria-label="Filtrar por categoría" value={view.categoryId} onChange={(event) => updateView({ categoryId: event.target.value })} className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-base text-zinc-700 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm">
          <option value="">Todas las categorías</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </div>
      <p className="text-sm text-zinc-500" role="status">
        <span className="font-semibold text-zinc-800">{pageData.total}</span> {hasFilters ? `de ${allProducts.length} ` : ""}{pageData.total === 1 ? "producto" : "productos"}
        {hasFilters ? <button type="button" className="ml-3 font-semibold text-accent hover:underline" onClick={() => updateView(defaultInventoryViewState)}>Limpiar filtros</button> : null}
      </p>
      {pageData.total === 0 ? (
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-zinc-800">{hasFilters ? "No encontramos productos con esos criterios." : "Todavía no hay productos en el inventario."}</p>
          {hasFilters ? <p className="mt-1 text-sm text-zinc-500">Probá con otra búsqueda o limpiá los filtros.</p> : null}
        </div>
      ) : null}
      <section className="grid w-full min-w-0 max-w-full gap-3 overflow-hidden" aria-label="Inventario de productos" hidden={pageData.total === 0}>
        <div className="hidden overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm lg:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  <InventoryHeaderCell>Producto</InventoryHeaderCell>
                  <InventoryHeaderCell>Stock</InventoryHeaderCell>
                  <InventoryHeaderCell>Variantes</InventoryHeaderCell>
                  <InventoryHeaderCell>SKU</InventoryHeaderCell>
                  <th scope="col" className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400">Historial</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {sourceProducts.map((product) => product.variantCombinations.length > 0 ? (
                  <Fragment key={product.id}>
                    <InventoryParentRow product={product} />
                    {product.variantCombinations.map((variant) => <InventoryTableRow key={`${product.id}-${variant.id}`} product={product} variant={variant} />)}
                  </Fragment>
                ) : <InventoryTableRow key={product.id} product={product} />)}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid w-full min-w-0 max-w-full gap-3 lg:hidden">
          {sourceProducts.map((product) => (
            <article key={product.id} className="w-full max-w-full min-w-0 overflow-hidden rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent"><PackageOpen size={20} /></div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold text-zinc-950">{product.name}</h2>
                  <p className="truncate text-sm text-zinc-500">{product.sku} · {product.categoryName}</p>
                </div>
                <Link className="inline-flex h-9 shrink-0 items-center gap-2 rounded-button border border-border bg-surface px-3 text-sm font-semibold uppercase text-text" href={`/admin/productos/inventario/${product.id}/historial`}><History size={14} />Historial</Link>
              </div>
              <div className="mt-4 grid gap-3">
                {product.variantCombinations.length === 0 ? (
                  <InventoryCardRow product={product} />
                ) : product.variantCombinations.slice(0, 6).map((variant) => (
                  <InventoryCardRow key={variant.id} product={product} variant={variant} />
                ))}
                {product.variantCombinations.length > 6 ? <p className="text-sm text-zinc-500">+ {product.variantCombinations.length - 6} variantes más preparadas.</p> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
      {pageData.totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="Paginación de inventario">
          <Button type="button" variant="secondary" size="sm" disabled={pageData.page <= 1} onClick={() => updateView({ page: pageData.page - 1 }, false)}><ChevronLeft aria-hidden size={16} />Anterior</Button>
          <p className="text-sm text-zinc-500">Página <span className="font-semibold text-zinc-800">{pageData.page}</span> de {pageData.totalPages}</p>
          <Button type="button" variant="secondary" size="sm" disabled={pageData.page >= pageData.totalPages} onClick={() => updateView({ page: pageData.page + 1 }, false)}>Siguiente<ChevronRight aria-hidden size={16} /></Button>
        </nav>
      ) : null}
    </div>
  );
}

function InventoryHeaderCell({ children }: { children: React.ReactNode }) {
  return <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">{children}</th>;
}

function InventoryTableRow({ product, variant }: { product: AdminProduct; variant?: AdminProduct["variantCombinations"][number] }) {
  const stock = getInventoryStock(product, variant);
  return (
    <tr className="transition hover:bg-zinc-50/80">
      <td className="px-3 py-4">
        {variant ? <div className="ml-8 border-l border-zinc-200 pl-4 text-sm font-semibold text-zinc-800">{variant.name}</div> : <ProductIdentity product={product} />}
      </td>
      <td className="px-3 py-4">
        <InlineStockCell productId={product.id} productName={variant?.name ?? product.name} variantId={variant?.id} initialStock={stock} />
      </td>
      <td className="px-3 py-4">
        <div className="min-w-0">
          <p className="truncate font-semibold text-zinc-800">{variant?.name ?? "Producto principal"}</p>
          <p className="truncate text-xs text-zinc-500">{product.variantCombinations.length ? `${product.variantCombinations.length} variantes` : "Sin variantes"}</p>
        </div>
      </td>
      <td className="px-3 py-4 font-medium text-zinc-700">{variant?.sku ?? product.sku}</td>
      <td className="px-3 py-4 text-right">
        <HistoryLink productId={product.id} />
      </td>
    </tr>
  );
}

function InventoryParentRow({ product }: { product: AdminProduct }) {
  const stock = getInventoryStock(product);
  return (
    <tr className="bg-zinc-50/70">
      <td className="px-3 py-4">
        <ProductIdentity product={product} />
      </td>
      <td className="px-3 py-4">
        <Badge tone={stock === "infinite" ? "success" : Number(stock) === 0 ? "sale" : "neutral"}>{stock === "infinite" ? "∞" : `${stock} unidades`}</Badge>
      </td>
      <td className="px-3 py-4 font-semibold text-zinc-800">{product.variantCombinations.length} variantes</td>
      <td className="px-3 py-4 font-medium text-zinc-700">{product.sku}</td>
      <td className="px-3 py-4 text-right"><HistoryLink productId={product.id} /></td>
    </tr>
  );
}

function InventoryCardRow({ product, variant }: { product: AdminProduct; variant?: AdminProduct["variantCombinations"][number] }) {
  const stock = getInventoryStock(product, variant);
  return (
    <div className="grid w-full max-w-full min-w-0 gap-3 rounded-2xl border border-zinc-100 p-3 lg:grid-cols-[minmax(0,1fr)_180px_260px] lg:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-zinc-800">{variant?.name ?? "Producto principal"}</p>
        <p className="truncate text-xs text-zinc-500">SKU: {variant?.sku ?? product.sku}</p>
      </div>
      <Badge tone={stock === "infinite" ? "success" : Number(stock) === 0 ? "sale" : "neutral"}>{stock === "infinite" ? "∞" : `${stock} unidades`}</Badge>
      <InlineStockCell productId={product.id} productName={variant?.name ?? product.name} variantId={variant?.id} initialStock={stock} />
    </div>
  );
}

function getInventoryStock(product: AdminProduct, variant?: AdminProduct["variantCombinations"][number]) {
  return variant ? variant.stock : product.stock.type === "infinite" ? "infinite" : product.stock.quantity;
}

function ProductIdentity({ product }: { product: AdminProduct }) {
  return (
    <div className="flex min-w-0 max-w-full items-center gap-3 overflow-hidden">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent"><PackageOpen size={18} /></div>
      <div className="min-w-0">
        <p className="block max-w-full truncate font-semibold text-zinc-950">{product.name}</p>
        <p className="block max-w-full truncate text-xs text-zinc-500">{product.categoryName}</p>
      </div>
    </div>
  );
}

function HistoryLink({ productId }: { productId: string }) {
  return <Link className="inline-flex h-9 shrink-0 items-center gap-2 rounded-button border border-border bg-surface px-3 text-sm font-semibold uppercase text-text" href={`/admin/productos/inventario/${productId}/historial`}><History size={14} />Historial</Link>;
}
