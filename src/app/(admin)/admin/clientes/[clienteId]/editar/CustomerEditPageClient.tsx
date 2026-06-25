"use client";

import { LinkButton } from "@/components/ui/LinkButton";
import { CustomerForm } from "@/components/admin/customers/CustomerForm";
import type { Customer } from "@/lib/data/admin/customers/types";

export function CustomerEditPageClient({ customer }: { customer: Customer }) {
  if (customer.isAnonymized) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="text-lg font-semibold text-zinc-900">Este cliente no se puede editar.</p>
        <p className="mt-2 text-sm text-zinc-500">Los datos personales fueron eliminados y solo se conserva el historial administrativo.</p>
        <LinkButton href={`/admin/clientes/${customer.id}`} className="mt-5" variant="secondary">Volver al detalle</LinkButton>
      </div>
    );
  }
  return <CustomerForm mode="edit" customer={customer} />;
}
