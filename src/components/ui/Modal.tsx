"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { usePresenceTransition } from "@/hooks/usePresenceTransition";
import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onExited?: () => void;
  className?: string;
  lockBodyScroll?: boolean;
  skipExitAnimation?: boolean;
};

const MODAL_ANIMATION_MS = 200;

export function Modal({
  open,
  title,
  children,
  onClose,
  onExited,
  className,
  lockBodyScroll = true,
  skipExitAnimation = false,
}: ModalProps) {
  const { isVisible, shouldRender } = usePresenceTransition({
    durationMs: MODAL_ANIMATION_MS,
    onExited,
    open,
    skipExitAnimation,
  });

  useLockBodyScroll(lockBodyScroll && shouldRender);

  useEffect(() => {
    if (!shouldRender) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, shouldRender]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5">
      <button
        aria-label="Cerrar modal"
        className={cn(
          "absolute inset-0 bg-black/45 transition-opacity duration-200",
          isVisible ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
        type="button"
      />
      <section
        aria-label={title}
        aria-modal="true"
        className={cn(
          "relative w-full rounded-card outline-none transition duration-200",
          isVisible ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.98] opacity-0",
          className,
        )}
        role="dialog"
      >
        <Button
          aria-label="Cerrar"
          className="absolute right-0 top-0 z-20 -translate-y-1/3 translate-x-1/3 rounded-full border border-accent bg-white text-text shadow-md hover:bg-accent-soft"
          onClick={onClose}
          size="icon"
          variant="ghost"
        >
          <X aria-hidden size={22} />
        </Button>
        <div className="max-h-[calc(100dvh-24px)] overflow-y-auto rounded-card bg-white shadow-2xl sm:max-h-[calc(100dvh-40px)]">
          {children}
        </div>
      </section>
    </div>
  );
}
