"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Filter, Plus, Search, Users } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/layout/AdminPageHeader";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { CustomerEmailModal } from "@/components/admin/customers/CustomerEmailModal";
import { CustomerFilterDrawer, defaultCustomerFilters, type CustomerFilters } from "@/components/admin/customers/CustomerFilterDrawer";
import { CustomerListCard } from "@/components/admin/customers/CustomerListCard";
import { CustomerTable } from "@/components/admin/customers/CustomerTable";
import type { Customer, CustomerSalesSummary } from "@/lib/data/admin/customers/types";
import { buildCustomersCsv } from "@/lib/data/admin/customers/csv";
import { buildCustomerSalesSummary } from "@/lib/formatting/customer";
import { useAdminCustomersStore } from "@/stores/admin-customers-store";
import { useAdminSalesStore } from "@/stores/admin-sales-store";
import { useAdminToastStore } from "@/stores/admin-toast-store";
import { customerExportFilename, downloadCsv } from "@/components/admin/customers/customer-ui";

export function CustomerListClient() {
  const customers = useAdminCustomersStore((state) => state.customers);
  const dataSource = useAdminCustomersStore((state) => state.dataSource);
  const error = useAdminCustomersStore((state) => state.error);
  const fallbackMessage = useAdminCustomersStore((state) => state.fallbackMessage);
  const fetchCustomers = useAdminCustomersStore((state) => state.fetchCustomers);
  const hasLoaded = useAdminCustomersStore((state) => state.hasLoaded);
  const isLoading = useAdminCustomersStore((state) => state.isLoading);
  const retryLoad = useAdminCustomersStore((state) => state.retryLoad);
  const sales = useAdminSalesStore((state) => state.sales);
  const addToast = useAdminToastStore((state) => state.addToast);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CustomerFilters>(defaultCustomerFilters);
  const [draftFilters, setDraftFilters] = useState<CustomerFilters>(defaultCustomerFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [emailCustomer, setEmailCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    if (dataSource === "api" && !hasLoaded) void fetchCustomers({ limit: 100 });
  }, [dataSource, fetchCustomers, hasLoaded]);

  const summaries = useMemo(() => customers.reduce<Record<string, CustomerSalesSummary>>((acc, customer) => ({ ...acc, [customer.id]: customer.summary ?? buildCustomerSalesSummary(customer.id, sales) }), {}), [customers, sales]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return customers
      .filter((customer) => {
        const matchesSearch = !query || [customer.fullName, customer.email, customer.dniOrCuil ?? "", customer.id].some((value) => value.toLowerCase().includes(query));
        const matchesCountry = filters.country === "all" || customer.address?.country === filters.country;
        const matchesProvince = filters.provinceOrState === "all" || customer.address?.provinceOrState === filters.provinceOrState;
        const matchesCity = filters.city === "all" || customer.address?.city === filters.city;
        return matchesSearch && matchesCountry && matchesProvince && matchesCity;
      })
      .sort((a, b) => sortDirection === "desc" ? summaries[b.id].totalSpent - summaries[a.id].totalSpent : summaries[a.id].totalSpent - summaries[b.id].totalSpent);
  }, [customers, filters, search, sortDirection, summaries]);

  const hasFilters = Boolean(search.trim()) || Object.values(filters).some((value) => value !== "all");

  function exportList() {
    downloadCsv(customerExportFilename("list"), buildCustomersCsv(customers, summaries));
    addToast("Lista de clientes exportada correctamente.");
  }

  function clearFilters() {
    setSearch("");
    setDraftFilters(defaultCustomerFilters);
    setFilters(defaultCustomerFilters);
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-5 overflow-hidden">
      <AdminPageHeader title="Clientes" description="Gestioná perfiles, contactos e historial de ventas." tag="CRM">
        <Button type="button" variant="secondary" size="sm" onClick={exportList}><Download aria-hidden size={16} />Exportar lista</Button>
        <LinkButton href="/admin/clientes/nuevo" size="sm"><Plus aria-hidden size={16} />Agregar nuevo cliente</LinkButton>
      </AdminPageHeader>
      <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="relative">
            <input
              id="customer-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Buscar por nombre, e-mail o DNI"
              aria-label="Buscar por nombre, e-mail o DNI"
              className="h-11 w-full rounded-button border border-border bg-surface px-3 pr-10 text-base outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm"
            />
            <Search aria-hidden size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
          </div>
          <Button type="button" variant="secondary" onClick={() => { setDraftFilters(filters); setFilterOpen(true); }}><Filter aria-hidden size={16} />Filtros</Button>
        </div>
      </div>
      {fallbackMessage ? <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{fallbackMessage}</p> : null}
      {error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sale/20 bg-red-50 px-4 py-3 text-sm font-medium text-sale"><span>{error}</span><Button type="button" variant="secondary" size="sm" onClick={() => void retryLoad()}>Reintentar</Button></div> : null}
      {isLoading && customers.length === 0 ? <p role="status" className="rounded-3xl border border-zinc-200 bg-white px-4 py-12 text-center text-sm text-zinc-500">Cargando clientes…</p> : customers.length === 0 || filtered.length === 0 ? <CustomersEmptyState hasFilters={hasFilters} onClear={clearFilters} /> : <><CustomerTable customers={filtered} summaries={summaries} sortDirection={sortDirection} onSort={() => setSortDirection((current) => current === "desc" ? "asc" : "desc")} onEmail={setEmailCustomer} /><div className="grid min-w-0 gap-3 lg:hidden">{filtered.map((customer) => <CustomerListCard key={customer.id} customer={customer} summary={summaries[customer.id]} onEmail={setEmailCustomer} />)}</div><p className="text-sm text-zinc-500">Mostrando 1-{filtered.length} clientes de {filtered.length}</p></>}
      <CustomerFilterDrawer customers={customers} open={filterOpen} draftFilters={draftFilters} onDraftChange={setDraftFilters} onClose={() => setFilterOpen(false)} onApply={() => { setFilters(draftFilters); setFilterOpen(false); }} onClear={clearFilters} />
      <CustomerEmailModal open={Boolean(emailCustomer)} customer={emailCustomer} onClose={() => setEmailCustomer(null)} />
    </div>
  );
}

function CustomersEmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-zinc-200 bg-white py-16 text-center shadow-sm">
      <Users aria-hidden size={40} className="text-zinc-300" />
      <div><p className="text-lg font-semibold text-zinc-800">{hasFilters ? "No encontramos clientes con esos criterios." : "Todavía no tenés clientes cargados."}</p><p className="mt-1 text-sm text-zinc-500">{hasFilters ? "Probá modificar la búsqueda o borrar los filtros aplicados." : "Cuando recibas ventas o agregues clientes manualmente, aparecerán en esta lista."}</p></div>
      {hasFilters ? <Button variant="secondary" onClick={onClear}>Borrar filtros</Button> : <LinkButton href="/admin/clientes/nuevo">Agregar nuevo cliente</LinkButton>}
    </div>
  );
}
