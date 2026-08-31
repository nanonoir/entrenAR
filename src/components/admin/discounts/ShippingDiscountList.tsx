"use client";

import { Power, PowerOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { DiscountStatusBadge } from "@/components/admin/discounts/DiscountStatusBadge";
import { ShippingDiscountCard } from "@/components/admin/discounts/ShippingDiscountCard";
import { formatCurrency, getShippingCategoriesLabel, getShippingMethodsLabel, getShippingZonesLabel } from "@/components/admin/discounts/discount-utils";
import type { DiscountSelectOption, ShippingDiscount } from "@/lib/data/admin/discounts/types";

type ShippingDiscountListProps = {
  categoryOptions: DiscountSelectOption[];
  disabled?: boolean;
  shippingDiscounts: ShippingDiscount[];
  shippingMethodOptions: DiscountSelectOption[];
  zoneOptions: DiscountSelectOption[];
  onDelete: (shippingDiscount: ShippingDiscount) => void;
  onToggle: (shippingDiscount: ShippingDiscount) => void | Promise<void>;
};

export function ShippingDiscountList({ categoryOptions, disabled = false, shippingDiscounts, shippingMethodOptions, zoneOptions, onDelete, onToggle }: ShippingDiscountListProps) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-3xl border border-border bg-white shadow-sm xl:block">
        <table className="w-full table-fixed">
          <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-3">Medio de envío</th>
              <th className="w-36 px-4 py-3">Precio mínimo</th>
              <th className="px-4 py-3">Categorías</th>
              <th className="px-4 py-3">Zonas de envío</th>
              <th className="w-32 px-4 py-3">Estado</th>
              <th className="w-28 px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {shippingDiscounts.map((shippingDiscount) => (
              <tr key={shippingDiscount.id} className="align-middle">
                <td className="min-w-0 px-4 py-4"><Link href={`/admin/descuentos/envio-gratis/${shippingDiscount.id}`} className="block truncate font-semibold text-accent hover:text-accent-hover">{getShippingMethodsLabel(shippingDiscount, shippingMethodOptions)}</Link></td>
                <td className="px-4 py-4 font-medium text-text">{formatCurrency(shippingDiscount.minimumCartAmount)}</td>
                <td className="min-w-0 px-4 py-4"><span className="block truncate text-text-muted">{getShippingCategoriesLabel(shippingDiscount, categoryOptions)}</span></td>
                <td className="min-w-0 px-4 py-4"><span className="block truncate text-text-muted">{getShippingZonesLabel(shippingDiscount, zoneOptions)}</span></td>
                <td className="px-4 py-4"><DiscountStatusBadge status={shippingDiscount.status} /></td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-1">
                     <Button disabled={disabled} size="icon" variant="ghost" aria-label={shippingDiscount.status === "active" ? "Desactivar envío gratis" : "Activar envío gratis"} onClick={() => void onToggle(shippingDiscount)}>{shippingDiscount.status === "active" ? <PowerOff aria-hidden size={17} /> : <Power aria-hidden size={17} />}</Button>
                     <Button disabled={disabled} size="icon" variant="ghost" aria-label="Eliminar envío gratis" onClick={() => onDelete(shippingDiscount)}><Trash2 aria-hidden size={17} className="text-sale" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
       <div className="grid min-w-0 gap-3 xl:hidden">{shippingDiscounts.map((shippingDiscount) => <ShippingDiscountCard disabled={disabled} key={shippingDiscount.id} shippingDiscount={shippingDiscount} categoryOptions={categoryOptions} shippingMethodOptions={shippingMethodOptions} zoneOptions={zoneOptions} onDelete={onDelete} onToggle={onToggle} />)}</div>
    </>
  );
}
