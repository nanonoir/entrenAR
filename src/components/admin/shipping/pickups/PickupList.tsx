"use client";

import { Plus } from "lucide-react";
import { LinkButton } from "@/components/ui/LinkButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PickupPointCard } from "@/components/admin/shipping/pickups/PickupPointCard";
import { useAdminShippingStore } from "@/stores/admin-shipping-store";
import { useAdminToastStore } from "@/stores/admin-toast-store";

export function PickupList({ disabled = false, empty = false }: { disabled?: boolean; empty?: boolean }) {
  const pickupPoints = useAdminShippingStore((state) => state.pickupPoints);
  const deactivatePickupPoint = useAdminShippingStore((state) => state.deactivatePickupPoint);
  const addToast = useAdminToastStore((state) => state.addToast);

  async function handleDeactivate(pointId: string) {
    if (await deactivatePickupPoint(pointId)) addToast("Punto de retiro desactivado.", "success");
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-xl font-semibold text-text">Puntos de retiro</h2><p className="mt-1 text-sm text-text-muted">Gestioná el punto principal y puntos adicionales.</p></div>
        <LinkButton href="/admin/envios/medios-de-envio/retiros/nuevo" size="sm"><Plus aria-hidden size={16} />Crear punto de retiro</LinkButton>
      </div>
      {empty ? <EmptyState title="No hay puntos de retiro configurados" description="Creá un punto de retiro para ofrecer esta alternativa a tus clientes." /> : pickupPoints.map((point) => <PickupPointCard disabled={disabled} key={point.id} point={point} onDeactivate={() => handleDeactivate(point.id)} />)}
    </section>
  );
}
