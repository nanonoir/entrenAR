"use client";

import { AdminFilterDrawer } from "@/components/admin/filters";
import type { SaleShippingStatus } from "@/lib/data/admin/sales-flow/types";
import { getShippingStatusLabel } from "@/lib/data/admin/sales-flow/helpers";
import { cn } from "@/lib/utils";

export type ShipmentFilters = { statuses: SaleShippingStatus[] };
export const defaultShipmentFilters: ShipmentFilters = { statuses: [] };
const statuses: SaleShippingStatus[] = ["to_pack", "to_ship", "shipped", "delivered", "pickup", "cancelled"];

type ShipmentFilterDrawerProps = {
  draftFilters: ShipmentFilters;
  open: boolean;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
  onDraftChange: (filters: ShipmentFilters) => void;
};

export function ShipmentFilterDrawer({ draftFilters, onApply, onClear, onClose, onDraftChange, open }: ShipmentFilterDrawerProps) {
  function toggleStatus(status: SaleShippingStatus) {
    onDraftChange({ statuses: draftFilters.statuses.includes(status) ? draftFilters.statuses.filter((item) => item !== status) : [...draftFilters.statuses, status] });
  }

  return (
    <AdminFilterDrawer open={open} title="Filtros" onApply={onApply} onClear={onClear} onClose={onClose}>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-semibold text-text">Estado</legend>
        {statuses.map((status) => {
          const selected = draftFilters.statuses.includes(status);

          return (
            <label
              key={status}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm transition",
                selected
                  ? "border-accent bg-accent-soft text-accent-hover"
                  : "border-border bg-white text-text hover:border-accent/50 hover:bg-surface",
              )}
            >
              <span className="min-w-0 truncate">{getShippingStatusLabel(status)}</span>
              <input type="checkbox" checked={selected} onChange={() => toggleStatus(status)} className="size-4 shrink-0 rounded border-border accent-accent focus:ring-2 focus:ring-accent/20" />
            </label>
          );
        })}
      </fieldset>
    </AdminFilterDrawer>
  );
}
