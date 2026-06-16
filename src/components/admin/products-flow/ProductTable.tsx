"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, PackageOpen } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/LinkButton";
import { ProductActionMenu } from "@/components/admin/products-flow/ProductActionMenu";
import { formatARS } from "@/lib/data/admin/sales-flow/helpers";
import {
  formatAdminProductStock,
  getAdminProductStockTone,
  type AdminProduct,
} from "@/lib/data/admin/sales-flow/mock-products";
import { useAdminProductsStore } from "@/stores/admin-products-store";
import { cn } from "@/lib/utils";

type ProductTableProps = {
  products: AdminProduct[];
};

export function ProductTable({ products: initialProducts }: ProductTableProps) {
  const products = useAdminProductsStore((state) => state.products);
  const selectedProductIds = useAdminProductsStore((state) => state.selectedProductIds);
  const initializeProducts = useAdminProductsStore((state) => state.initializeProducts);
  const toggleProductSelection = useAdminProductsStore((state) => state.toggleProductSelection);
  const toggleAllProducts = useAdminProductsStore((state) => state.toggleAllProducts);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    initializeProducts(initialProducts);
  }, [initialProducts, initializeProducts]);

  const visibleProducts = products.length > 0 ? products : initialProducts;
  const visibleIds = visibleProducts.map((product) => product.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedProductIds.includes(id));
  const someVisibleSelected = visibleIds.some((id) => selectedProductIds.includes(id));

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [allVisibleSelected, someVisibleSelected]);

  if (visibleProducts.length === 0) return <ProductsEmptyState />;

  return (
    <section className="grid w-full min-w-0 max-w-full gap-3 overflow-hidden" aria-label="Catálogo de productos">
      <div className="hidden overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                <th scope="col" className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos los productos"
                    checked={allVisibleSelected}
                    ref={selectAllCheckboxRef}
                    onChange={() => toggleAllProducts(visibleIds)}
                    className="rounded border-zinc-300"
                  />
                </th>
                <ProductHeaderCell>Producto</ProductHeaderCell>
                <ProductHeaderCell>Stock</ProductHeaderCell>
                <ProductHeaderCell>Precio</ProductHeaderCell>
                <ProductHeaderCell>Promocional</ProductHeaderCell>
                <ProductHeaderCell>Estado</ProductHeaderCell>
                <th scope="col" className="w-14 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {visibleProducts.map((product) => (
                <tr key={product.id} className="transition hover:bg-zinc-50/80">
                  <td className="px-4 py-4 align-middle">
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${product.name}`}
                      checked={selectedProductIds.includes(product.id)}
                      onChange={() => toggleProductSelection(product.id)}
                      className="rounded border-zinc-300"
                    />
                  </td>
                  <td className="px-3 py-4">
                    <ProductIdentity product={product} />
                  </td>
                  <td className="px-3 py-4">
                    <Badge tone={getAdminProductStockTone(product.stock)}>{formatAdminProductStock(product.stock)}</Badge>
                  </td>
                  <td className="px-3 py-4">
                    <SalePrice product={product} />
                  </td>
                  <td className="px-3 py-4">
                    <PromotionalPrice product={product} />
                  </td>
                  <td className="px-3 py-4">
                    <Badge tone={product.visibility === "visible" ? "success" : "neutral"}>
                      {product.visibility === "visible" ? "Visible" : "Oculto"}
                    </Badge>
                  </td>
                  <td className="px-3 py-4">
                    <div className="relative flex justify-end">
                      <button
                        type="button"
                        aria-label={`Acciones para ${product.name}`}
                        aria-expanded={openMenuId === product.id}
                        onClick={() => setOpenMenuId((current) => (current === product.id ? null : product.id))}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
                      >
                        <MoreHorizontal aria-hidden size={18} />
                      </button>
                      {openMenuId === product.id && <ProductActionMenu product={product} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ProductRangeFooter count={visibleProducts.length} />
      </div>

      <div className="grid w-full min-w-0 max-w-full gap-3 lg:hidden">
        {visibleProducts.map((product) => (
          <article key={product.id} className="w-full max-w-full min-w-0 overflow-hidden rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="relative flex min-w-0 items-start gap-3 overflow-visible">
              <input
                type="checkbox"
                aria-label={`Seleccionar ${product.name}`}
                checked={selectedProductIds.includes(product.id)}
                onChange={() => toggleProductSelection(product.id)}
                className="mt-3 shrink-0 rounded border-zinc-300"
              />
              <div className="min-w-0 flex-1">
                <ProductIdentity product={product} />
              </div>
              <button
                type="button"
                aria-label={`Acciones para ${product.name}`}
                aria-expanded={openMenuId === product.id}
                onClick={() => setOpenMenuId((current) => (current === product.id ? null : product.id))}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
              >
                <MoreHorizontal aria-hidden size={18} />
              </button>
            </div>
            {openMenuId === product.id && <ProductActionMenu product={product} placement="inline" />}
            <dl className="mt-4 grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2 text-sm">
              <ProductMeta label="Stock">
                <Badge tone={getAdminProductStockTone(product.stock)} className="text-[10px]">
                  {formatAdminProductStock(product.stock)}
                </Badge>
              </ProductMeta>
              <ProductMeta label="Estado">
                <Badge tone={product.visibility === "visible" ? "success" : "neutral"} className="text-[10px]">
                  {product.visibility === "visible" ? "Visible" : "Oculto"}
                </Badge>
              </ProductMeta>
              <ProductMeta label="Precio"><SalePrice product={product} /></ProductMeta>
              <ProductMeta label="Promocional"><PromotionalPrice product={product} /></ProductMeta>
            </dl>
          </article>
        ))}
        <ProductRangeFooter count={visibleProducts.length} />
      </div>
    </section>
  );
}

function SalePrice({ product }: { product: AdminProduct }) {
  if (product.promotionalPrice) {
    return <span className="font-semibold text-zinc-400 line-through">{formatARS(product.salePrice)}</span>;
  }

  return <span className="font-semibold text-zinc-950">{formatARS(product.salePrice)}</span>;
}

function PromotionalPrice({ product }: { product: AdminProduct }) {
  if (!product.promotionalPrice) return <span className="text-zinc-400">—</span>;

  return <span className="font-bold text-accent">{formatARS(product.promotionalPrice)}</span>;
}

function ProductHeaderCell({ children }: { children: React.ReactNode }) {
  return <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">{children}</th>;
}

function ProductIdentity({ product }: { product: AdminProduct }) {
  return (
    <div className="flex min-w-0 max-w-full items-center gap-3 overflow-hidden">
      <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", product.imageUrl ? "bg-zinc-100" : "bg-accent-soft text-accent-hover")}>
        <PackageOpen aria-hidden size={20} />
      </div>
      <div className="min-w-0">
        <Link href={`/admin/productos/${product.id}`} className="block max-w-full truncate font-semibold text-accent hover:underline">
          {product.name}
        </Link>
        <p className="mt-1 block max-w-full truncate text-xs text-zinc-500">{product.sku} · {product.categoryName}</p>
      </div>
    </div>
  );
}

function ProductMeta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-1 min-w-0 font-medium text-zinc-800">{children}</dd>
    </div>
  );
}

function ProductRangeFooter({ count }: { count: number }) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:border-t lg:bg-transparent">
      Mostrando 1-{count} de {count} productos
    </div>
  );
}

function ProductsEmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-zinc-200 bg-white py-16 text-center shadow-sm">
      <PackageOpen aria-hidden size={40} className="text-zinc-300" />
      <div>
        <p className="text-lg font-semibold text-zinc-800">Todavía no hay productos</p>
        <p className="mt-1 text-sm text-zinc-500">Creá el primer producto del catálogo para empezar la gestión.</p>
      </div>
      <LinkButton variant="primary" size="sm" href="/admin/productos/nuevo">
        Agregar producto
      </LinkButton>
    </div>
  );
}
