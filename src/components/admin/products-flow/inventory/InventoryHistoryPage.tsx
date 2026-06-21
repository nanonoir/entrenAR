"use client";

import { PackageSearch } from "lucide-react";
import { useEffect, useMemo } from "react";
import { AdminPageHeader } from "@/components/admin/layout/AdminPageHeader";
import type { AdminProduct } from "@/lib/data/admin/sales-flow/mock-products";
import { useAdminProductsStore } from "@/stores/admin-products-store";

export function InventoryHistoryPage({ product }: { product: AdminProduct }) {
  const initializeProducts = useAdminProductsStore((state) => state.initializeProducts);
  const stockHistory = useAdminProductsStore((state) => state.stockHistory);
  const history = useMemo(() => stockHistory.filter((entry) => entry.productId === product.id), [product.id, stockHistory]);

  useEffect(() => { initializeProducts([product]); }, [initializeProducts, product]);

  return (
    <div className="mx-auto grid w-full max-w-4xl min-w-0 gap-5">
      <AdminPageHeader title="Historial de stock" tag="Inventario" description={`${product.name} · movimientos en memoria para preparación backend.`} backLink={{ href: "/admin/productos/inventario", label: "Volver" }} />
      {history.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
          <PackageSearch className="text-zinc-300" size={36} />
          <p className="font-semibold text-zinc-800">Todavía no hay movimientos</p>
          <p className="text-sm text-zinc-500">Actualizá el stock desde Inventario para generar entradas de historial.</p>
        </div>
      ) : (
        <section className="grid gap-3">
          {history.map((entry) => (
            <article key={entry.id} className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold text-zinc-950">{entry.variantName ?? entry.productName}</h2>
                  <p className="text-sm text-zinc-500">{entry.change} · Resultado: {entry.resultingStock}</p>
                  {entry.reason ? <p className="mt-1 text-sm text-zinc-600">Motivo: {entry.reason}</p> : null}
                </div>
                <div className="text-sm text-zinc-500 sm:text-right">
                  <p>{entry.actor}</p>
                  <p>{entry.origin}</p>
                  <p>{new Date(entry.createdAt).toLocaleString("es-AR")}</p>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
