"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { AdminPageHeader } from "@/components/admin/layout/AdminPageHeader";
import { DeleteDiscountModal } from "@/components/admin/discounts/DeleteDiscountModal";
import { DiscountEmptyState } from "@/components/admin/discounts/DiscountEmptyState";
import { ShippingDiscountList } from "@/components/admin/discounts/ShippingDiscountList";
import { LinkButton } from "@/components/ui/LinkButton";
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
  const addToast = useAdminToastStore((state) => state.addToast);
  const [shippingDiscountToDelete, setShippingDiscountToDelete] = useState<ShippingDiscount | null>(null);
  const [shippingDiscountToDeactivate, setShippingDiscountToDeactivate] = useState<ShippingDiscount | null>(null);

  function toggleShippingDiscount(shippingDiscount: ShippingDiscount) {
    if (shippingDiscount.status === "active") {
      setShippingDiscountToDeactivate(shippingDiscount);
      return;
    }
    activateShippingDiscount(shippingDiscount.id);
    addToast("Envío gratis activado correctamente.");
  }

  function confirmDeactivate() {
    if (!shippingDiscountToDeactivate) return;
    deactivateShippingDiscount(shippingDiscountToDeactivate.id);
    addToast("Envío gratis desactivado correctamente.");
    setShippingDiscountToDeactivate(null);
  }

  function confirmDelete() {
    if (!shippingDiscountToDelete) return;
    deleteShippingDiscount(shippingDiscountToDelete.id);
    addToast("Envío gratis eliminado correctamente.");
    setShippingDiscountToDelete(null);
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-5 overflow-hidden">
      <AdminPageHeader title="Envío gratis" description="Configurá reglas automáticas de envío gratis sin códigos de cupón." tag="Descuentos">
        <LinkButton href="/admin/descuentos/envio-gratis/nuevo" size="sm"><Plus aria-hidden size={16} />Crear envío gratis</LinkButton>
      </AdminPageHeader>
      {shippingDiscounts.length === 0 ? (
        <DiscountEmptyState
          eyebrow="ENVÍO GRATIS"
          imageSrc="/freeShipPic.svg"
          title="Ofrecé envío gratis automático para aumentar tus ventas"
          description="Personalizá reglas automáticas de envío gratis: sumá condiciones, elegí zonas y combiná con otras promos para sacarle el máximo provecho."
          actionHref="/admin/descuentos/envio-gratis/nuevo"
          actionLabel="Crear envío gratis"
        />
      ) : (
        <>
          <ShippingDiscountList shippingDiscounts={shippingDiscounts} categoryOptions={categoryOptions} shippingMethodOptions={shippingMethodOptions} zoneOptions={zoneOptions} onDelete={setShippingDiscountToDelete} onToggle={toggleShippingDiscount} />
          <p className="text-sm text-text-muted">Mostrando {shippingDiscounts.length} reglas de envío gratis.</p>
        </>
      )}
      <DeleteDiscountModal open={Boolean(shippingDiscountToDelete)} title="¿Eliminar este envío gratis?" message="Recordá que podés desactivar el envío gratis sin eliminar esta configuración. Al eliminar, no podrás deshacer esta acción." confirmLabel="Eliminar" onClose={() => setShippingDiscountToDelete(null)} onConfirm={confirmDelete} />
      <DeleteDiscountModal open={Boolean(shippingDiscountToDeactivate)} title="¿Desactivar este envío gratis?" message="Al hacerlo, este descuento de envío dejará de estar disponible en la tienda." confirmLabel="Desactivar" onClose={() => setShippingDiscountToDeactivate(null)} onConfirm={confirmDeactivate} />
    </div>
  );
}
