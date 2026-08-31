"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAdminPaymentMethodsStore } from "@/stores/admin-payment-methods-store";

type DeactivateModalProps = {
  open: boolean;
  providerName?: string;
  onClose: () => void;
  onConfirm: () => Promise<boolean | void> | boolean | void;
};

export function DeactivateModal({ onClose, onConfirm, open, providerName }: DeactivateModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const clearError = useAdminPaymentMethodsStore((state) => state.clearError);
  const apiError = useAdminPaymentMethodsStore((state) => state.error);

  async function handleConfirm() {
    if (isSubmitting) return;
    clearError();
    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal className="max-w-md" onClose={onClose} open={open} title="Desactivar medio de pago">
      <div className="grid gap-5 p-5 text-center sm:p-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <AlertTriangle aria-hidden size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text">Desactivar {providerName}</h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">El medio de pago dejará de estar disponible. La configuración quedará guardada para una futura reactivación.</p>
        </div>
        {apiError ? <div role="alert" className="rounded-2xl border border-sale/20 bg-sale/10 p-3 text-left text-sm font-medium text-sale">{apiError.message}</div> : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button disabled={isSubmitting} onClick={onClose} type="button" variant="secondary">Cancelar</Button>
          <Button disabled={isSubmitting} onClick={handleConfirm} type="button" variant="danger">{isSubmitting ? "Guardando…" : "Desactivar"}</Button>
        </div>
      </div>
    </Modal>
  );
}
