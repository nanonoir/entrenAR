"use client";

import Link from "next/link";
import { ArrowDownUp, Eye, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import type { Customer, CustomerSalesSummary } from "@/lib/data/admin/customers/types";
import { buildWhatsAppUrl, formatAdminDate, getCustomerDisplayName } from "@/lib/formatting/customer";
import { formatARS } from "@/components/admin/customers/customer-ui";

type CustomerTableProps = {
  customers: Customer[];
  summaries: Record<string, CustomerSalesSummary>;
  sortDirection: "asc" | "desc";
  onSort: () => void;
  onEmail: (customer: Customer) => void;
};

export function CustomerTable({ customers, onEmail, onSort, sortDirection, summaries }: CustomerTableProps) {
  return (
    <div className="hidden overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm lg:block">
      <table className="w-full table-fixed text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-100">
            <HeaderCell>Nombre</HeaderCell>
            <HeaderCell>Última compra</HeaderCell>
            <th scope="col" className="w-44 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400"><button type="button" onClick={onSort} className="flex items-center gap-1">Total consumido <ArrowDownUp aria-hidden size={14} /> <span className="sr-only">Orden {sortDirection}</span></button></th>
            <HeaderCell>Contactar</HeaderCell>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50">
          {customers.map((customer) => <CustomerRow key={customer.id} customer={customer} summary={summaries[customer.id] ?? { totalSpent: 0, ordersCount: 0 }} onEmail={onEmail} />)}
        </tbody>
      </table>
    </div>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">{children}</th>;
}

function CustomerRow({ customer, onEmail, summary }: { customer: Customer; onEmail: (customer: Customer) => void; summary: CustomerSalesSummary }) {
  const whatsappUrl = buildWhatsAppUrl(customer);
  return (
    <tr className="transition hover:bg-zinc-50/80">
      <td className="min-w-0 px-4 py-4"><Link href={`/admin/clientes/${customer.id}`} className="block truncate font-semibold text-accent hover:underline">{getCustomerDisplayName(customer)}</Link><p className="mt-1 truncate text-xs text-zinc-500">{customer.isAnonymized ? customer.id : customer.email}</p></td>
      <td className="px-4 py-4">{summary.lastOrder ? <Link href={`/admin/ventas/${summary.lastOrder.id}`} className="font-medium text-zinc-800 hover:text-accent">{summary.lastOrder.number} {formatAdminDate(summary.lastOrder.date)}</Link> : <span className="text-zinc-500">Sin compras</span>}</td>
      <td className="px-4 py-4 font-semibold text-zinc-900">{formatARS(summary.totalSpent)}</td>
      <td className="px-4 py-4"><div className="flex gap-2"><LinkButton href={`/admin/clientes/${customer.id}`} size="icon" variant="secondary" aria-label={`Ver detalle de ${getCustomerDisplayName(customer)}`}><Eye aria-hidden size={16} /></LinkButton><Button size="icon" variant="secondary" aria-label={`Enviar email a ${getCustomerDisplayName(customer)}`} disabled={customer.isAnonymized || !customer.email} onClick={() => onEmail(customer)}><Mail aria-hidden size={16} /></Button><Button size="icon" variant="secondary" aria-label={`Contactar por WhatsApp a ${getCustomerDisplayName(customer)}`} disabled={!whatsappUrl} onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}><MessageCircle aria-hidden size={16} /></Button></div></td>
    </tr>
  );
}
