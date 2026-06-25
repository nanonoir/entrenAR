"use client";

import { Mail, MessageCircle } from "lucide-react";
import { AdminCard, AdminCardHeader } from "@/components/admin/ui/AdminCard";
import { Button } from "@/components/ui/Button";
import type { Customer } from "@/lib/data/admin/customers/types";
import { buildWhatsAppUrl } from "@/lib/formatting/customer";

export function CustomerContactCard({ customer, onEmail }: { customer: Customer; onEmail: () => void }) {
  const whatsappUrl = buildWhatsAppUrl(customer);
  return (
    <AdminCard>
      <AdminCardHeader title="Contacto" description="Contactá al cliente por WhatsApp o e-mail." />
      <div className="grid gap-2"><Button type="button" variant="secondary" disabled={!whatsappUrl} onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}><MessageCircle aria-hidden size={16} />WhatsApp</Button><Button type="button" variant="secondary" disabled={customer.isAnonymized || !customer.email} onClick={onEmail}><Mail aria-hidden size={16} />Enviar email</Button></div>
      {!whatsappUrl ? <p className="mt-2 text-xs text-zinc-500">Este cliente no tiene teléfono cargado.</p> : null}
    </AdminCard>
  );
}
