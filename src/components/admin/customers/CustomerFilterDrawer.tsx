"use client";

import { AdminFilterDrawer } from "@/components/admin/filters";
import type { Customer } from "@/lib/data/admin/customers/types";

export type CustomerFilters = { country: string; provinceOrState: string; city: string };
export const defaultCustomerFilters: CustomerFilters = { country: "all", provinceOrState: "all", city: "all" };

type CustomerFilterDrawerProps = {
  customers: Customer[];
  draftFilters: CustomerFilters;
  open: boolean;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
  onDraftChange: (filters: CustomerFilters) => void;
};

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b));
}

export function CustomerFilterDrawer({ customers, draftFilters, onApply, onClear, onClose, onDraftChange, open }: CustomerFilterDrawerProps) {
  const countries = unique(customers.map((customer) => customer.address?.country));
  const provinces = unique(customers.filter((customer) => draftFilters.country === "all" || customer.address?.country === draftFilters.country).map((customer) => customer.address?.provinceOrState));
  const cities = unique(customers.filter((customer) => (draftFilters.country === "all" || customer.address?.country === draftFilters.country) && (draftFilters.provinceOrState === "all" || customer.address?.provinceOrState === draftFilters.provinceOrState)).map((customer) => customer.address?.city));

  return (
    <AdminFilterDrawer open={open} title="Filtrar clientes" onApply={onApply} onClear={onClear} onClose={onClose}>
      <div className="grid gap-4">
        <FilterSelect id="customer-country-filter" label="País" value={draftFilters.country} options={countries} emptyLabel="Todos" onChange={(country) => onDraftChange({ country, provinceOrState: "all", city: "all" })} />
        <FilterSelect id="customer-province-filter" label="Provincia" value={draftFilters.provinceOrState} options={provinces} emptyLabel="Todas" onChange={(provinceOrState) => onDraftChange({ ...draftFilters, provinceOrState, city: "all" })} />
        <FilterSelect id="customer-city-filter" label="Ciudad" value={draftFilters.city} options={cities} emptyLabel="Todas" onChange={(city) => onDraftChange({ ...draftFilters, city })} />
      </div>
    </AdminFilterDrawer>
  );
}

function FilterSelect({ emptyLabel, id, label, onChange, options, value }: { emptyLabel: string; id: string; label: string; onChange: (value: string) => void; options: string[]; value: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-text" htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.currentTarget.value)} className="h-11 w-full rounded-button border border-border bg-surface px-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm">
        <option value="all">{emptyLabel}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
