"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { usePresenceTransition } from "@/hooks/usePresenceTransition";
import { cn } from "@/lib/utils";

type DrawerProps = {
  open: boolean;
  title: string;
  side?: "left" | "right";
  children: ReactNode;
  onClose: () => void;
  className?: string;
};

const DRAWER_ANIMATION_MS = 240;

export function Drawer({ open, title, side = "right", children, onClose, className }: DrawerProps) {
  const { isVisible, shouldRender } = usePresenceTransition({
    durationMs: DRAWER_ANIMATION_MS,
    open,
  });

  if (!shouldRender) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button
        className={cn(
          "absolute inset-0 bg-black/45 transition-opacity duration-200",
          isVisible ? "opacity-100" : "opacity-0",
        )}
        aria-label="Cerrar panel"
        onClick={onClose}
        type="button"
      />
      <aside
        className={cn(
          "absolute top-0 flex h-full w-full max-w-md flex-col bg-surface shadow-2xl transition-transform duration-[240ms] ease-out",
          side === "right" ? "right-0" : "left-0",
          isVisible
            ? "translate-x-0"
            : side === "right"
              ? "translate-x-full"
              : "-translate-x-full",
          className,
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <h2 className="font-subtitle text-lg font-semibold uppercase">{title}</h2>
          <Button aria-label="Cerrar" onClick={onClose} size="icon" variant="ghost">
            <X aria-hidden size={20} />
          </Button>
        </div>
        {children}
      </aside>
    </div>
  );
}
