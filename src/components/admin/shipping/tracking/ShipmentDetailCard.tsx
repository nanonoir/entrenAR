import Link from "next/link";
import { PackageCheck, Tag } from "lucide-react";
import { AdminCard, AdminCardHeader } from "@/components/admin/ui/AdminCard";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/LinkButton";
import { formatARS, formatShortDate, getPaymentStatusLabel, getPaymentStatusTone, getShippingStatusLabel, getShippingStatusTone } from "@/lib/data/admin/sales-flow/helpers";
import type { ShipmentTrackingRecord } from "@/lib/data/admin/shipping/tracking";

export function ShipmentDetailCard({ record }: { record: ShipmentTrackingRecord }) {
  return (
    <div className="mx-auto grid w-full max-w-6xl min-w-0 gap-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Envíos</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-text">Envío {record.saleNumber ?? `#${record.id}`}</h1>
          <div className="mt-3 flex flex-wrap gap-2"><Badge tone={getShippingStatusTone(record.status)}>{getShippingStatusLabel(record.status)}</Badge><Badge tone={getPaymentStatusTone(record.paymentStatus)}>{getPaymentStatusLabel(record.paymentStatus)}</Badge></div>
        </div>
        <div className="flex flex-wrap gap-2"><LinkButton href="/admin/envios" variant="secondary" size="sm">Volver</LinkButton><LinkButton href={`/admin/ventas/${record.saleId}`} variant="primary" size="sm">Ver pedido</LinkButton></div>
      </header>
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-5">
          <AdminCard><AdminCardHeader title="Resumen" /><dl className="grid gap-3 text-sm md:grid-cols-2"><Info label="Venta" value={record.saleNumber} /><Info label="Proveedor" value={record.providerName} /><Info label="Tracking" value={record.trackingCode ?? "Pendiente"} /><Info label="Actualizado" value={formatShortDate(record.updatedAt)} /><Info label="Costo" value={formatARS(record.shippingCost)} /><Info label="Total pedido" value={formatARS(record.total)} /></dl></AdminCard>
          <AdminCard><AdminCardHeader title="Productos" /><div className="divide-y divide-border">{record.products.map((product) => <div key={`${product.productId}-${product.variantId ?? "base"}`} className="flex min-w-0 items-center justify-between gap-3 py-3 text-sm"><div className="min-w-0"><p className="truncate font-semibold text-text">{product.name}</p><p className="text-text-muted">Cantidad: {product.quantity}</p></div><p className="shrink-0 font-semibold text-text">{formatARS(product.quantity * product.unitPrice)}</p></div>)}</div></AdminCard>
          <AdminCard><AdminCardHeader title="Etiqueta y seguimiento" /><div className="flex gap-3 rounded-2xl border border-border bg-surface p-4 text-sm text-text-muted"><Tag className="mt-0.5 shrink-0 text-accent" aria-hidden size={18} /><p>La etiqueta de envío y el tracking real se conectarán a la integración logística correspondiente. Este bloque conserva el lugar operativo sin generar etiquetas ni modificar el envío.</p></div></AdminCard>
        </div>
        <div className="grid content-start gap-5">
          <AdminCard><AdminCardHeader title="Destinatario" /><div className="grid gap-1 text-sm text-text"><p className="font-semibold">{record.recipientName}</p>{record.recipientEmail ? <p>{record.recipientEmail}</p> : null}{record.recipientPhone ? <p>{record.recipientPhone}</p> : null}</div></AdminCard>
          <AdminCard><AdminCardHeader title="Entrega" />{record.address ? <address className="grid gap-0.5 text-sm not-italic text-text"><span>{record.address.street} {record.address.number}</span><span>{record.address.city}, {record.address.province}</span><span>CP {record.address.postalCode}</span></address> : <p className="text-sm text-text-muted">Pedido sin dirección de envío. Revisá la venta para completar datos operativos.</p>}</AdminCard>
          <AdminCard><AdminCardHeader title="Logística" /><div className="flex items-start gap-3 text-sm text-text-muted"><PackageCheck aria-hidden className="mt-0.5 shrink-0 text-accent" size={18} /><p>{record.logisticsSummary}</p></div></AdminCard>
          <Link href={`/admin/ventas/${record.saleId}`} className="text-sm font-semibold text-accent hover:underline">Ver venta asociada</Link>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</dt><dd className="mt-1 font-semibold text-text">{value}</dd></div>;
}
