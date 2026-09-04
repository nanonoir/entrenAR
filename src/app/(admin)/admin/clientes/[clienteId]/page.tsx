"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Edit2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/layout/AdminPageHeader";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { CustomerAnonymizeModal } from "@/components/admin/customers/CustomerAnonymizeModal";
import { CustomerContactCard } from "@/components/admin/customers/CustomerContactCard";
import { CustomerDataCard } from "@/components/admin/customers/CustomerDataCard";
import { CustomerEmailModal } from "@/components/admin/customers/CustomerEmailModal";
import { CustomerNotesCard } from "@/components/admin/customers/CustomerNotesCard";
import { CustomerNotesModal } from "@/components/admin/customers/CustomerNotesModal";
import { CustomerSalesCard } from "@/components/admin/customers/CustomerSalesCard";
import { buildCustomerDetailCsv } from "@/lib/data/admin/customers/csv";
import { buildCustomerSalesSummary, formatLongAdminDate, getCustomerDisplayName } from "@/lib/formatting/customer";
import { useAdminCustomersStore } from "@/stores/admin-customers-store";
import { useAdminSalesStore } from "@/stores/admin-sales-store";
import { useAdminToastStore } from "@/stores/admin-toast-store";
import { customerExportFilename, downloadCsv } from "@/components/admin/customers/customer-ui";

export default function CustomerDetailPage({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = use(params);
  const customer = useAdminCustomersStore((state) => state.customers.find((item) => item.id === clienteId));
  const dataSource = useAdminCustomersStore((state) => state.dataSource);
  const error = useAdminCustomersStore((state) => state.error);
  const fallbackMessage = useAdminCustomersStore((state) => state.fallbackMessage);
  const hasLoaded = useAdminCustomersStore((state) => state.hasLoaded);
  const isLoading = useAdminCustomersStore((state) => state.isLoading);
  const refreshCustomer = useAdminCustomersStore((state) => state.refreshCustomer);
  const allSales = useAdminSalesStore((state) => state.sales);
  const addToast = useAdminToastStore((state) => state.addToast);
  const [notesOpen, setNotesOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [anonymizeOpen, setAnonymizeOpen] = useState(false);
  const sales = useMemo(() => allSales.filter((sale) => sale.customerId === clienteId), [allSales, clienteId]);
  const summary = useMemo(() => customer?.summary ?? buildCustomerSalesSummary(clienteId, sales), [clienteId, customer, sales]);

  useEffect(() => {
    if (dataSource === "api" && (!hasLoaded || !customer?.summary)) void refreshCustomer(clienteId);
  }, [dataSource, hasLoaded, refreshCustomer, clienteId, customer?.summary]);

  if (!customer) {
    return <div className="py-12 text-center"><p className="text-lg font-semibold text-zinc-800">{isLoading || (dataSource === "api" && !hasLoaded) ? "Cargando cliente…" : error ?? "Cliente no encontrado"}</p><Link href="/admin/clientes" className="mt-3 inline-block text-sm text-accent underline">Volver al listado</Link></div>;
  }

  function handleExport() {
    if (!customer || customer.isAnonymized) return;
    downloadCsv(customerExportFilename("detail", customer.id), buildCustomerDetailCsv(customer, summary, sales));
    addToast("Datos del cliente exportados correctamente.");
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      {fallbackMessage ? <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{fallbackMessage}</p> : null}
      {error ? <p role="alert" className="rounded-2xl border border-sale/20 bg-red-50 px-4 py-3 text-sm font-medium text-sale">{error}</p> : null}
      <AdminPageHeader title="Detalles del cliente" description={`${getCustomerDisplayName(customer)} · Primera interacción el ${formatLongAdminDate(customer.firstInteractionDate)}`} tag="Clientes" backLink={{ href: "/admin/clientes", label: "Volver" }}>
        <Button type="button" variant="secondary" size="sm" disabled={customer.isAnonymized} onClick={handleExport}><Download aria-hidden size={16} />Exportar datos</Button>
        {customer.isAnonymized ? <Button type="button" variant="secondary" size="sm" disabled><Edit2 aria-hidden size={16} />Editar</Button> : <LinkButton href={`/admin/clientes/${customer.id}/editar`} variant="secondary" size="sm"><Edit2 aria-hidden size={16} />Editar</LinkButton>}
      </AdminPageHeader>
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-5 lg:order-1"><CustomerSalesCard sales={sales} /></div>
        <div className="grid content-start gap-5 lg:order-2"><CustomerDataCard customer={customer} onAnonymize={() => setAnonymizeOpen(true)} />{!customer.isAnonymized ? <><CustomerNotesCard customer={customer} onEdit={() => setNotesOpen(true)} /><CustomerContactCard customer={customer} onEmail={() => setEmailOpen(true)} /></> : null}</div>
      </div>
      <CustomerNotesModal customer={customer} open={notesOpen} onClose={() => setNotesOpen(false)} />
      <CustomerEmailModal customer={customer} open={emailOpen} onClose={() => setEmailOpen(false)} />
      <CustomerAnonymizeModal customer={customer} open={anonymizeOpen} onClose={() => setAnonymizeOpen(false)} />
    </div>
  );
}
