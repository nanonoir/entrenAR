"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useAdminSalesStore } from "@/stores/admin-sales-store";
import { formatARS, formatShortDate } from "@/lib/data/admin/sales-flow/helpers";
import { AdminCard, AdminCardHeader } from "@/components/admin/ui/AdminCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { SaleHistoryEventType } from "@/lib/data/admin/sales-flow/types";

const MOCK_PAYMENT_LINK = "https://pagos.entrenar.ar/link/placeholder";

const EVENT_LABELS: Record<SaleHistoryEventType, string> = {
  sale_created: "Venta creada",
  sale_updated: "Venta actualizada",
  sale_cancelled: "Venta cancelada",
  sale_reopened: "Venta reabierta",
  sale_archived: "Venta archivada",
  payment_received: "Pago recibido",
  package_packed: "Paquete empaquetado",
  package_unpacked: "Paquete desempaquetado",
  package_shipped: "Paquete enviado",
  email_sent: "E-mail enviado",
  email_failed: "Error al enviar e-mail",
  stock_reserved: "Stock reservado",
  stock_deducted: "Stock descontado",
  stock_restored: "Stock restaurado",
  shipping_address_updated: "Dirección de envío actualizada",
  order_converted: "Orden convertida",
};

export default function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const order = useAdminSalesStore((s) => s.purchaseOrders.find((o) => o.id === id));
  const { convertOrderToSale, addToast } = useAdminSalesStore();
  const [copied, setCopied] = useState(false);
  const [converting, setConverting] = useState(false);
  const router = useRouter();

  if (!order) {
    return (
      <div className="mx-auto max-w-4xl py-12 text-center">
        <p className="text-lg font-semibold text-zinc-800">Orden no encontrada</p>
        <Link href="/admin/ventas/ordenes" className="mt-3 inline-block text-sm text-accent underline">
          Volver a órdenes
        </Link>
      </div>
    );
  }

  // If already converted, show conversion state
  if (order.status === "converted" && order.convertedSaleId) {
    return (
      <div className="mx-auto max-w-4xl py-12 text-center">
        <p className="text-lg font-semibold text-zinc-800">Esta orden ya fue convertida a venta</p>
        <Link href={`/admin/ventas/${order.convertedSaleId}`} className="mt-3 inline-block text-sm text-accent underline">
          Ver venta #{order.convertedSaleId} →
        </Link>
      </div>
    );
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(MOCK_PAYMENT_LINK);
      setCopied(true);
      addToast("Link copiado", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast("No se pudo copiar el link", "error");
    }
  }

  async function handleConvert() {
    setConverting(true);
    try {
      const newSaleId = convertOrderToSale(order!.id);
      router.push(`/admin/ventas/${newSaleId}`);
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Link href="/admin/ventas/ordenes" className="hover:text-accent">Órdenes de Compra</Link>
            <span>/</span>
            <span className="font-mono text-xs font-semibold text-zinc-900">{order.id}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950">Detalle de la Orden</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone="warning">Pendiente</Badge>
            <span className="text-xs text-zinc-400">{formatShortDate(order.createdAt)}</span>
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          disabled={converting}
          onClick={handleConvert}
        >
          <Check aria-hidden size={14} />
          {converting ? "Procesando…" : "Marcar como recibido"}
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Left */}
        <div className="grid gap-5">
          {/* Payment link card */}
          <AdminCard>
            <AdminCardHeader
              title="Link de pago"
              description="Compartí este link con el cliente para que realice el pago."
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 font-mono text-xs text-zinc-600 break-all">
                {MOCK_PAYMENT_LINK}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" size="sm" onClick={handleCopyLink}>
                  {copied ? <Check aria-hidden size={14} className="text-green-600" /> : <Copy aria-hidden size={14} />}
                  {copied ? "Link copiado" : "Copiar link"}
                </Button>
                <Button variant="ghost" size="sm" aria-label="Acceder al link (placeholder)">
                  <ExternalLink aria-hidden size={14} />
                  Acceder
                </Button>
              </div>
            </div>
          </AdminCard>

          {/* Products card */}
          <AdminCard>
            <AdminCardHeader title="Productos" />
            <div className="divide-y divide-zinc-50">
              {order.products.map((product, i) => (
                <div key={`${product.productId}-${i}`} className="flex items-center gap-3 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-lg">📦</div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900">{product.name}</p>
                    <p className="text-xs text-zinc-500">Cant: {product.quantity} × {formatARS(product.unitPrice)}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">{formatARS(product.quantity * product.unitPrice)}</p>
                </div>
              ))}
            </div>
            {/* Totals */}
            <dl className="mt-4 border-t border-zinc-100 pt-4 grid gap-2 text-sm">
              <div className="flex justify-between text-zinc-500">
                <dt>Subtotal</dt>
                <dd className="font-semibold text-zinc-700">{formatARS(order.subtotal)}</dd>
              </div>
              {order.discountValue && (
                <div className="flex justify-between text-zinc-500">
                  <dt>Descuento</dt>
                  <dd className="font-semibold text-sale">
                    −{order.discountType === "percentage" ? `${order.discountValue}%` : formatARS(order.discountValue)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between text-zinc-500">
                <dt>Envío</dt>
                <dd className="font-semibold text-zinc-700">{formatARS(order.shippingCost)}</dd>
              </div>
              <div className="flex justify-between border-t border-zinc-100 pt-2 font-bold text-zinc-950">
                <dt>Total</dt>
                <dd>{formatARS(order.total)}</dd>
              </div>
            </dl>
          </AdminCard>

          {/* Payment info card */}
          <AdminCard>
            <AdminCardHeader title="Información de pago" />
            <p className="text-sm text-zinc-600">
              Esta orden está pendiente de pago. Al hacer clic en <strong>Marcar como recibido</strong>, se creará
              una venta con estado de pago <em>Recibido</em> y esta orden quedará marcada como convertida.
            </p>
          </AdminCard>
        </div>

        {/* Right */}
        <div className="grid gap-5 content-start">
          {/* Customer card */}
          <AdminCard>
            <AdminCardHeader title="Cliente" />
            <div className="grid gap-1 text-sm">
              <p className="font-semibold text-zinc-900">
                {order.customer.firstName} {order.customer.lastName}
              </p>
              {order.customer.email && <p className="text-zinc-600">{order.customer.email}</p>}
              {order.customer.phone && <p className="text-zinc-600">{order.customer.phone}</p>}
            </div>
          </AdminCard>

          {/* Delivery address card */}
          {order.shippingAddress && (
            <AdminCard>
              <AdminCardHeader title="Dirección de entrega" />
              <address className="not-italic text-sm text-zinc-700 grid gap-0.5">
                <span>{order.shippingAddress.street} {order.shippingAddress.number}</span>
                {order.shippingAddress.floor && <span>Piso {order.shippingAddress.floor}</span>}
                <span>{order.shippingAddress.city}, {order.shippingAddress.province}</span>
                <span>CP {order.shippingAddress.postalCode}</span>
              </address>
            </AdminCard>
          )}

          {/* History */}
          <AdminCard>
            <AdminCardHeader title="Historial" />
            <ol className="grid gap-3">
              {[...order.history].reverse().map((event) => (
                <li key={event.id} className="flex items-start gap-2">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-zinc-300" />
                  <div>
                    <p className="text-sm font-semibold text-zinc-800">{EVENT_LABELS[event.type]}</p>
                    {event.note && <p className="text-xs text-zinc-500">{event.note}</p>}
                    <p className="text-xs text-zinc-400">{formatShortDate(event.date)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
