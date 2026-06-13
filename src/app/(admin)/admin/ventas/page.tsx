"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, ArchiveRestore, Download, Edit2, Eye, MoreHorizontal, Plus, RefreshCw, Search, ShoppingBag } from "lucide-react";
import { useAdminSalesStore } from "@/stores/admin-sales-store";
import {
  formatARS,
  formatShortDate,
  getActiveSalesCount,
  getPaymentStatusLabel,
  getPaymentStatusTone,
  getQuickFilterCounts,
  getShippingStatusLabel,
  getShippingStatusTone,
  isSaleEditable,
} from "@/lib/data/admin/sales-flow/helpers";
import { isSaleArchivable } from "@/lib/data/admin/sales-flow/archive";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { cn } from "@/lib/utils";

type QuickFilter = "all" | "porCobrar" | "porEmpaquetar" | "porEnviar" | "porRetirar" | "porArchivar";

const QUICK_FILTER_LABELS: Record<QuickFilter, string> = {
  all: "Todas",
  porCobrar: "Por cobrar",
  porEmpaquetar: "Por empaquetar",
  porEnviar: "Por enviar",
  porRetirar: "Por retirar",
  porArchivar: "Por archivar",
};

export default function SalesListPage() {
  const sales = useAdminSalesStore((s) => s.sales);
  const isInitializing = useAdminSalesStore((s) => s.isInitializing);
  const error = useAdminSalesStore((s) => s.error);
  const retryLoad = useAdminSalesStore((s) => s.retryLoad);
  const archiveSale = useAdminSalesStore((s) => s.archiveSale);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<QuickFilter>("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);

  // Only non-archived sales in the main list
  const baseSales = sales.filter((s) => !s.archived);

  const filterCounts = getQuickFilterCounts(sales);
  const openCount = getActiveSalesCount(sales);

  const filtered = baseSales.filter((sale) => {
    // Quick filter
    if (activeFilter === "porCobrar" && sale.paymentStatus !== "pending") return false;
    if (activeFilter === "porEmpaquetar" && (sale.shippingStatus !== "to_pack" || sale.paymentStatus === "cancelled")) return false;
    if (activeFilter === "porEnviar" && sale.shippingStatus !== "to_ship") return false;
    if (activeFilter === "porRetirar" && sale.shippingStatus !== "pickup") return false;
    if (activeFilter === "porArchivar" && !isSaleArchivable(sale)) return false;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      const matches =
        sale.number.toLowerCase().includes(q) ||
        sale.customer.firstName.toLowerCase().includes(q) ||
        sale.customer.lastName.toLowerCase().includes(q) ||
        (sale.customer.email?.toLowerCase().includes(q) ?? false);
      if (!matches) return false;
    }

    return true;
  });

  const quickFilters: { key: QuickFilter; count: number }[] = [
    { key: "all", count: baseSales.length },
    { key: "porCobrar", count: filterCounts.porCobrar },
    { key: "porEmpaquetar", count: filterCounts.porEmpaquetar },
    { key: "porEnviar", count: filterCounts.porEnviar },
    { key: "porRetirar", count: filterCounts.porRetirar },
    { key: "porArchivar", count: filterCounts.porArchivar },
  ];

  const visibleIds = filtered.map((sale) => sale.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSaleIds.includes(id));
  const someVisibleSelected = visibleIds.some((id) => selectedSaleIds.includes(id));
  const selectedEligibleSales = filtered.filter((sale) => selectedSaleIds.includes(sale.id) && isSaleArchivable(sale));

  function toggleSelectAllVisible() {
    setSelectedSaleIds((current) => {
      if (allVisibleSelected) return current.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  function toggleSaleSelection(id: string) {
    setSelectedSaleIds((current) => (current.includes(id) ? current.filter((saleId) => saleId !== id) : [...current, id]));
  }

  function handleBulkArchive() {
    selectedEligibleSales.forEach((sale) => archiveSale(sale.id));
    setSelectedSaleIds((current) => current.filter((id) => !selectedEligibleSales.some((sale) => sale.id === id)));
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Gestión</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">Ventas</h1>
          <p className="mt-1 text-sm text-zinc-500">
            <span className="font-semibold text-zinc-800">{openCount}</span>{" "}
            {openCount === 1 ? "abierta" : "abiertas"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {selectedSaleIds.length > 0 && (
            <Button variant="secondary" size="sm" onClick={handleBulkArchive} disabled={selectedEligibleSales.length === 0}>
              <ArchiveRestore aria-hidden size={16} />
              Archivar
            </Button>
          )}
          <Button variant="secondary" size="sm">
            <Download aria-hidden size={16} />
            Exportar lista
          </Button>
          <LinkButton variant="primary" size="sm" href="/admin/ventas/nueva">
            <Plus aria-hidden size={16} />
            Agregar orden de compra
          </LinkButton>
        </div>
      </div>

      {/* Search + Quick filters */}
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 h-11 text-sm text-zinc-600 shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition">
          <Search aria-hidden size={16} className="shrink-0 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por número, nombre o e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-base outline-none placeholder:text-zinc-400 md:text-sm"
            aria-label="Buscar ventas"
          />
        </label>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtros rápidos">
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
              {QUICK_FILTER_LABELS[key]}
              <span
                className={cn(
                  "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                  activeFilter === key ? "bg-white/20 text-on-accent" : "bg-zinc-100 text-zinc-500",
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorState onRetry={retryLoad} />
      ) : isInitializing ? (
        <SalesListSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState hasSearch={!!search.trim()} />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm lg:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th scope="col" className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="Seleccionar todos"
                        checked={allVisibleSelected}
                        ref={(input) => {
                          if (input) input.indeterminate = someVisibleSelected && !allVisibleSelected;
                        }}
                        onChange={toggleSelectAllVisible}
                        className="rounded border-zinc-300"
                      />
                    </th>
                    <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Venta</th>
                    <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Fecha</th>
                    <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Cliente</th>
                    <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Total</th>
                    <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Productos</th>
                    <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Pago</th>
                    <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Envío</th>
                    <th scope="col" className="w-12 px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {filtered.map((sale) => (
                    <tr key={sale.id} className="group transition hover:bg-zinc-50/80">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar venta ${sale.number}`}
                          checked={selectedSaleIds.includes(sale.id)}
                          onChange={() => toggleSaleSelection(sale.id)}
                          className="rounded border-zinc-300"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/admin/ventas/${sale.id}`}
                          className="font-semibold text-accent hover:underline"
                        >
                          {sale.number}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-zinc-600">{formatShortDate(sale.createdAt)}</td>
                      <td className="px-3 py-3 font-medium text-zinc-800">
                        {sale.customer.firstName} {sale.customer.lastName}
                      </td>
                      <td className="px-3 py-3 font-semibold text-zinc-900">{formatARS(sale.total)}</td>
                      <td className="px-3 py-3 text-zinc-600">
                        {sale.products.reduce((sum, p) => sum + p.quantity, 0)} ud.
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={getPaymentStatusTone(sale.paymentStatus)}>
                          {getPaymentStatusLabel(sale.paymentStatus)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={getShippingStatusTone(sale.shippingStatus)}>
                          {getShippingStatusLabel(sale.shippingStatus)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="relative flex justify-end">
                          <button
                            type="button"
                            className="rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"
                            aria-label={`Acciones para ${sale.number}`}
                            aria-expanded={openMenuId === sale.id}
                            onClick={() => setOpenMenuId((current) => (current === sale.id ? null : sale.id))}
                          >
                            <MoreHorizontal aria-hidden size={18} />
                          </button>
                          {openMenuId === sale.id && (
                            <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-2xl border border-zinc-200 bg-white py-1.5 shadow-xl">
                              <Link
                                href={`/admin/ventas/${sale.id}`}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
                              >
                                <Eye aria-hidden size={14} />
                                Ver detalle
                              </Link>
                              {isSaleEditable(sale) && (
                                <Link
                                  href={`/admin/ventas/${sale.id}/editar`}
                                  className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
                                >
                                  <Edit2 aria-hidden size={14} />
                                  Editar
                                </Link>
                              )}
                              {isSaleArchivable(sale) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    archiveSale(sale.id);
                                    setOpenMenuId(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50"
                                >
                                  <Archive aria-hidden size={14} />
                                  Archivar
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 lg:hidden">
            {filtered.map((sale) => (
              <div
                key={sale.id}
                className="flex flex-col gap-2 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <Link href={`/admin/ventas/${sale.id}`} className="font-semibold text-accent hover:underline">{sale.number}</Link>
                  <span className="text-xs text-zinc-400">{formatShortDate(sale.createdAt)}</span>
                </div>
                <div className="text-sm font-medium text-zinc-800">
                  {sale.customer.firstName} {sale.customer.lastName}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={getPaymentStatusTone(sale.paymentStatus)} className="text-[10px]">
                    {getPaymentStatusLabel(sale.paymentStatus)}
                  </Badge>
                  <Badge tone={getShippingStatusTone(sale.shippingStatus)} className="text-[10px]">
                    {getShippingStatusLabel(sale.shippingStatus)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">{sale.products.reduce((s, p) => s + p.quantity, 0)} productos</span>
                  <span className="font-bold text-zinc-900">{formatARS(sale.total)}</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Link href={`/admin/ventas/${sale.id}`} className="text-xs font-semibold text-accent hover:underline">
                    Ver detalle
                  </Link>
                  {isSaleEditable(sale) && (
                    <Link href={`/admin/ventas/${sale.id}/editar`} className="text-xs font-semibold text-zinc-600 hover:text-accent">
                      Editar
                    </Link>
                  )}
                  {isSaleArchivable(sale) && (
                    <button
                      type="button"
                      onClick={() => archiveSale(sale.id)}
                      className="text-xs font-semibold text-zinc-600 hover:text-accent"
                    >
                      Archivar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SalesListSkeleton() {
  return (
    <div className="grid gap-3" aria-label="Cargando ventas">
      <div className="hidden overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm lg:block">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="grid grid-cols-[48px_1fr_1fr_1.4fr_1fr_1fr_1fr_1fr_48px] gap-3 border-b border-zinc-50 px-4 py-4 last:border-b-0">
            {Array.from({ length: 9 }).map((_, index) => (
              <span key={index} className="h-4 animate-pulse rounded-full bg-zinc-100" />
            ))}
          </div>
        ))}
      </div>
      <div className="grid gap-3 lg:hidden">
        {[0, 1, 2].map((card) => (
          <div key={card} className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="h-4 w-24 animate-pulse rounded-full bg-zinc-100" />
            <div className="mt-3 h-4 w-40 animate-pulse rounded-full bg-zinc-100" />
            <div className="mt-4 h-5 w-full animate-pulse rounded-full bg-zinc-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-red-100 bg-red-50 py-16 text-center shadow-sm">
      <ShoppingBag aria-hidden size={40} className="text-red-300" />
      <div>
        <p className="text-lg font-semibold text-zinc-800">No pudimos cargar las ventas</p>
        <p className="mt-1 text-sm text-zinc-500">Reintentá la carga del listado.</p>
      </div>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        <RefreshCw aria-hidden size={16} />
        Reintentar
      </Button>
    </div>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-zinc-200 bg-white py-16 text-center shadow-sm">
      <ShoppingBag aria-hidden size={40} className="text-zinc-300" />
      <div>
        <p className="text-lg font-semibold text-zinc-800">
          {hasSearch ? "No se encontraron ventas" : "Todavía no hay ventas"}
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          {hasSearch ? "Probá con otro término de búsqueda." : "Creá la primera orden de compra para empezar."}
        </p>
      </div>
      {!hasSearch && (
        <LinkButton variant="primary" size="sm" href="/admin/ventas/nueva">
          <Plus aria-hidden size={16} />
          Agregar orden de compra
        </LinkButton>
      )}
    </div>
  );
}
