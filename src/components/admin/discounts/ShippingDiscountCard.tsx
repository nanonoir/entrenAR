"use client";

import { Power, PowerOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { DiscountStatusBadge } from "@/components/admin/discounts/DiscountStatusBadge";
import { formatCurrency, getShippingCategoriesLabel, getShippingMethodsLabel, getShippingZonesLabel } from "@/components/admin/discounts/discount-utils";
import type { DiscountSelectOption, ShippingDiscount } from "@/lib/data/admin/discounts/types";

type ShippingDiscountCardProps = {
  categoryOptions: DiscountSelectOption[];
  shippingDiscount: ShippingDiscount;
  shippingMethodOptions: DiscountSelectOption[];
  zoneOptions: DiscountSelectOption[];
  onDelete: (shippingDiscount: ShippingDiscount) => void;
  onToggle: (shippingDiscount: ShippingDiscount) => void;
};

export function ShippingDiscountCard({ categoryOptions, shippingDiscount, shippingMethodOptions, zoneOptions, onDelete, onToggle }: ShippingDiscountCardProps) {
  return (
    <article className="w-full max-w-full min-w-0 overflow-hidden rounded-3xl border border-border bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <Link className="block truncate text-base font-semibold text-accent hover:text-accent-hover" href={`/admin/descuentos/envio-gratis/${shippingDiscount.id}`}>{getShippingMethodsLabel(shippingDiscount, shippingMethodOptions)}</Link>
          <p className="mt-1 text-sm text-text-muted">Monto mínimo {formatCurrency(shippingDiscount.minimumCartAmount)}</p>
        </div>
        <DiscountStatusBadge status={shippingDiscount.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="min-w-0"><dt className="text-xs text-text-muted">Categorías</dt><dd className="truncate font-medium text-text">{getShippingCategoriesLabel(shippingDiscount, categoryOptions)}</dd></div>
        <div className="min-w-0"><dt className="text-xs text-text-muted">Zonas</dt><dd className="truncate font-medium text-text">{getShippingZonesLabel(shippingDiscount, zoneOptions)}</dd></div>
      </dl>
      <div className="mt-4 flex justify-end gap-2">
        <Button size="icon" variant="ghost" aria-label={shippingDiscount.status === "active" ? "Desactivar envío gratis" : "Activar envío gratis"} onClick={() => onToggle(shippingDiscount)}>{shippingDiscount.status === "active" ? <PowerOff aria-hidden size={18} /> : <Power aria-hidden size={18} />}</Button>
        <Button size="icon" variant="ghost" aria-label="Eliminar envío gratis" onClick={() => onDelete(shippingDiscount)}><Trash2 aria-hidden size={18} className="text-sale" /></Button>
      </div>
    </article>
  );
}
