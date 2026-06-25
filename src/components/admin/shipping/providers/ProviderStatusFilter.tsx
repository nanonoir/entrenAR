"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export type ProviderFilter = "all" | "active" | "inactive";
const tabs: Array<{ id: ProviderFilter; label: string }> = [{ id: "all", label: "Todos" }, { id: "active", label: "Activados" }, { id: "inactive", label: "Inactivos" }];

export function ProviderStatusFilter({ value, onChange }: { value: ProviderFilter; onChange: (value: ProviderFilter) => void }) {
  return <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar proveedores">{tabs.map((tab) => <Button key={tab.id} type="button" role="tab" aria-selected={value === tab.id} size="sm" variant={value === tab.id ? "primary" : "secondary"} className={cn(value !== tab.id && "bg-white")} onClick={() => onChange(tab.id)}>{tab.label}</Button>)}</div>;
}
