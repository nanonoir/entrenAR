"use client";

import Link from "next/link";
import { History, PackageOpen } from "lucide-react";
import { useEffect } from "react";
import { Badge } from "@/components/ui/Badge";
import { InlineStockCell } from "@/components/admin/products-flow/inventory/InlineStockCell";
import type { AdminProduct } from "@/lib/data/admin/sales-flow/mock-products";
import { useAdminProductsStore } from "@/stores/admin-products-store";

type InventoryPageProps = { products: AdminProduct[] };

export function InventoryPage({ products: initialProducts }: InventoryPageProps) {
  const products = useAdminProductsStore((state) => state.products);
  const initializeProducts = useAdminProductsStore((state) => state.initializeProducts);

  useEffect(() => { initializeProducts(initialProducts); }, [initialProducts, initializeProducts]);

  const sourceProducts = (products.length > 0 ? products : initialProducts).toSorted((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto grid w-full max-w-6xl min-w-0 gap-5">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Productos</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">Inventario</h1>
        <p className="mt-1 text-sm text-zinc-500">Gestioná stock por producto y variante con historial en memoria.</p>
      </header>
      <section className="grid gap-3">
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
                <InventoryRow product={product} />
              ) : product.variantCombinations.slice(0, 6).map((variant) => (
                <InventoryRow key={variant.id} product={product} variant={variant} />
              ))}
              {product.variantCombinations.length > 6 ? <p className="text-sm text-zinc-500">+ {product.variantCombinations.length - 6} variantes más preparadas.</p> : null}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function InventoryRow({ product, variant }: { product: AdminProduct; variant?: AdminProduct["variantCombinations"][number] }) {
  const stock = variant ? variant.stock : product.stock.type === "infinite" ? "infinite" : product.stock.quantity;
  return (
    <div className="grid gap-3 rounded-2xl border border-zinc-100 p-3 lg:grid-cols-[minmax(0,1fr)_180px_260px] lg:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-zinc-800">{variant?.name ?? "Producto principal"}</p>
        <p className="truncate text-xs text-zinc-500">SKU: {variant?.sku ?? product.sku}</p>
      </div>
      <Badge tone={stock === "infinite" ? "success" : Number(stock) === 0 ? "sale" : "neutral"}>{stock === "infinite" ? "∞" : `${stock} unidades`}</Badge>
      <InlineStockCell productId={product.id} productName={variant?.name ?? product.name} variantId={variant?.id} initialStock={stock} />
    </div>
  );
}
