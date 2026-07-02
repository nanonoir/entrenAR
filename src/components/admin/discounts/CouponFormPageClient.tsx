"use client";

import { useRouter } from "next/navigation";
import { Power, PowerOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { AdminPageHeader } from "@/components/admin/layout/AdminPageHeader";
import { CouponForm } from "@/components/admin/discounts/CouponForm";
import { CouponHistory } from "@/components/admin/discounts/CouponHistory";
import { DeleteDiscountModal } from "@/components/admin/discounts/DeleteDiscountModal";
import { DiscountStatusBadge } from "@/components/admin/discounts/DiscountStatusBadge";
import { Button } from "@/components/ui/Button";
import type { DiscountSelectOption } from "@/lib/data/admin/discounts/types";
import { useAdminDiscountsStore } from "@/stores/admin-discounts-store";
import { useAdminToastStore } from "@/stores/admin-toast-store";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";

type CouponFormPageClientProps = {
  categoryOptions: DiscountSelectOption[];
  couponId?: string;
  mode: "create" | "edit";
  productOptions: DiscountSelectOption[];
};

export function CouponFormPageClient({ categoryOptions, couponId, mode, productOptions }: CouponFormPageClientProps) {
  const router = useRouter();
  const coupon = useAdminDiscountsStore((state) => couponId ? state.coupons.find((item) => item.id === couponId) : undefined);
  const activateCoupon = useAdminDiscountsStore((state) => state.activateCoupon);
  const deactivateCoupon = useAdminDiscountsStore((state) => state.deactivateCoupon);
  const deleteCoupon = useAdminDiscountsStore((state) => state.deleteCoupon);
  const addToast = useAdminToastStore((state) => state.addToast);
  const [formDirty, setFormDirty] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const { discardModal, interceptNavigation } = useUnsavedChangesGuard({ isDirty: formDirty });

  if (mode === "edit" && !coupon) {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-4 rounded-3xl border border-border bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-text">Cupón no encontrado</h1>
        <p className="text-sm text-text-muted">El cupón pudo haber sido eliminado o no existe en esta sesión.</p>
        <div><Button onClick={() => router.push("/admin/descuentos/cupones")}>Volver a cupones</Button></div>
      </div>
    );
  }

  function activate() {
    if (!coupon) return;
    activateCoupon(coupon.id);
    addToast("Cupón activado correctamente.");
  }

  function confirmDeactivate() {
    if (!coupon) return;
    deactivateCoupon(coupon.id);
    addToast("Cupón desactivado correctamente.");
    setDeactivateOpen(false);
  }

  function confirmDelete() {
    if (!coupon) return;
    deleteCoupon(coupon.id);
    addToast("Cupón eliminado correctamente.");
    router.push("/admin/descuentos/cupones");
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-5 overflow-hidden">
      <AdminPageHeader title={mode === "create" ? "Crear cupón" : coupon?.code ?? "Cupón"} description={mode === "create" ? "Configurá el código, beneficio, alcance y límites del cupón." : coupon?.usageCount ? `${coupon.usageCount} usos registrados` : "Este cupón todavía no fue usado"} tag="Cupones" backLink={{ href: "/admin/descuentos/cupones", label: "Volver a cupones", onNavigate: interceptNavigation }}>
        {coupon ? <DiscountStatusBadge status={coupon.status} /> : null}
        {coupon ? <Button variant="secondary" size="sm" onClick={coupon.status === "active" ? () => setDeactivateOpen(true) : activate}>{coupon.status === "active" ? <PowerOff aria-hidden size={16} /> : <Power aria-hidden size={16} />}{coupon.status === "active" ? "Desactivar" : "Activar"}</Button> : null}
        {coupon ? <Button variant="secondary" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 aria-hidden size={16} className="text-sale" />Eliminar</Button> : null}
      </AdminPageHeader>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <CouponForm mode={mode} coupon={coupon} categoryOptions={categoryOptions} productOptions={productOptions} onDirtyChange={setFormDirty} interceptNavigation={interceptNavigation} />
        {coupon ? <CouponHistory history={coupon.history} /> : null}
      </div>
      <DeleteDiscountModal open={deleteOpen} title="¿Eliminar este cupón?" message="Al hacerlo, perderás toda la información sobre este cupón y no podrás recuperarla." confirmLabel="Eliminar" onClose={() => setDeleteOpen(false)} onConfirm={confirmDelete} />
      <DeleteDiscountModal open={deactivateOpen} title="¿Desactivar este cupón?" message="Al hacerlo, deshabilitás este cupón. Tus clientes no podrán usarlo en la tienda." confirmLabel="Desactivar" onClose={() => setDeactivateOpen(false)} onConfirm={confirmDeactivate} />
      {discardModal}
    </div>
  );
}
