"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { CustomerEditPageClient } from "@/app/(admin)/admin/clientes/[clienteId]/editar/CustomerEditPageClient";
import { useAdminCustomersStore } from "@/stores/admin-customers-store";

export default function CustomerEditPage({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = use(params);
  const customer = useAdminCustomersStore((state) => state.customers.find((item) => item.id === clienteId));
  const dataSource = useAdminCustomersStore((state) => state.dataSource);
  const error = useAdminCustomersStore((state) => state.error);
  const hasLoaded = useAdminCustomersStore((state) => state.hasLoaded);
  const isLoading = useAdminCustomersStore((state) => state.isLoading);
  const refreshCustomer = useAdminCustomersStore((state) => state.refreshCustomer);

  useEffect(() => {
    if (dataSource === "api" && (!hasLoaded || !customer?.summary)) void refreshCustomer(clienteId);
  }, [dataSource, hasLoaded, refreshCustomer, clienteId, customer?.summary]);

  if (!customer) {
    return <div className="py-12 text-center"><p className="text-lg font-semibold text-zinc-800">{isLoading || (dataSource === "api" && !hasLoaded) ? "Cargando cliente…" : error ?? "Cliente no encontrado"}</p><Link href="/admin/clientes" className="mt-3 inline-block text-sm text-accent underline">Volver al listado</Link></div>;
  }

  return <CustomerEditPageClient customer={customer} />;
}
