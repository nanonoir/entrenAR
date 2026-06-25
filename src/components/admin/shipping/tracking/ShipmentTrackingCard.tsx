"use client";

import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/LinkButton";
import { formatARS, formatShortDate, getShippingStatusLabel, getShippingStatusTone } from "@/lib/data/admin/sales-flow/helpers";
import type { ShipmentTrackingRecord } from "@/lib/data/admin/shipping/tracking";

export function ShipmentTrackingCard({ record }: { record: ShipmentTrackingRecord }) {
  return (
    <article className="w-full max-w-full min-w-0 overflow-hidden rounded-3xl border border-border bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-accent">{record.id}</p>
          <h2 className="mt-1 truncate text-base font-semibold text-text">{record.recipientName}</h2>
          <p className="truncate text-sm text-text-muted">{record.logisticsSummary}</p>
        </div>
        <Badge className="shrink-0" tone={getShippingStatusTone(record.status)}>{getShippingStatusLabel(record.status)}</Badge>
      </div>
      <dl className="mt-4 grid gap-2 text-sm text-text-muted">
        <div className="flex justify-between gap-3"><dt>Tracking</dt><dd className="min-w-0 truncate font-medium text-text">{record.trackingCode ?? "Pendiente"}</dd></div>
        <div className="flex justify-between gap-3"><dt>Costo</dt><dd className="font-medium text-text">{formatARS(record.shippingCost)}</dd></div>
        <div className="flex justify-between gap-3"><dt>Actualizado</dt><dd className="font-medium text-text">{formatShortDate(record.updatedAt)}</dd></div>
      </dl>
      <LinkButton className="mt-4 w-full" href={`/admin/envios/detalle/${record.id}`} size="sm" variant="secondary">Ver detalle<ArrowUpRight aria-hidden size={14} /></LinkButton>
    </article>
  );
}
