"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Loader2 } from "lucide-react";
import type { CommerceStoreError } from "@/stores/admin-commerce-state";

type DeleteDiscountModalProps = {
  confirmLabel: string;
  message: string;
  open: boolean;
  title: string;
  error?: CommerceStoreError | null;
  onClose: () => void;
  onConfirm: () => Promise<boolean | void> | boolean | void;
};

export function DeleteDiscountModal({ confirmLabel, error, message, open, title, onClose, onConfirm }: DeleteDiscountModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleConfirm() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal open={open} title={title} onClose={onClose} className="max-w-md">
      <div className="grid gap-5 p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-sale"><AlertTriangle aria-hidden size={20} /></span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-text-muted">{message}</p>
          </div>
        </div>
        {error ? <div role="alert" className="rounded-2xl border border-sale/20 bg-sale/10 p-3 text-sm font-medium text-sale">{error.message}</div> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button disabled={isSubmitting} variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button className="bg-sale text-white hover:bg-sale/90" disabled={isSubmitting} onClick={handleConfirm}>{isSubmitting ? <><Loader2 aria-hidden className="animate-spin" size={16} />Procesando…</> : confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}
