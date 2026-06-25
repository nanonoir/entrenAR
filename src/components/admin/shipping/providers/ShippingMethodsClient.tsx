"use client";

import { useState } from "react";
import { AdminPageHeader } from "@/components/admin/layout/AdminPageHeader";
import { Button } from "@/components/ui/Button";
import { ProviderCard } from "@/components/admin/shipping/providers/ProviderCard";
import { ProviderStatusFilter, type ProviderFilter } from "@/components/admin/shipping/providers/ProviderStatusFilter";
import { PickupList } from "@/components/admin/shipping/pickups/PickupList";
import { useAdminShippingStore } from "@/stores/admin-shipping-store";
import { useAdminToastStore } from "@/stores/admin-toast-store";
import { cn } from "@/lib/utils";

export function ShippingMethodsClient() {
  const [filter, setFilter] = useState<ProviderFilter>("all");
  const activeTab = useAdminShippingStore((state) => state.activeTab);
  const setActiveTab = useAdminShippingStore((state) => state.setActiveTab);
  const providers = useAdminShippingStore((state) => state.providers);
  const deactivateProvider = useAdminShippingStore((state) => state.deactivateProvider);
  const addToast = useAdminToastStore((state) => state.addToast);
  const visibleProviders = providers.filter((provider) => filter === "all" || (filter === "active" ? provider.status === "active" : provider.status !== "active"));

  return (
    <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-5 overflow-hidden">
      <AdminPageHeader description="Configurá proveedores y puntos de retiro para preparar la operación logística." tag="Envíos" title="Medios de Envío" backLink={{ href: "/admin/envios", label: "Volver" }} />
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Secciones de medios de envío">
        <Button type="button" role="tab" aria-selected={activeTab === "providers"} size="sm" variant={activeTab === "providers" ? "primary" : "secondary"} className={cn(activeTab !== "providers" && "bg-white")} onClick={() => setActiveTab("providers")}>Proveedores</Button>
        <Button type="button" role="tab" aria-selected={activeTab === "pickups"} size="sm" variant={activeTab === "pickups" ? "primary" : "secondary"} className={cn(activeTab !== "pickups" && "bg-white")} onClick={() => setActiveTab("pickups")}>Retiros</Button>
      </div>
      {activeTab === "providers" ? <><ProviderStatusFilter value={filter} onChange={setFilter} /><div className="grid min-w-0 gap-4">{visibleProviders.map((provider) => <ProviderCard key={provider.id} provider={provider} onDeactivate={() => { deactivateProvider(provider.id); addToast("Proveedor desactivado.", "success"); }} />)}</div></> : <PickupList />}
    </div>
  );
}
