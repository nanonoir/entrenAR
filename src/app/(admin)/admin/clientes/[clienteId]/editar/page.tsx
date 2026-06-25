"use client";

import { use } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/layout/AdminPageHeader";
import { CustomerEditPageClient } from "@/app/(admin)/admin/clientes/[clienteId]/editar/CustomerEditPageClient";
import { useAdminCustomersStore } from "@/stores/admin-customers-store";
import { getCustomerDisplayName } from "@/lib/formatting/customer";

export default function CustomerEditPage({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = use(params);
  const customer = useAdminCustomersStore((state) => state.customers.find((item) => item.id === clienteId));

  if (!customer) {
    return <div className="py-12 text-center"><p className="text-lg font-semibold text-zinc-800">Cliente no encontrado</p><Link href="/admin/clientes" className="mt-3 inline-block text-sm text-accent underline">Volver al listado</Link></div>;
  }

  return (
    <div className="grid gap-5">
      <AdminPageHeader title="Editar cliente" description={getCustomerDisplayName(customer)} tag="Clientes" backLink={{ href: `/admin/clientes/${customer.id}`, label: "Volver" }} />
      <CustomerEditPageClient customer={customer} />
    </div>
  );
}
