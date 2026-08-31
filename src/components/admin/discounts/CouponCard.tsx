"use client";

import { Power, PowerOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { DiscountStatusBadge } from "@/components/admin/discounts/DiscountStatusBadge";
import { getCouponDiscountLabel, getCouponLimitsLabel, getCouponUsageLabel, getCouponValidityLabel } from "@/components/admin/discounts/discount-utils";
import type { Coupon } from "@/lib/data/admin/discounts/types";

type CouponCardProps = {
  coupon: Coupon;
  disabled?: boolean;
  onDelete: (coupon: Coupon) => void;
  onToggle: (coupon: Coupon) => void | Promise<void>;
};

export function CouponCard({ coupon, disabled = false, onDelete, onToggle }: CouponCardProps) {
  return (
    <article className="w-full max-w-full min-w-0 overflow-hidden rounded-3xl border border-border bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <Link className="block truncate text-base font-semibold text-accent hover:text-accent-hover" href={`/admin/descuentos/cupones/${coupon.id}`}>{coupon.code}</Link>
          <p className="mt-1 text-sm text-text-muted">{getCouponDiscountLabel(coupon)} · {coupon.discountType === "free_shipping" || coupon.includeShippingCost ? "Envío incluido" : "Sin envío"}</p>
        </div>
        <DiscountStatusBadge status={coupon.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="min-w-0"><dt className="text-xs text-text-muted">Vigencia</dt><dd className="truncate font-medium text-text">{getCouponValidityLabel(coupon)}</dd></div>
        <div className="min-w-0"><dt className="text-xs text-text-muted">Usos</dt><dd className="truncate font-medium text-text">{getCouponUsageLabel(coupon)}</dd></div>
        <div className="min-w-0"><dt className="text-xs text-text-muted">Límites</dt><dd className="truncate font-medium text-text">{getCouponLimitsLabel(coupon)}</dd></div>
      </dl>
      <div className="mt-4 flex justify-end gap-2">
         <Button disabled={disabled} size="icon" variant="ghost" aria-label={coupon.status === "active" ? "Desactivar cupón" : "Activar cupón"} onClick={() => void onToggle(coupon)}>{coupon.status === "active" ? <PowerOff aria-hidden size={18} /> : <Power aria-hidden size={18} />}</Button>
         <Button disabled={disabled} size="icon" variant="ghost" aria-label="Eliminar cupón" onClick={() => onDelete(coupon)}><Trash2 aria-hidden size={18} className="text-sale" /></Button>
      </div>
    </article>
  );
}
