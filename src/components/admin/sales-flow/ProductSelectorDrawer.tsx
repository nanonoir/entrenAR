"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { getAllProductDetails } from "@/lib/data/products";
import type { SaleProduct } from "@/lib/data/admin/sales-flow/types";
import { formatARS } from "@/lib/data/admin/sales-flow/helpers";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/utils";

type ProductSelectorDrawerProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (products: SaleProduct[]) => void;
  selectedProductIds: string[];
};

const catalogProducts = getAllProductDetails();

function toSaleProduct(productId: string): SaleProduct | undefined {
  const product = catalogProducts.find((p) => p.id === productId);
  if (!product) return undefined;
  const firstVariant = product.variants?.[0];
  return {
    productId: product.id,
    variantId: firstVariant?.id,
    name: firstVariant ? `${product.name} (${firstVariant.label})` : product.name,
    quantity: 1,
    unitPrice: firstVariant?.price ?? product.price,
  };
}

export function ProductSelectorDrawer({ open, onClose, onAdd, selectedProductIds }: ProductSelectorDrawerProps) {
  const [query, setQuery] = useState("");
  const [checkedProductIds, setCheckedProductIds] = useState<string[]>([]);

  function handleClose() {
    setQuery("");
    setCheckedProductIds([]);
    onClose();
  }

  const filtered = useMemo(() => catalogProducts.filter((p) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q);
  }), [query]);

  function toggleProduct(productId: string) {
    if (selectedProductIds.includes(productId)) return;
    setCheckedProductIds((current) => current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]);
  }

  function handleConfirm() {
    const products = checkedProductIds.map(toSaleProduct).filter((product): product is SaleProduct => Boolean(product));
    if (products.length === 0) return;
    onAdd(products);
    handleClose();
  }

  return (
    <Drawer open={open} onClose={handleClose} title="Agregar producto" side="right" className="bg-white">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-zinc-100 px-4 py-3">
          <label htmlFor="product-drawer-search" className="mb-1.5 block text-sm font-medium text-zinc-700">Buscar producto</label>
          <div className="flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-600 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
            <Search aria-hidden size={16} className="shrink-0 text-zinc-400" />
            <input id="product-drawer-search" type="text" value={query} onChange={(e) => setQuery(e.currentTarget.value)} className="min-w-0 flex-1 bg-transparent text-base outline-none md:text-sm" aria-describedby="product-drawer-search-helper" />
          </div>
          <p id="product-drawer-search-helper" className="mt-1 text-xs text-text-muted">Buscá por nombre o marca y seleccioná uno o más productos.</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">No se encontraron productos.</p>
          ) : (
            <div className="grid gap-1">
              {filtered.map((product) => {
                const alreadyAdded = selectedProductIds.includes(product.id);
                const checked = checkedProductIds.includes(product.id);
                return (
                  <div key={product.id} className={cn("flex min-w-0 items-start gap-3 rounded-2xl p-3 transition", alreadyAdded ? "opacity-60" : "hover:bg-zinc-50")}>
                    <div className="shrink-0">
                      <Checkbox id={`product-select-${product.id}`} checked={checked || alreadyAdded} disabled={alreadyAdded} onChange={() => toggleProduct(product.id)} label={<span className="sr-only">Seleccionar {product.name}</span>} />
                    </div>
                    <button type="button" disabled={alreadyAdded} onClick={() => toggleProduct(product.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-not-allowed">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-lg">📦</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-zinc-900">{product.name}</span>
                        <span className="block truncate text-xs text-zinc-500">{product.brand} · {product.categoryName}</span>
                        <span className="mt-0.5 block text-xs font-semibold text-accent">{formatARS(product.price)}</span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-zinc-500">{alreadyAdded ? "Agregado" : checked ? "Seleccionado" : "Seleccionar"}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-zinc-100 p-4">
          <Button type="button" variant="primary" size="md" className="w-full" onClick={handleConfirm} disabled={checkedProductIds.length === 0}>
            Agregar {checkedProductIds.length} {checkedProductIds.length === 1 ? "producto" : "productos"}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
