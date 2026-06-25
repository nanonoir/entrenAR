"use client";

import { Edit2 } from "lucide-react";
import { AdminCard, AdminCardHeader } from "@/components/admin/ui/AdminCard";
import { Button } from "@/components/ui/Button";
import type { Customer } from "@/lib/data/admin/customers/types";

export function CustomerNotesCard({ customer, onEdit }: { customer: Customer; onEdit: () => void }) {
  return (
    <AdminCard>
      <div className="flex items-start justify-between gap-3"><AdminCardHeader title="Notas" description="Incluí notas específicas en base a los detalles de cada cliente." /><Button type="button" variant="secondary" size="icon" aria-label="Editar notas" onClick={onEdit}><Edit2 aria-hidden size={16} /></Button></div>
      {customer.notes ? <p className="whitespace-pre-wrap text-sm text-zinc-700">{customer.notes}</p> : <p className="text-sm text-zinc-500">Incluí notas específicas en base a los detalles de cada cliente.</p>}
    </AdminCard>
  );
}
