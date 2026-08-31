"use client";

import { useRouter } from "next/navigation";
import { Power, PowerOff, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/layout/AdminPageHeader";
import { DeleteDiscountModal } from "@/components/admin/discounts/DeleteDiscountModal";
import { DiscountStatusBadge } from "@/components/admin/discounts/DiscountStatusBadge";
import { ShippingDiscountForm } from "@/components/admin/discounts/ShippingDiscountForm";
import { getShippingMethodsLabel } from "@/components/admin/discounts/discount-utils";
import { Button } from "@/components/ui/Button";
import { CommerceErrorBanner, CommerceLoadingState, CommerceMutationStatus, CommerceSourceBadge } from "@/components/admin/ui/CommerceDataState";
import type { DiscountSelectOption } from "@/lib/data/admin/discounts/types";
import { useAdminDiscountsStore } from "@/stores/admin-discounts-store";
import { useAdminToastStore } from "@/stores/admin-toast-store";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";

type ShippingDiscountFormPageClientProps = {
  categoryOptions: DiscountSelectOption[];
  mode: "create" | "edit";
  shippingDiscountId?: string;
  shippingMethodOptions: DiscountSelectOption[];
  zoneOptions: DiscountSelectOption[];
};

export function ShippingDiscountFormPageClient({ categoryOptions, mode, shippingDiscountId, shippingMethodOptions, zoneOptions }: ShippingDiscountFormPageClientProps) {
  const router = useRouter();
  const shippingDiscount = useAdminDiscountsStore((state) => shippingDiscountId ? state.shippingDiscounts.find((item) => item.id === shippingDiscountId) : undefined);
  const activateShippingDiscount = useAdminDiscountsStore((state) => state.activateShippingDiscount);
  const deactivateShippingDiscount = useAdminDiscountsStore((state) => state.deactivateShippingDiscount);
  const deleteShippingDiscount = useAdminDiscountsStore((state) => state.deleteShippingDiscount);
  const clearError = useAdminDiscountsStore((state) => state.clearError);
  const error = useAdminDiscountsStore((state) => state.error);
  const hasLoaded = useAdminDiscountsStore((state) => state.hasLoaded);
  const load = useAdminDiscountsStore((state) => state.load);
  const source = useAdminDiscountsStore((state) => state.source);
  const status = useAdminDiscountsStore((state) => state.status);
  const addToast = useAdminToastStore((state) => state.addToast);
  const [formDirty, setFormDirty] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const { discardModal, interceptNavigation } = useUnsavedChangesGuard({ isDirty: formDirty });

  useEffect(() => {
    if (!hasLoaded) void load();
  }, [hasLoaded, load]);

  if (!hasLoaded) return <div className="mx-auto grid w-full max-w-5xl gap-4">{error ? <CommerceErrorBanner error={error} onRetry={() => void load()} /> : <CommerceLoadingState label="Cargando regla de envío gratis…" />}</div>;

  if (mode === "edit" && !shippingDiscount) {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-4 rounded-3xl border border-border bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-text">Envío gratis no encontrado</h1>
        <p className="text-sm text-text-muted">La regla pudo haber sido eliminada o no existe en esta sesión.</p>
        <div><Button onClick={() => router.push("/admin/descuentos/envio-gratis")}>Volver a envío gratis</Button></div>
      </div>
    );
  }

  async function activate() {
    if (!shippingDiscount) return;
    const succeeded = await activateShippingDiscount(shippingDiscount.id);
    if (!succeeded) return;
    addToast("Envío gratis activado correctamente.");
  }

  async function confirmDeactivate(): Promise<boolean> {
    if (!shippingDiscount) return false;
    const succeeded = await deactivateShippingDiscount(shippingDiscount.id);
    if (!succeeded) return false;

    addToast("Envío gratis desactivado correctamente.");
    setDeactivateOpen(false);
    return true;
  }

  async function confirmDelete(): Promise<boolean> {
    if (!shippingDiscount) return false;
    const succeeded = await deleteShippingDiscount(shippingDiscount.id);
    if (!succeeded) return false;

    addToast("Envío gratis eliminado correctamente.");
    router.push("/admin/descuentos/envio-gratis");
    return true;
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-5 overflow-hidden">
      <AdminPageHeader title={mode === "create" ? "Crear envío gratis" : "Editar envío gratis"} description={mode === "create" ? "Configurá medios, alcance, zonas y monto mínimo para la regla automática." : getShippingMethodsLabel(shippingDiscount!, shippingMethodOptions)} tag="Envío gratis" backLink={{ href: "/admin/descuentos/envio-gratis", label: "Volver a envío gratis", onNavigate: interceptNavigation }}>
        <CommerceSourceBadge source={source} />
        {shippingDiscount ? <DiscountStatusBadge status={shippingDiscount.status} /> : null}
        {shippingDiscount ? <Button disabled={status === "loading"} variant="secondary" size="sm" onClick={shippingDiscount.status === "active" ? () => { clearError(); setDeactivateOpen(true); } : () => void activate()}>{shippingDiscount.status === "active" ? <PowerOff aria-hidden size={16} /> : <Power aria-hidden size={16} />}{shippingDiscount.status === "active" ? "Desactivar" : "Activar"}</Button> : null}
        {shippingDiscount ? <Button disabled={status === "loading"} variant="secondary" size="sm" onClick={() => { clearError(); setDeleteOpen(true); }}><Trash2 aria-hidden size={16} className="text-sale" />Eliminar</Button> : null}
      </AdminPageHeader>
      {status === "loading" ? <CommerceMutationStatus /> : null}
      {error ? <CommerceErrorBanner error={error} onRetry={() => void load()} /> : null}
      <ShippingDiscountForm mode={mode} shippingDiscount={shippingDiscount} categoryOptions={categoryOptions} shippingMethodOptions={shippingMethodOptions} zoneOptions={zoneOptions} onDirtyChange={setFormDirty} interceptNavigation={interceptNavigation} />
      <DeleteDiscountModal error={error} open={deleteOpen} title="¿Eliminar este envío gratis?" message="Recordá que podés desactivar el envío gratis sin eliminar esta configuración. Al eliminar, no podrás deshacer esta acción." confirmLabel="Eliminar" onClose={() => setDeleteOpen(false)} onConfirm={confirmDelete} />
      <DeleteDiscountModal error={error} open={deactivateOpen} title="¿Desactivar este envío gratis?" message="Al hacerlo, este descuento de envío dejará de estar disponible en la tienda." confirmLabel="Desactivar" onClose={() => setDeactivateOpen(false)} onConfirm={confirmDeactivate} />
      {discardModal}
    </div>
  );
}
