"use client";

import { use, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Archive,
  ChevronDown,
  Edit2,
  MapPin,
  MoreHorizontal,
  Package,
  Printer,
  RefreshCw,
  Truck,
  X,
} from "lucide-react";
import { useAdminSalesStore } from "@/stores/admin-sales-store";
import {
  formatARS,
  formatShortDate,
  getPaymentStatusLabel,
  getPaymentStatusTone,
  getShippingStatusLabel,
  getShippingStatusTone,
  isSaleEditable,
} from "@/lib/data/admin/sales-flow/helpers";
import { AdminCard, AdminCardHeader } from "@/components/admin/ui/AdminCard";
import { isSaleArchivable } from "@/lib/data/admin/sales-flow/archive";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LinkButton } from "@/components/ui/LinkButton";
import { Drawer } from "@/components/ui/Drawer";
import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/utils";
import type { SaleAddress } from "@/lib/data/admin/sales-flow/types";
import type { AdminSale } from "@/lib/data/admin/sales-flow/types";

const CANCELLATION_REASONS = [
  "El cliente canceló el pedido",
  "Producto sin stock",
  "Error en el pedido",
  "Problemas con el pago",
  "Otro",
];

const HISTORY_EVENT_LABELS: Record<string, { label: string; tone: "success" | "error" | "warning" | "neutral" }> = {
  sale_created: { label: "Venta creada", tone: "success" },
  sale_updated: { label: "Venta actualizada", tone: "neutral" },
  sale_cancelled: { label: "Venta cancelada", tone: "error" },
  sale_reopened: { label: "Venta re-abierta", tone: "success" },
  sale_archived: { label: "Venta archivada", tone: "neutral" },
  payment_received: { label: "Pago recibido", tone: "success" },
  package_packed: { label: "Pedido empaquetado", tone: "success" },
  package_unpacked: { label: "Pedido desempaquetado", tone: "neutral" },
  package_shipped: { label: "Enviado", tone: "success" },
  email_sent: { label: "E-mail enviado", tone: "success" },
  email_failed: { label: "E-mail no enviado", tone: "warning" },
  stock_reserved: { label: "Stock reservado (simulación)", tone: "neutral" },
  stock_deducted: { label: "Stock descontado (simulación)", tone: "neutral" },
  stock_restored: { label: "Stock restaurado (simulación)", tone: "neutral" },
  shipping_address_updated: { label: "Dirección de envío actualizada", tone: "neutral" },
  order_converted: { label: "Convertida desde orden de compra", tone: "success" },
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

export default function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const sale = useAdminSalesStore((s) => s.sales.find((sale) => sale.id === id));
  const { cancelSale, reopenSale, archiveSale, markPaymentReceived, markPacked, markUnpacked, markShipped, updateShippingAddress } =
    useAdminSalesStore();

  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [cancelDrawerOpen, setCancelDrawerOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitAttempted, setCancelSubmitAttempted] = useState(false);
  const [cancelRestoreStock, setCancelRestoreStock] = useState(true);
  const [cancelSendEmail, setCancelSendEmail] = useState(true);
  const cancelReasonRef = useRef<HTMLSelectElement>(null);
  const [shippingDrawerOpen, setShippingDrawerOpen] = useState(false);
  const [shippingSubmitAttempted, setShippingSubmitAttempted] = useState(false);
  const [shippingDraft, setShippingDraft] = useState<SaleAddress>({
    street: "",
    number: "",
    floor: "",
    unit: "",
    city: "",
    province: "",
    postalCode: "",
    country: "Argentina",
    notes: "",
  });
  const router = useRouter();

  if (!sale) {
    return (
      <div className="mx-auto max-w-4xl py-12 text-center">
        <p className="text-lg font-semibold text-zinc-800">Venta no encontrada</p>
        <Link href="/admin/ventas" className="mt-3 inline-block text-sm text-accent underline">
          Volver al listado
        </Link>
      </div>
    );
  }

  const isCancelled = sale.paymentStatus === "cancelled";
  const isReadOnly = sale.archived;
  const editable = isSaleEditable(sale);
  const archivedFinalStatus = isReadOnly ? getArchivedFinalStatus(sale) : null;
  const archivable = isSaleArchivable(sale);

  function handleCancel() {
    setCancelSubmitAttempted(true);
    if (!cancelReason.trim()) {
      cancelReasonRef.current?.focus();
      return;
    }
    cancelSale(sale!.id, cancelReason, { restoreStock: cancelRestoreStock, sendEmail: cancelSendEmail });
    setCancelDrawerOpen(false);
    setCancelReason("");
    setCancelSubmitAttempted(false);
  }

  function handleReopen() {
    reopenSale(sale!.id);
  }

  function handleArchive() {
    if (!archivable) return;
    archiveSale(sale!.id);
    setMoreMenuOpen(false);
    router.push("/admin/ventas");
  }

  function openShippingDrawer() {
    setShippingDraft({
      street: sale!.shippingAddress?.street ?? "",
      number: sale!.shippingAddress?.number ?? "",
      floor: sale!.shippingAddress?.floor ?? "",
      unit: sale!.shippingAddress?.unit ?? "",
      city: sale!.shippingAddress?.city ?? "",
      province: sale!.shippingAddress?.province ?? "",
      postalCode: sale!.shippingAddress?.postalCode ?? "",
      country: sale!.shippingAddress?.country ?? "Argentina",
      notes: sale!.shippingAddress?.notes ?? "",
    });
    setShippingSubmitAttempted(false);
    setShippingDrawerOpen(true);
  }

  function updateShippingDraft(field: keyof SaleAddress, value: string) {
    setShippingDraft((current) => ({ ...current, [field]: value }));
  }

  function handleSaveShippingAddress() {
    setShippingSubmitAttempted(true);
    const nextAddress: SaleAddress = {
      street: shippingDraft.street.trim(),
      number: shippingDraft.number.trim(),
      floor: shippingDraft.floor?.trim(),
      unit: shippingDraft.unit?.trim(),
      city: shippingDraft.city.trim(),
      province: shippingDraft.province.trim(),
      postalCode: shippingDraft.postalCode.trim(),
      country: shippingDraft.country.trim() || "Argentina",
      notes: shippingDraft.notes?.trim(),
    };
    if (!nextAddress.street || !nextAddress.number || !nextAddress.city || !nextAddress.province || !nextAddress.postalCode) {
      return;
    }
    updateShippingAddress(sale!.id, nextAddress);
    setShippingDrawerOpen(false);
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Link href="/admin/ventas" className="hover:text-accent">Ventas</Link>
            <span>/</span>
            <span className="font-semibold text-zinc-900">{isReadOnly ? "Archivado" : sale.number}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950">{isReadOnly ? "Archivado" : sale.number}</h1>
            {isReadOnly ? (
              <>
                <Badge tone="neutral">{sale.number}</Badge>
                {archivedFinalStatus && <Badge tone={archivedFinalStatus.tone}>{archivedFinalStatus.label}</Badge>}
              </>
            ) : (
              <>
                <Badge tone={getPaymentStatusTone(sale.paymentStatus)}>
                  {getPaymentStatusLabel(sale.paymentStatus)}
                </Badge>
                <Badge tone={getShippingStatusTone(sale.shippingStatus)}>
                  {getShippingStatusLabel(sale.shippingStatus)}
                </Badge>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-400">{formatShortDate(sale.createdAt)}</p>
          {sale.sourceOrderId && (
            <p className="mt-0.5 text-xs text-zinc-400">
              Origen:{" "}
              <Link href={`/admin/ventas/ordenes/${sale.sourceOrderId}`} className="text-accent hover:underline">
                {sale.sourceOrderId}
              </Link>
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isReadOnly ? (
            <Button variant="ghost" size="icon" aria-label="Imprimir resumen">
              <Printer aria-hidden size={16} />
            </Button>
          ) : isCancelled ? (
            <Button variant="secondary" size="sm" onClick={handleReopen}>
              <RefreshCw aria-hidden size={14} />
              Re-Abrir
            </Button>
          ) : (
            <>
              {/* More options dropdown */}
              <div className="relative">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setMoreMenuOpen((v) => !v)}
                  aria-label="Más opciones"
                  aria-expanded={moreMenuOpen}
                >
                  <MoreHorizontal aria-hidden size={16} />
                  Más opciones
                  <ChevronDown aria-hidden size={14} />
                </Button>
                {moreMenuOpen && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-2xl border border-zinc-200 bg-white py-1.5 shadow-xl">
                    {archivable && (
                      <button
                        type="button"
                        onClick={handleArchive}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
                      >
                        <Archive aria-hidden size={14} />
                        Archivar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setMoreMenuOpen(false); setCancelSubmitAttempted(false); setCancelDrawerOpen(true); }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-sale transition hover:bg-red-50"
                    >
                      <X aria-hidden size={14} />
                      Cancelar
                    </button>
                  </div>
                )}
              </div>

              {/* Edit button */}
              {editable ? (
                <LinkButton href={`/admin/ventas/${sale.id}/editar`} variant="secondary" size="sm">
                  <Edit2 aria-hidden size={14} />
                  Editar
                </LinkButton>
              ) : (
                <div className="group relative">
                  <Button variant="secondary" size="sm" disabled aria-disabled="true">
                    <Edit2 aria-hidden size={14} />
                    Editar
                  </Button>
                  <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-64 -translate-x-1/2 rounded-xl bg-zinc-900 px-3 py-2 text-xs text-white opacity-0 transition group-hover:opacity-100">
                    Por seguridad NO se puede editar una venta luego de empaquetar y/o enviar el pedido
                  </div>
                </div>
              )}

              <Button variant="ghost" size="icon" aria-label="Imprimir resumen">
                <Printer aria-hidden size={16} />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Left column */}
        <div className="grid gap-5">
          {/* Products card */}
          <AdminCard>
            <AdminCardHeader title="Productos" />
            <div className="divide-y divide-zinc-50">
              {sale.products.map((product, i) => (
                <div key={`${product.productId}-${i}`} className="flex items-center gap-3 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-lg">📦</div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900">{product.name}</p>
                    <p className="text-xs text-zinc-500">Cant: {product.quantity} × {formatARS(product.unitPrice)}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-zinc-800">{formatARS(product.quantity * product.unitPrice)}</p>
                </div>
              ))}
            </div>
            {/* Totals */}
            <dl className="mt-4 border-t border-zinc-100 pt-4 grid gap-2 text-sm">
              <div className="flex justify-between text-zinc-500">
                <dt>Subtotal</dt>
                <dd className="font-semibold text-zinc-700">{formatARS(sale.subtotal)}</dd>
              </div>
              {sale.discountValue && (
                <div className="flex justify-between text-zinc-500">
                  <dt>Descuento</dt>
                  <dd className="font-semibold text-sale">
                    −{sale.discountType === "percentage" ? `${sale.discountValue}%` : formatARS(sale.discountValue)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between text-zinc-500">
                <dt>Envío</dt>
                <dd className="font-semibold text-zinc-700">{formatARS(sale.shippingCost)}</dd>
              </div>
              <div className="flex justify-between border-t border-zinc-100 pt-2 font-bold text-zinc-950">
                <dt>Total</dt>
                <dd>{formatARS(sale.total)}</dd>
              </div>
            </dl>
          </AdminCard>

          {/* Payment card */}
          <AdminCard>
            <AdminCardHeader title="Pago" />
            <div className="flex items-center justify-between">
              <div>
                <Badge tone={getPaymentStatusTone(sale.paymentStatus)}>
                  {getPaymentStatusLabel(sale.paymentStatus)}
                </Badge>
                {sale.paymentStatus === "cancelled" && sale.cancellationReason && (
                  <p className="mt-1 text-xs text-zinc-500">Motivo: {sale.cancellationReason}</p>
                )}
              </div>
              {sale.paymentStatus === "pending" && !isReadOnly && (
                <Button variant="primary" size="sm" onClick={() => markPaymentReceived(sale.id)}>
                  Marcar como recibido
                </Button>
              )}
            </div>
          </AdminCard>

          {/* Logistics card */}
          <AdminCard>
            <AdminCardHeader title="Logística" />
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={getShippingStatusTone(sale.shippingStatus)}>
                {getShippingStatusLabel(sale.shippingStatus)}
              </Badge>

              {sale.shippingStatus === "to_pack" && !isCancelled && !isReadOnly && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => {}}>
                    <Printer aria-hidden size={14} />
                    Imprimir
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => markPacked(sale.id)}>
                    <Package aria-hidden size={14} />
                    Marcar como empaquetado
                  </Button>
                </>
              )}

              {sale.shippingStatus === "to_ship" && !isCancelled && !isReadOnly && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => {}}>
                    <Printer aria-hidden size={14} />
                    Imprimir
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => markShipped(sale.id)}>
                    <Truck aria-hidden size={14} />
                    Notificar envío
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => markUnpacked(sale.id)}>
                    Desempaquetar
                  </Button>
                </>
              )}
            </div>
            {sale.trackingCode && (
              <p className="mt-3 text-xs text-zinc-500">
                Tracking: <span className="font-mono font-semibold">{sale.trackingCode}</span>
              </p>
            )}
          </AdminCard>

          {/* Notes */}
          {sale.notes && (
            <AdminCard>
              <AdminCardHeader title="Notas internas" />
              <p className="text-sm text-zinc-700">{sale.notes}</p>
            </AdminCard>
          )}
        </div>

        {/* Right column */}
        <div className="grid gap-5 content-start">
          {/* Customer card */}
          <AdminCard>
            <AdminCardHeader title="Cliente" />
            <div className="grid gap-1 text-sm">
              <p className="font-semibold text-zinc-900">
                {sale.customer.firstName} {sale.customer.lastName}
              </p>
              {sale.customer.email && <p className="text-zinc-600">{sale.customer.email}</p>}
              {sale.customer.phone && <p className="text-zinc-600">{sale.customer.phone}</p>}
              {sale.customer.dniOrCuil && (
                <p className="text-zinc-500 text-xs">DNI/CUIL: {sale.customer.dniOrCuil}</p>
              )}
            </div>
          </AdminCard>

          {/* Shipping address card */}
          <AdminCard>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950">Dirección de envío</h2>
                <p className="mt-1 text-sm text-zinc-500">Datos usados por logística.</p>
              </div>
              {!isReadOnly && (
                <Button type="button" variant="secondary" size="sm" onClick={openShippingDrawer}>
                  <MapPin aria-hidden size={14} />
                  Editar
                </Button>
              )}
            </div>
            {sale.shippingAddress ? (
              <address className="not-italic text-sm text-zinc-700 grid gap-0.5">
                <span>{sale.shippingAddress.street} {sale.shippingAddress.number}</span>
                {sale.shippingAddress.floor && (
                  <span>Piso {sale.shippingAddress.floor}{sale.shippingAddress.unit ? `, Dpto ${sale.shippingAddress.unit}` : ""}</span>
                )}
                <span>{sale.shippingAddress.city}, {sale.shippingAddress.province}</span>
                <span>CP {sale.shippingAddress.postalCode}</span>
                {sale.shippingAddress.notes && (
                  <span className="text-xs text-zinc-500 mt-1">{sale.shippingAddress.notes}</span>
                )}
              </address>
            ) : (
              <p className="text-sm text-zinc-500">Esta venta todavía no tiene dirección de envío cargada.</p>
            )}
          </AdminCard>

          {/* Billing card */}
          <AdminCard>
            <AdminCardHeader title="Facturación" />
            <div className="grid gap-1 text-sm text-zinc-700">
              <p>Consumidor final</p>
              {sale.customer.dniOrCuil ? <p>DNI/CUIL: {sale.customer.dniOrCuil}</p> : <p className="text-zinc-500">Sin DNI/CUIL informado.</p>}
              <p className="text-xs text-zinc-500">Comprobante pendiente de integración fiscal.</p>
            </div>
          </AdminCard>

          {/* Tracking card */}
          <AdminCard>
            <AdminCardHeader title="Tracking" />
            {sale.trackingCode ? (
              <p className="font-mono text-sm font-semibold text-zinc-800">{sale.trackingCode}</p>
            ) : (
              <p className="text-sm text-zinc-500">El seguimiento se generará al notificar el envío.</p>
            )}
          </AdminCard>

          {/* History timeline */}
          <AdminCard>
            <AdminCardHeader title="Historial" />
            <ol className="grid gap-4">
              {[...sale.history].reverse().map((event) => {
                const config = HISTORY_EVENT_LABELS[event.type] ?? { label: event.type, tone: "neutral" };
                return (
                  <li key={event.id} className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                        config.tone === "success" && "bg-green-500",
                        config.tone === "error" && "bg-sale",
                        config.tone === "warning" && "bg-amber-400",
                        config.tone === "neutral" && "bg-zinc-300",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          config.tone === "warning" && "text-amber-700",
                          config.tone === "error" && "text-sale",
                          config.tone === "neutral" || config.tone === "success" ? "text-zinc-800" : "",
                        )}
                      >
                        {config.label}
                      </p>
                      {event.note && <p className="text-xs text-zinc-500 mt-0.5">{event.note}</p>}
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {event.actor} · {formatShortDate(event.date)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </AdminCard>
        </div>
      </div>

      {/* Cancel sale drawer */}
      <Drawer open={cancelDrawerOpen} onClose={() => { setCancelDrawerOpen(false); setCancelSubmitAttempted(false); }} title="Cancelar venta" side="right">
        <div className="flex flex-col gap-5 p-5">
          <p className="text-sm text-zinc-600">
            Esta acción cambia el estado de pago a <strong>Cancelado</strong>. El estado de envío no cambia.
          </p>

          {cancelSubmitAttempted && !cancelReason && (
            <div
              role="alert"
              className="rounded-2xl border border-sale/20 bg-red-50 px-4 py-3 text-sm font-medium text-sale"
            >
              Debés seleccionar un motivo de cancelación para continuar.
            </div>
          )}

          {/* Reason select */}
          <div>
            <label htmlFor="cancel-reason" className="mb-1.5 block text-sm font-medium text-zinc-700">
              Motivo de cancelación *
            </label>
            <select
              id="cancel-reason"
              ref={cancelReasonRef}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.currentTarget.value)}
              className={cn("h-11 w-full rounded-button border border-border bg-surface px-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm", cancelSubmitAttempted && !cancelReason && "border-sale focus:border-sale focus:ring-sale/20")}
              aria-required="true"
              aria-invalid={cancelSubmitAttempted && !cancelReason ? true : undefined}
              aria-describedby={cancelSubmitAttempted && !cancelReason ? "cancel-reason-error" : "cancel-reason-helper"}
            >
              <option value="">Seleccioná un motivo...</option>
              {CANCELLATION_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {cancelSubmitAttempted && !cancelReason ? <p id="cancel-reason-error" className="mt-1 text-xs font-medium text-sale">Seleccioná un motivo antes de cancelar la venta.</p> : <p id="cancel-reason-helper" className="mt-1 text-xs text-text-muted">El estado de envío se conserva sin cambios.</p>}
          </div>

          {/* Checkboxes */}
          <div className="grid gap-3">
            <Checkbox
              id="cancel-send-email"
              label="Enviar e-mail al cliente"
              checked={cancelSendEmail}
              onChange={(e) => setCancelSendEmail(e.target.checked)}
            />
            <Checkbox
              id="cancel-restore-stock"
              label="Restaurar stock"
              checked={cancelRestoreStock}
              onChange={(e) => setCancelRestoreStock(e.target.checked)}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={handleCancel}
            >
              Cancelar venta
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setCancelDrawerOpen(false)}
            >
              Volver
            </Button>
          </div>
        </div>
      </Drawer>

      {/* Edit shipping address drawer */}
      <Drawer open={shippingDrawerOpen} onClose={() => setShippingDrawerOpen(false)} title="Editar dirección de envío" side="right">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="grid gap-4">
              {shippingSubmitAttempted && (!shippingDraft.street || !shippingDraft.number || !shippingDraft.city || !shippingDraft.province || !shippingDraft.postalCode) && (
                <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Revisá los campos marcados en rojo antes de guardar.
                </div>
              )}
              <Input
                id="shipping-drawer-street"
                label="Calle *"
                helperText="Nombre de la calle"
                value={shippingDraft.street}
                onChange={(event) => updateShippingDraft("street", event.target.value)}
                errorText={shippingSubmitAttempted && !shippingDraft.street ? "Ingresá la calle" : undefined}
              />
              <Input
                id="shipping-drawer-number"
                label="Número *"
                helperText="Altura del domicilio"
                value={shippingDraft.number}
                onChange={(event) => updateShippingDraft("number", event.target.value)}
                errorText={shippingSubmitAttempted && !shippingDraft.number ? "Ingresá la altura" : undefined}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  id="shipping-drawer-floor"
                  label="Piso"
                  helperText="Opcional"
                  value={shippingDraft.floor ?? ""}
                  onChange={(event) => updateShippingDraft("floor", event.target.value)}
                />
                <Input
                  id="shipping-drawer-unit"
                  label="Departamento"
                  helperText="Opcional"
                  value={shippingDraft.unit ?? ""}
                  onChange={(event) => updateShippingDraft("unit", event.target.value)}
                />
              </div>
              <Input
                id="shipping-drawer-city"
                label="Ciudad *"
                helperText="Localidad de entrega"
                value={shippingDraft.city}
                onChange={(event) => updateShippingDraft("city", event.target.value)}
                errorText={shippingSubmitAttempted && !shippingDraft.city ? "Ingresá la ciudad" : undefined}
              />
              <Input
                id="shipping-drawer-province"
                label="Provincia *"
                helperText="Provincia argentina"
                value={shippingDraft.province}
                onChange={(event) => updateShippingDraft("province", event.target.value)}
                errorText={shippingSubmitAttempted && !shippingDraft.province ? "Ingresá la provincia" : undefined}
              />
              <Input
                id="shipping-drawer-postal-code"
                label="Código postal *"
                helperText="Ej: 1425"
                value={shippingDraft.postalCode}
                onChange={(event) => updateShippingDraft("postalCode", event.target.value)}
                errorText={shippingSubmitAttempted && !shippingDraft.postalCode ? "Ingresá el código postal" : undefined}
              />
              <Input
                id="shipping-drawer-notes"
                label="Indicaciones adicionales"
                helperText="Opcional: timbre, portero, referencias"
                value={shippingDraft.notes ?? ""}
                onChange={(event) => updateShippingDraft("notes", event.target.value)}
              />
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 border-t border-zinc-100 p-5">
            <Button type="button" variant="primary" size="md" onClick={handleSaveShippingAddress}>
              Guardar
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={() => setShippingDrawerOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
