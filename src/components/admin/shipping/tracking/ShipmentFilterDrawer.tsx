"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import type { SaleShippingStatus } from "@/lib/data/admin/sales-flow/types";
import { getShippingStatusLabel } from "@/lib/data/admin/sales-flow/helpers";

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
    <Drawer open={open} onClose={onClose} title="Filtros" className="flex flex-col h-full min-h-0">
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <fieldset className="grid gap-3">
            <legend className="text-sm font-semibold uppercase tracking-wide text-text-muted">Estado</legend>
            <div className="grid gap-2">
              {statuses.map((status) => (
                <label key={status} className="flex items-center gap-2 text-sm text-text">
                  <input type="checkbox" checked={draftFilters.statuses.includes(status)} onChange={() => toggleStatus(status)} className="shrink-0" />
                  {getShippingStatusLabel(status)}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="shrink-0 border-t border-border p-4">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" onClick={onClear}><X aria-hidden size={16} />Limpiar</Button>
            <Button type="button" onClick={onApply}>Aplicar</Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
