"use client";

import Link from "next/link";
import { Eye, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import type { Customer, CustomerSalesSummary } from "@/lib/data/admin/customers/types";
import { buildWhatsAppUrl, formatAdminDate, getCustomerDisplayName } from "@/lib/formatting/customer";
import { formatARS } from "@/components/admin/customers/customer-ui";

export function CustomerListCard({ customer, onEmail, summary }: { customer: Customer; onEmail: (customer: Customer) => void; summary: CustomerSalesSummary }) {
  const whatsappUrl = buildWhatsAppUrl(customer);
  return (
    <article className="w-full max-w-full min-w-0 overflow-hidden rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="min-w-0">
        <Link href={`/admin/clientes/${customer.id}`} className="block truncate font-semibold text-accent hover:underline">{getCustomerDisplayName(customer)}</Link>
        <p className="mt-1 truncate text-xs text-zinc-500">{customer.isAnonymized ? customer.id : customer.email}</p>
      </div>
      <dl className="mt-4 grid gap-3 text-sm min-[380px]:grid-cols-2">
        <div><dt className="text-xs font-semibold uppercase text-zinc-400">Última compra</dt><dd className="mt-1 font-medium text-zinc-800">{summary.lastOrder ? <Link href={`/admin/ventas/${summary.lastOrder.id}`} className="hover:text-accent">{summary.lastOrder.number} {formatAdminDate(summary.lastOrder.date)}</Link> : "Sin compras"}</dd></div>
        <div><dt className="text-xs font-semibold uppercase text-zinc-400">Total</dt><dd className="mt-1 font-semibold text-zinc-950">{formatARS(summary.totalSpent)}</dd></div>
      </dl>
      <div className="mt-4 flex gap-2">
        <LinkButton href={`/admin/clientes/${customer.id}`} size="sm" variant="secondary" aria-label={`Ver detalle de ${getCustomerDisplayName(customer)}`}><Eye aria-hidden size={16} />Ver</LinkButton>
        <Button size="sm" variant="secondary" disabled={customer.isAnonymized || !customer.email} onClick={() => onEmail(customer)}><Mail aria-hidden size={16} />E-mail</Button>
        <Button size="sm" variant="secondary" disabled={!whatsappUrl} onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}><MessageCircle aria-hidden size={16} />WhatsApp</Button>
      </div>
    </article>
  );
}
