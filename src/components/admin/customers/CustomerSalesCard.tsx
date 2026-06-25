"use client";

import Link from "next/link";
import { AdminCard, AdminCardHeader } from "@/components/admin/ui/AdminCard";
import { Badge } from "@/components/ui/Badge";
import type { AdminSale } from "@/lib/data/admin/sales-flow/types";
import { formatSalesCardDate } from "@/lib/formatting/customer";
import { formatARS, getPaymentStatusLabel, getPaymentStatusTone, getShippingStatusLabel, getShippingStatusTone } from "@/components/admin/customers/customer-ui";

export function CustomerSalesCard({ sales }: { sales: AdminSale[] }) {
  return (
    <AdminCard>
      <AdminCardHeader title={`${sales.length} ${sales.length === 1 ? "Venta" : "Ventas"}`} />
      {sales.length === 0 ? <p className="text-sm text-zinc-500">Este cliente todavía no tiene ventas asociadas.</p> : <div className="grid gap-3">{sales.map((sale) => <SaleSummary key={sale.id} sale={sale} />)}</div>}
    </AdminCard>
  );
}

function SaleSummary({ sale }: { sale: AdminSale }) {
  const units = sale.products.reduce((sum, product) => sum + product.quantity, 0);
  return (
    <article className="rounded-2xl border border-zinc-100 p-4">
      <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><Link href={`/admin/ventas/${sale.id}`} className="font-semibold text-accent hover:underline">{sale.number}</Link><p className="mt-1 truncate text-sm text-zinc-700">{sale.customer.firstName} {sale.customer.lastName}</p><p className="mt-1 text-xs text-zinc-500">{units} {units === 1 ? "unidad" : "unidades"} · {formatSalesCardDate(sale.createdAt)}</p></div><p className="shrink-0 font-semibold text-zinc-950">{formatARS(sale.total)}</p></div>
      <div className="mt-3 flex flex-wrap gap-2"><Badge tone={getPaymentStatusTone(sale.paymentStatus)}>{getPaymentStatusLabel(sale.paymentStatus)}</Badge><Badge tone={getShippingStatusTone(sale.shippingStatus)}>{getShippingStatusLabel(sale.shippingStatus)}</Badge><Badge tone="neutral">{sale.shippingAddress ? sale.shippingAddress.city : "A convenir"}</Badge></div>
    </article>
  );
}
