"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/layout/AdminPageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProviderCard } from "@/components/admin/shipping/providers/ProviderCard";
import { ProviderStatusFilter, type ProviderFilter } from "@/components/admin/shipping/providers/ProviderStatusFilter";
import { PickupList } from "@/components/admin/shipping/pickups/PickupList";
import { CommerceErrorBanner, CommerceLoadingState, CommerceMutationStatus, CommerceSourceBadge } from "@/components/admin/ui/CommerceDataState";
import { useAdminShippingStore } from "@/stores/admin-shipping-store";
import { useAdminToastStore } from "@/stores/admin-toast-store";
import { cn } from "@/lib/utils";

export function ShippingMethodsClient() {
  const [filter, setFilter] = useState<ProviderFilter>("all");
  const activeTab = useAdminShippingStore((state) => state.activeTab);
  const setActiveTab = useAdminShippingStore((state) => state.setActiveTab);
  const providers = useAdminShippingStore((state) => state.providers);
  const deactivateProvider = useAdminShippingStore((state) => state.deactivateProvider);
  const error = useAdminShippingStore((state) => state.error);
  const hasLoaded = useAdminShippingStore((state) => state.hasLoaded);
  const load = useAdminShippingStore((state) => state.load);
  const pickupPointsEmpty = useAdminShippingStore((state) => state.pickupPointsEmpty);
  const providersEmpty = useAdminShippingStore((state) => state.providersEmpty);
  const source = useAdminShippingStore((state) => state.source);
  const status = useAdminShippingStore((state) => state.status);
  const addToast = useAdminToastStore((state) => state.addToast);
  const visibleProviders = providers.filter((provider) => filter === "all" || (filter === "active" ? provider.status === "active" : provider.status !== "active"));
  const isBusy = status === "loading";

  useEffect(() => {
    if (!hasLoaded) void load();
  }, [hasLoaded, load]);

  async function handleDeactivateProvider(providerId: typeof providers[number]["id"]) {
    if (await deactivateProvider(providerId)) addToast("Proveedor desactivado.", "success");
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-5 overflow-hidden">
      <AdminPageHeader description="Configurá proveedores y puntos de retiro para preparar la operación logística." tag="Envíos" title="Medios de Envío" backLink={{ href: "/admin/envios", label: "Volver" }}>
        <CommerceSourceBadge source={source} />
      </AdminPageHeader>
      {!hasLoaded && !error ? <CommerceLoadingState label="Cargando configuración de envíos…" /> : null}
      {!hasLoaded && error ? <CommerceErrorBanner error={error} onRetry={() => void load()} /> : null}
      {hasLoaded && status === "loading" ? <CommerceMutationStatus /> : null}
      {hasLoaded && error ? <CommerceErrorBanner error={error} onRetry={() => void load()} /> : null}
      {hasLoaded ? <div className="flex flex-wrap gap-2" role="tablist" aria-label="Secciones de medios de envío">
        <Button type="button" role="tab" aria-selected={activeTab === "providers"} size="sm" variant={activeTab === "providers" ? "primary" : "secondary"} className={cn(activeTab !== "providers" && "bg-white")} onClick={() => setActiveTab("providers")}>Proveedores</Button>
        <Button type="button" role="tab" aria-selected={activeTab === "pickups"} size="sm" variant={activeTab === "pickups" ? "primary" : "secondary"} className={cn(activeTab !== "pickups" && "bg-white")} onClick={() => setActiveTab("pickups")}>Retiros</Button>
      </div> : null}
      {hasLoaded && activeTab === "providers" ? providersEmpty ? <EmptyState title="No hay proveedores configurados" description="Cuando existan proveedores disponibles, vas a poder configurarlos desde esta sección." /> : <><ProviderStatusFilter value={filter} onChange={setFilter} /><div className="grid min-w-0 gap-4">{visibleProviders.length ? visibleProviders.map((provider) => <ProviderCard key={provider.id} disabled={isBusy} provider={provider} onDeactivate={() => handleDeactivateProvider(provider.id)} />) : <EmptyState title="No hay proveedores para mostrar" description="Probá cambiar el filtro de estado para volver a ver la configuración." />}</div></> : null}
      {hasLoaded && activeTab === "pickups" ? <PickupList disabled={isBusy} empty={pickupPointsEmpty} /> : null}
    </div>
  );
}
