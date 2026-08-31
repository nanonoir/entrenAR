"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/layout/AdminPageHeader";
import { DeleteDiscountModal } from "@/components/admin/discounts/DeleteDiscountModal";
import { DiscountEmptyState } from "@/components/admin/discounts/DiscountEmptyState";
import { ShippingDiscountList } from "@/components/admin/discounts/ShippingDiscountList";
import { LinkButton } from "@/components/ui/LinkButton";
import { CommerceErrorBanner, CommerceLoadingState, CommerceMutationStatus, CommerceSourceBadge } from "@/components/admin/ui/CommerceDataState";
import type { DiscountSelectOption, ShippingDiscount } from "@/lib/data/admin/discounts/types";
import { useAdminDiscountsStore } from "@/stores/admin-discounts-store";
import { useAdminToastStore } from "@/stores/admin-toast-store";

type ShippingDiscountsPageClientProps = {
  categoryOptions: DiscountSelectOption[];
  shippingMethodOptions: DiscountSelectOption[];
  zoneOptions: DiscountSelectOption[];
};

export function ShippingDiscountsPageClient({ categoryOptions, shippingMethodOptions, zoneOptions }: ShippingDiscountsPageClientProps) {
  const shippingDiscounts = useAdminDiscountsStore((state) => state.shippingDiscounts);
  const activateShippingDiscount = useAdminDiscountsStore((state) => state.activateShippingDiscount);
  const deactivateShippingDiscount = useAdminDiscountsStore((state) => state.deactivateShippingDiscount);
  const deleteShippingDiscount = useAdminDiscountsStore((state) => state.deleteShippingDiscount);
  const clearError = useAdminDiscountsStore((state) => state.clearError);
  const error = useAdminDiscountsStore((state) => state.error);
  const hasLoaded = useAdminDiscountsStore((state) => state.hasLoaded);
  const load = useAdminDiscountsStore((state) => state.load);
  const shippingDiscountsEmpty = useAdminDiscountsStore((state) => state.shippingDiscountsEmpty);
  const source = useAdminDiscountsStore((state) => state.source);
  const status = useAdminDiscountsStore((state) => state.status);
  const addToast = useAdminToastStore((state) => state.addToast);
  const [shippingDiscountToDelete, setShippingDiscountToDelete] = useState<ShippingDiscount | null>(null);
  const [shippingDiscountToDeactivate, setShippingDiscountToDeactivate] = useState<ShippingDiscount | null>(null);

  useEffect(() => {
    if (!hasLoaded) void load();
  }, [hasLoaded, load]);

  function toggleShippingDiscount(shippingDiscount: ShippingDiscount) {
    if (shippingDiscount.status === "active") {
      clearError();
      setShippingDiscountToDeactivate(shippingDiscount);
      return;
    }
    return activateShippingDiscount(shippingDiscount.id).then((succeeded) => {
      if (succeeded) addToast("Envío gratis activado correctamente.");
    });
  }

  async function confirmDeactivate(): Promise<boolean> {
    if (!shippingDiscountToDeactivate) return false;
    const succeeded = await deactivateShippingDiscount(shippingDiscountToDeactivate.id);
    if (!succeeded) return false;

    addToast("Envío gratis desactivado correctamente.");
    setShippingDiscountToDeactivate(null);
    return true;
  }

  async function confirmDelete(): Promise<boolean> {
    if (!shippingDiscountToDelete) return false;
    const succeeded = await deleteShippingDiscount(shippingDiscountToDelete.id);
    if (!succeeded) return false;

    addToast("Envío gratis eliminado correctamente.");
    setShippingDiscountToDelete(null);
    return true;
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-5 overflow-hidden">
      <AdminPageHeader title="Envío gratis" description="Configurá reglas automáticas de envío gratis sin códigos de cupón." tag="Descuentos">
        <CommerceSourceBadge source={source} />
        <LinkButton href="/admin/descuentos/envio-gratis/nuevo" size="sm"><Plus aria-hidden size={16} />Crear envío gratis</LinkButton>
      </AdminPageHeader>
      {!hasLoaded && !error ? <CommerceLoadingState label="Cargando reglas de envío gratis…" /> : null}
      {!hasLoaded && error ? <CommerceErrorBanner error={error} onRetry={() => void load()} /> : null}
      {hasLoaded && status === "loading" ? <CommerceMutationStatus /> : null}
      {hasLoaded && error ? <CommerceErrorBanner error={error} onRetry={() => void load()} /> : null}
      {hasLoaded && shippingDiscountsEmpty ? (
        <DiscountEmptyState
          eyebrow="ENVÍO GRATIS"
          imageSrc="/freeShipPic.svg"
          title="Ofrecé envío gratis automático para aumentar tus ventas"
          description="Personalizá reglas automáticas de envío gratis: sumá condiciones, elegí zonas y combiná con otras promos para sacarle el máximo provecho."
          actionHref="/admin/descuentos/envio-gratis/nuevo"
          actionLabel="Crear envío gratis"
        />
      ) : hasLoaded ? (
        <>
          <ShippingDiscountList disabled={status === "loading"} shippingDiscounts={shippingDiscounts} categoryOptions={categoryOptions} shippingMethodOptions={shippingMethodOptions} zoneOptions={zoneOptions} onDelete={(discount) => { clearError(); setShippingDiscountToDelete(discount); }} onToggle={toggleShippingDiscount} />
          <p className="text-sm text-text-muted">Mostrando {shippingDiscounts.length} reglas de envío gratis.</p>
        </>
      ) : null}
      <DeleteDiscountModal error={error} open={Boolean(shippingDiscountToDelete)} title="¿Eliminar este envío gratis?" message="Recordá que podés desactivar el envío gratis sin eliminar esta configuración. Al eliminar, no podrás deshacer esta acción." confirmLabel="Eliminar" onClose={() => setShippingDiscountToDelete(null)} onConfirm={confirmDelete} />
      <DeleteDiscountModal error={error} open={Boolean(shippingDiscountToDeactivate)} title="¿Desactivar este envío gratis?" message="Al hacerlo, este descuento de envío dejará de estar disponible en la tienda." confirmLabel="Desactivar" onClose={() => setShippingDiscountToDeactivate(null)} onConfirm={confirmDeactivate} />
    </div>
  );
}
