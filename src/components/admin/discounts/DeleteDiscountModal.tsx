"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type DeleteDiscountModalProps = {
  confirmLabel: string;
  message: string;
  open: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteDiscountModal({ confirmLabel, message, open, title, onClose, onConfirm }: DeleteDiscountModalProps) {
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
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button className="bg-sale text-white hover:bg-sale/90" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}
