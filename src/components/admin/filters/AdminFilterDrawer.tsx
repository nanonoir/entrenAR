"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";

type AdminFilterDrawerProps = {
  children: ReactNode;
  open: boolean;
  title?: string;
  applyLabel?: string;
  clearLabel?: string;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
};

export function AdminFilterDrawer({
  children,
  open,
  title = "Filtrado por",
  applyLabel = "Filtrar",
  clearLabel = "Borrar filtros",
  onApply,
  onClear,
  onClose,
}: AdminFilterDrawerProps) {
  return (
    <Drawer open={open} title={title} onClose={onClose}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-surface p-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClear}>
            {clearLabel}
          </Button>
          <Button onClick={onApply}>{applyLabel}</Button>
        </div>
      </div>
    </Drawer>
  );
}
