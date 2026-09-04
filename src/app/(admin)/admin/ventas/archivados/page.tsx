"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Archive, Download, Search } from "lucide-react";
import { useAdminSalesStore } from "@/stores/admin-sales-store";
import {
  formatARS,
  formatShortDate,
  getPaymentStatusLabel,
  getPaymentStatusTone,
  getShippingStatusLabel,
  getShippingStatusTone,
} from "@/lib/data/admin/sales-flow/helpers";
import type { AdminSale } from "@/lib/data/admin/sales-flow/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type ArchivedFilter = "all" | "delivered" | "cancelled" | "refunded";

const FILTER_LABELS: Record<ArchivedFilter, string> = {
  all: "Todas",
  delivered: "Entregado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

function getArchivedFinalStatus(sale: AdminSale) {
  if (sale.paymentStatus === "cancelled" || sale.paymentStatus === "refunded") {
    return {
      label: getPaymentStatusLabel(sale.paymentStatus),
      tone: getPaymentStatusTone(sale.paymentStatus),
    };
  }

  return {
    label: getShippingStatusLabel(sale.shippingStatus),
    tone: getShippingStatusTone(sale.shippingStatus),
  };
}

export default function ArchivedSalesPage() {
  const sales = useAdminSalesStore((s) => s.sales);
  const fetchSales = useAdminSalesStore((s) => s.fetchSales);
  const isInitializing = useAdminSalesStore((s) => s.isInitializing);
  const hasLoaded = useAdminSalesStore((s) => s.hasLoaded);
  const source = useAdminSalesStore((s) => s.source);
  const error = useAdminSalesStore((s) => s.error);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ArchivedFilter>("all");

  useEffect(() => {
    if (source === "api" || !hasLoaded) void fetchSales({ limit: 100 });
  }, [fetchSales, hasLoaded, source]);

  const archivedSales = sales.filter((sale) => sale.archived);
  const filtered = archivedSales.filter((sale) => {
    if (activeFilter === "delivered" && sale.shippingStatus !== "delivered") return false;
    if (activeFilter === "cancelled" && sale.paymentStatus !== "cancelled") return false;
    if (activeFilter === "refunded" && sale.paymentStatus !== "refunded") return false;

    if (search.trim()) {
      const query = search.toLowerCase();
      const matches =
        sale.number.toLowerCase().includes(query) ||
        sale.customer.firstName.toLowerCase().includes(query) ||
        sale.customer.lastName.toLowerCase().includes(query) ||
        (sale.customer.email?.toLowerCase().includes(query) ?? false);
      if (!matches) return false;
    }

    return true;
  });

  const quickFilters: { key: ArchivedFilter; count: number }[] = [
    { key: "all", count: archivedSales.length },
    { key: "delivered", count: archivedSales.filter((sale) => sale.shippingStatus === "delivered").length },
    { key: "cancelled", count: archivedSales.filter((sale) => sale.paymentStatus === "cancelled").length },
    { key: "refunded", count: archivedSales.filter((sale) => sale.paymentStatus === "refunded").length },
  ];

  return (
    <div className="mx-auto grid max-w-7xl gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Ventas</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">Archivados</h1>
          <p className="mt-1 text-sm text-zinc-500">
            <span className="font-semibold text-zinc-800">{archivedSales.length}</span>{" "}
            {archivedSales.length === 1 ? "venta archivada" : "ventas archivadas"}
          </p>
        </div>
        <Button variant="secondary" size="sm">
          <Download aria-hidden size={16} />
          Exportar lista
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex h-11 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-sm text-zinc-600 shadow-sm transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
          <Search aria-hidden size={16} className="shrink-0 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="flex-1 bg-transparent text-base outline-none placeholder:text-zinc-400 md:text-sm"
            placeholder="Buscar por número, nombre o e-mail..."
            aria-label="Buscar ventas archivadas"
          />
        </label>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtros rápidos de archivados">
          {quickFilters.map(({ key, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveFilter(key)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition",
                activeFilter === key
                  ? "border-accent bg-accent text-on-accent"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50",
              )}
            >
              {FILTER_LABELS[key]}
              <span className={cn("inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold", activeFilter === key ? "bg-white/20 text-on-accent" : "bg-zinc-100 text-zinc-500")}>{count}</span>
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-3xl border border-red-100 bg-red-50 py-16 text-center text-sm font-medium text-red-700">{error.message}</div>
      ) : isInitializing ? (
        <div className="rounded-3xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-500">Cargando ventas archivadas…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-zinc-200 bg-white py-16 text-center shadow-sm">
          <Archive aria-hidden size={40} className="text-zinc-300" />
          <div>
            <p className="text-lg font-semibold text-zinc-800">No se encontraron ventas archivadas</p>
            <p className="mt-1 text-sm text-zinc-500">Probá con otro filtro o término de búsqueda.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm lg:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Venta</th>
                    <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Fecha</th>
                    <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Cliente</th>
                    <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Total</th>
                    <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Productos</th>
                    <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {filtered.map((sale) => (
                    <tr key={sale.id} className="transition hover:bg-zinc-50/80">
                      <td className="px-4 py-3">
                        <Link href={`/admin/ventas/${sale.id}`} className="font-semibold text-accent hover:underline">
                          {sale.number}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-zinc-600">{formatShortDate(sale.createdAt)}</td>
                      <td className="px-3 py-3 font-medium text-zinc-800">{sale.customer.firstName} {sale.customer.lastName}</td>
                      <td className="px-3 py-3 font-semibold text-zinc-900">{formatARS(sale.total)}</td>
                       <td className="px-3 py-3 text-zinc-600">{sale.itemCount ?? sale.products.reduce((sum, product) => sum + product.quantity, 0)} ud.</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {(() => {
                            const status = getArchivedFinalStatus(sale);
                            return <Badge tone={status.tone}>{status.label}</Badge>;
                          })()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 lg:hidden">
            {filtered.map((sale) => (
              <div key={sale.id} className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/admin/ventas/${sale.id}`} className="font-semibold text-accent hover:underline">{sale.number}</Link>
                  <span className="text-xs text-zinc-400">{formatShortDate(sale.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-zinc-800">{sale.customer.firstName} {sale.customer.lastName}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(() => {
                    const status = getArchivedFinalStatus(sale);
                    return <Badge tone={status.tone} className="text-[10px]">{status.label}</Badge>;
                  })()}
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                   <span className="text-zinc-500">{sale.itemCount ?? sale.products.reduce((sum, product) => sum + product.quantity, 0)} productos</span>
                  <span className="font-bold text-zinc-900">{formatARS(sale.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
