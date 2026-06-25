"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/LinkButton";
import { formatARS, formatShortDate, getShippingStatusLabel, getShippingStatusTone } from "@/lib/data/admin/sales-flow/helpers";
import type { ShipmentTrackingRecord } from "@/lib/data/admin/shipping/tracking";

export function ShipmentTrackingRow({ record }: { record: ShipmentTrackingRecord }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-4"><Link href={`/admin/envios/detalle/${record.id}`} className="font-mono text-sm font-semibold text-accent hover:underline">{record.saleNumber ?? `#${record.id}`}</Link></td>
      <td className="px-4 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text">{record.recipientName}</p>
          <p className="truncate text-xs text-text-muted">{record.logisticsSummary}</p>
        </div>
      </td>
      <td className="px-4 py-4"><Badge tone={getShippingStatusTone(record.status)}>{getShippingStatusLabel(record.status)}</Badge></td>
      <td className="px-4 py-4 text-sm text-text-muted">{record.trackingCode ?? "Pendiente"}</td>
      <td className="px-4 py-4 text-sm font-semibold text-text">{formatARS(record.shippingCost)}</td>
      <td className="px-4 py-4 text-sm text-text-muted">{formatShortDate(record.updatedAt)}</td>
      <td className="px-4 py-4 text-right"><LinkButton className="whitespace-nowrap" href={`/admin/envios/detalle/${record.id}`} size="sm" variant="secondary">Ver detalle<Eye aria-hidden size={14} /></LinkButton></td>
    </tr>
  );
}
