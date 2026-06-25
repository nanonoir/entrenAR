"use client";

import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

type DeactivateModalProps = {
  open: boolean;
  providerName?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeactivateModal({ onClose, onConfirm, open, providerName }: DeactivateModalProps) {
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
        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={onClose} type="button" variant="secondary">Cancelar</Button>
          <Button onClick={onConfirm} type="button" variant="danger">Desactivar</Button>
        </div>
      </div>
    </Modal>
  );
}
