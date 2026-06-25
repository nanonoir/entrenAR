"use client";

import { Trash2 } from "lucide-react";
import { AdminCard, AdminCardHeader } from "@/components/admin/ui/AdminCard";
import { Button } from "@/components/ui/Button";
import type { Customer } from "@/lib/data/admin/customers/types";
import { formatCustomerAddress, getCustomerDisplayName } from "@/lib/formatting/customer";

export function CustomerDataCard({ customer, onAnonymize }: { customer: Customer; onAnonymize: () => void }) {
  return (
    <AdminCard>
      <AdminCardHeader title="Datos del cliente" />
      {customer.isAnonymized ? <p className="font-semibold text-zinc-900">{getCustomerDisplayName(customer)}</p> : <div className="grid gap-1 text-sm text-zinc-700"><p className="font-semibold text-zinc-900">{customer.fullName}</p><p>{customer.email}</p>{customer.phone ? <p>{customer.phone}</p> : null}{customer.dniOrCuil ? <p className="text-xs text-zinc-500">DNI/CUIL: {customer.dniOrCuil}</p> : null}<p className="pt-2 text-zinc-600">{formatCustomerAddress(customer.address)}</p></div>}
      {!customer.isAnonymized ? <Button type="button" variant="danger" size="sm" className="mt-5" onClick={onAnonymize}><Trash2 aria-hidden size={16} />Eliminar datos del cliente</Button> : null}
    </AdminCard>
  );
}
