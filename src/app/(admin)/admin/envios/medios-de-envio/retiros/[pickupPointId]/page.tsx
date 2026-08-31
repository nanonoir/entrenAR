"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/layout/AdminPageHeader";
import { PickupPointForm } from "@/components/admin/shipping/pickups/pickup-form/PickupPointForm";
import { CommerceErrorBanner, CommerceLoadingState, CommerceSourceBadge } from "@/components/admin/ui/CommerceDataState";
import { useAdminShippingStore } from "@/stores/admin-shipping-store";
import { useAdminToastStore } from "@/stores/admin-toast-store";
import type { PickupPointFormValues } from "@/schemas/admin/shipping-schemas";
import type { PickupPoint } from "@/lib/data/admin/shipping/shipping-config";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";

function newPickupPoint(): PickupPoint {
  return { id: `retiro-${Date.now()}`, name: "Nuevo punto de retiro", status: "not_configured", isMain: false, address: { street: "", number: "", city: "", province: "", postalCode: "" }, schedule: [], preparationHours: 24, costType: "free", coverageType: "all", provinces: [] };
}

export default function PickupPointConfigPage({ params }: { params: Promise<{ pickupPointId: string }> }) {
  const { pickupPointId } = use(params);
  const router = useRouter();
  const pickupPoints = useAdminShippingStore((state) => state.pickupPoints);
  const savePickupPoint = useAdminShippingStore((state) => state.savePickupPoint);
  const error = useAdminShippingStore((state) => state.error);
  const hasLoaded = useAdminShippingStore((state) => state.hasLoaded);
  const load = useAdminShippingStore((state) => state.load);
  const source = useAdminShippingStore((state) => state.source);
  const addToast = useAdminToastStore((state) => state.addToast);
  const [formDirty, setFormDirty] = useState(false);
  const { discardModal, interceptNavigation } = useUnsavedChangesGuard({ isDirty: formDirty });
  useEffect(() => {
    if (!hasLoaded) void load();
  }, [hasLoaded, load]);

  if (!hasLoaded) return <div className="mx-auto grid w-full max-w-5xl gap-4">{error ? <CommerceErrorBanner error={error} onRetry={() => void load()} /> : <CommerceLoadingState label="Cargando puntos de retiro…" />}</div>;
  const pickupPoint = pickupPointId === "nuevo" ? newPickupPoint() : pickupPoints.find((point) => point.id === pickupPointId);
  if (!pickupPoint) return <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-white p-8 text-center text-sm font-semibold text-text-muted">Punto de retiro no encontrado.</div>;
  async function handleSubmit(values: PickupPointFormValues): Promise<boolean> {
    const succeeded = await savePickupPoint(values);
    if (!succeeded) return false;

    addToast(values.status === "active" ? "Punto de retiro activado." : "Punto de retiro guardado.", "success");
    router.push("/admin/envios/medios-de-envio");
    return true;
  }
  return <div className="mx-auto grid w-full max-w-5xl gap-5"><AdminPageHeader tag="Envíos" title={pickupPointId === "nuevo" ? "Nuevo punto de retiro" : pickupPoint.name} description="Configurá dirección, horarios, costo y cobertura." backLink={{ href: "/admin/envios/medios-de-envio", label: "Volver", onNavigate: interceptNavigation }}><CommerceSourceBadge source={source} /></AdminPageHeader><PickupPointForm pickupPoint={pickupPoint} onSubmit={handleSubmit} onDirtyChange={setFormDirty} interceptNavigation={interceptNavigation} />{discardModal}</div>;
}
