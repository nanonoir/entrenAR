"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { DiscardChangesModal } from "@/components/admin/modals/DiscardChangesModal";

type NavigationTarget = string | (() => void);

type UseUnsavedChangesGuardProps = {
  isDirty: boolean;
  onConfirmDiscard?: () => void;
};

export function useUnsavedChangesGuard({ isDirty, onConfirmDiscard }: UseUnsavedChangesGuardProps) {
  const router = useRouter();
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const pendingTargetRef = useRef<NavigationTarget | null>(null);

  useEffect(() => {
    if (!isDirty) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const runTarget = useCallback((target: NavigationTarget) => {
    if (typeof target === "string") {
      router.push(target);
      return;
    }
    target();
  }, [router]);

  const interceptNavigation = useCallback((target: NavigationTarget) => {
    if (!isDirty) {
      runTarget(target);
      return;
    }

    pendingTargetRef.current = target;
    setDiscardDialogOpen(true);
  }, [isDirty, runTarget]);

  const confirmDiscard = useCallback(() => {
    const target = pendingTargetRef.current;
    pendingTargetRef.current = null;
    setDiscardDialogOpen(false);
    onConfirmDiscard?.();
    if (target) runTarget(target);
  }, [onConfirmDiscard, runTarget]);

  const closeDiscardDialog = useCallback(() => {
    pendingTargetRef.current = null;
    setDiscardDialogOpen(false);
  }, []);

  const discardModal = (
    <DiscardChangesModal open={discardDialogOpen} onClose={closeDiscardDialog} onConfirm={confirmDiscard} />
  );

  return { discardModal, interceptNavigation };
}
