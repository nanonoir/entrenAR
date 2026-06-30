"use client";

import { Power, PowerOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CouponCard } from "@/components/admin/discounts/CouponCard";
import { DiscountStatusBadge } from "@/components/admin/discounts/DiscountStatusBadge";
import { getCouponDiscountLabel, getCouponLimitsLabel, getCouponUsageLabel, getCouponValidityLabel } from "@/components/admin/discounts/discount-utils";
import type { Coupon } from "@/lib/data/admin/discounts/types";

type CouponListProps = {
  coupons: Coupon[];
  onDelete: (coupon: Coupon) => void;
  onToggle: (coupon: Coupon) => void;
};

export function CouponList({ coupons, onDelete, onToggle }: CouponListProps) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-3xl border border-border bg-white shadow-sm xl:block">
        <table className="w-full table-fixed">
          <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
            <tr>
              <th className="w-36 px-4 py-3">Código</th>
              <th className="w-32 px-4 py-3">Descuento</th>
              <th className="w-28 px-4 py-3">Envío</th>
              <th className="px-4 py-3">Vigencia</th>
              <th className="w-28 px-4 py-3">Usos</th>
              <th className="w-28 px-4 py-3">Límites</th>
              <th className="w-32 px-4 py-3">Estado</th>
              <th className="w-28 px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {coupons.map((coupon) => (
              <tr key={coupon.id} className="align-middle">
                <td className="min-w-0 px-4 py-4"><Link href={`/admin/descuentos/cupones/${coupon.id}`} className="block truncate font-semibold text-accent hover:text-accent-hover">{coupon.code}</Link></td>
                <td className="px-4 py-4 font-medium text-text">{getCouponDiscountLabel(coupon)}</td>
                <td className="px-4 py-4 text-text-muted">{coupon.discountType === "free_shipping" || coupon.includeShippingCost ? "Incluido" : "No incluido"}</td>
                <td className="min-w-0 px-4 py-4"><span className="block truncate text-text-muted">{getCouponValidityLabel(coupon)}</span></td>
                <td className="px-4 py-4 text-text-muted">{getCouponUsageLabel(coupon)}</td>
                <td className="px-4 py-4 text-text-muted">{getCouponLimitsLabel(coupon)}</td>
                <td className="px-4 py-4"><DiscountStatusBadge status={coupon.status} /></td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" aria-label={coupon.status === "active" ? "Desactivar cupón" : "Activar cupón"} onClick={() => onToggle(coupon)}>{coupon.status === "active" ? <PowerOff aria-hidden size={17} /> : <Power aria-hidden size={17} />}</Button>
                    <Button size="icon" variant="ghost" aria-label="Eliminar cupón" onClick={() => onDelete(coupon)}><Trash2 aria-hidden size={17} className="text-sale" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid min-w-0 gap-3 xl:hidden">{coupons.map((coupon) => <CouponCard key={coupon.id} coupon={coupon} onDelete={onDelete} onToggle={onToggle} />)}</div>
    </>
  );
}
