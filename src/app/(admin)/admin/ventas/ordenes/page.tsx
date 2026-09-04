"use client";

import Link from "next/link";
import { Copy, Eye, Link as LinkIcon, Package, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useAdminSalesStore } from "@/stores/admin-sales-store";
import { useAdminToastStore } from "@/stores/admin-toast-store";
import { formatARS, formatShortDate } from "@/lib/data/admin/sales-flow/helpers";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/LinkButton";

const MOCK_PAYMENT_LINK = "https://pagos.entrenar.ar/link/placeholder";

export default function PurchaseOrdersPage() {
  const purchaseOrders = useAdminSalesStore((s) => s.purchaseOrders);
  const deletePurchaseOrder = useAdminSalesStore((s) => s.deletePurchaseOrder);
  const fetchPurchaseOrders = useAdminSalesStore((s) => s.fetchPurchaseOrders);
  const isInitializing = useAdminSalesStore((s) => s.isInitializing);
  const hasLoaded = useAdminSalesStore((s) => s.hasLoaded);
  const source = useAdminSalesStore((s) => s.source);
  const error = useAdminSalesStore((s) => s.error);
  const retryLoad = useAdminSalesStore((s) => s.retryLoad);
  const addToast = useAdminToastStore((s) => s.addToast);

  const pendingOrders = purchaseOrders.filter((o) => o.status === "pending");

  useEffect(() => {
    if (source === "api" || !hasLoaded) void fetchPurchaseOrders();
  }, [fetchPurchaseOrders, hasLoaded, source]);

  async function handleCopyPaymentLink() {
    try {
      await navigator.clipboard.writeText(MOCK_PAYMENT_LINK);
      addToast("Link copiado", "success");
    } catch {
      addToast("No se pudo copiar el link", "error");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Ventas</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">Órdenes de Compra</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {pendingOrders.length} {pendingOrders.length === 1 ? "orden pendiente" : "órdenes pendientes"}
          </p>
        </div>
        <LinkButton href="/admin/ventas/nueva" variant="primary" size="sm">
          <Plus aria-hidden size={16} />
          Nueva orden
        </LinkButton>
      </div>

      {error ? (
        <div role="alert" className="flex flex-col items-center gap-4 rounded-3xl border border-red-100 bg-red-50 py-16 text-center shadow-sm">
          <RefreshCw aria-hidden size={32} className="text-red-300" />
          <p className="text-sm font-medium text-red-700">{error.message}</p>
          <button type="button" onClick={() => void retryLoad()} className="text-sm font-semibold text-accent underline">Reintentar</button>
        </div>
      ) : isInitializing ? (
        <div className="rounded-3xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-500">Cargando órdenes…</div>
      ) : pendingOrders.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-zinc-200 bg-white py-16 text-center shadow-sm">
          <Package aria-hidden size={40} className="text-zinc-300" />
          <div>
            <p className="text-lg font-semibold text-zinc-800">No hay órdenes de compra pendientes</p>
            <p className="mt-1 text-sm text-zinc-500">
              Las órdenes con pago no realizado aparecen aquí hasta ser convertidas a ventas.
            </p>
          </div>
        </div>
      ) : (
        <>
        <div className="hidden overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm lg:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">ID</th>
                  <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Cliente</th>
                  <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Fecha</th>
                  <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Total</th>
                  <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Productos</th>
                  <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Estado</th>
                  <th scope="col" className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {pendingOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-zinc-50/80 transition">
                    <td className="px-4 py-3">
                      <Link href={`/admin/ventas/ordenes/${order.id}`} className="font-mono text-xs font-semibold text-accent hover:underline">
                        {order.id}
                      </Link>
                    </td>
                    <td className="px-3 py-3 font-medium text-zinc-800">
                      {order.customer.firstName} {order.customer.lastName}
                    </td>
                    <td className="px-3 py-3 text-zinc-600">{formatShortDate(order.createdAt)}</td>
                    <td className="px-3 py-3 font-semibold text-zinc-900">{formatARS(order.total)}</td>
                    <td className="px-3 py-3 text-zinc-600">
                      {order.products.reduce((sum, product) => sum + product.quantity, 0)} ud.
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone="warning">Pendiente</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          aria-label={`Copiar link de pago de ${order.id}`}
                          onClick={handleCopyPaymentLink}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
                        >
                          <LinkIcon aria-hidden size={16} />
                        </button>
                        <Link
                          href={`/admin/ventas/ordenes/${order.id}`}
                          aria-label={`Ver detalle de ${order.id}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
                        >
                          <Eye aria-hidden size={16} />
                        </Link>
                        <button
                          type="button"
                          aria-label={`Eliminar ${order.id}`}
                          onClick={() => void deletePurchaseOrder(order.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 aria-hidden size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="grid gap-3 lg:hidden">
          {pendingOrders.map((order) => (
            <article key={order.id} className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/admin/ventas/ordenes/${order.id}`} className="font-mono text-xs font-semibold text-accent hover:underline">
                    {order.id}
                  </Link>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">
                    {order.customer.firstName} {order.customer.lastName}
                  </p>
                </div>
                <Badge tone="warning">Pendiente</Badge>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Fecha</dt>
                  <dd className="mt-1 text-zinc-700">{formatShortDate(order.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Total</dt>
                  <dd className="mt-1 font-semibold text-zinc-950">{formatARS(order.total)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Productos</dt>
                  <dd className="mt-1 text-zinc-700">{order.products.reduce((sum, product) => sum + product.quantity, 0)} ud.</dd>
                </div>
              </dl>
              <div className="mt-4 flex justify-end gap-1.5 border-t border-zinc-100 pt-3">
                <button type="button" aria-label={`Copiar link de pago de ${order.id}`} onClick={handleCopyPaymentLink} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950">
                  <Copy aria-hidden size={16} />
                </button>
                <Link href={`/admin/ventas/ordenes/${order.id}`} aria-label={`Ver detalle de ${order.id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950">
                  <Eye aria-hidden size={16} />
                </Link>
                <button type="button" aria-label={`Eliminar ${order.id}`} onClick={() => void deletePurchaseOrder(order.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-red-50 hover:text-red-600">
                  <Trash2 aria-hidden size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
