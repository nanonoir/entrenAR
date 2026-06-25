"use client";

import Image from "next/image";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAdminToastStore } from "@/stores/admin-toast-store";
import { cn } from "@/lib/utils";
import type { PaymentProviderDefinition } from "@/lib/data/admin/payment-methods";

type GatewayModalProps = {
  open: boolean;
  provider: PaymentProviderDefinition | null;
  selectedOptionId?: string;
  onClose: () => void;
  onConfirm: (optionId: string) => void;
};

export function GatewayModal({ onClose, onConfirm, open, provider, selectedOptionId }: GatewayModalProps) {
  const [currentOptionId, setCurrentOptionId] = useState(selectedOptionId ?? "");
  const addToast = useAdminToastStore((state) => state.addToast);

  if (!provider) return null;

  function handleConfirm() {
    if (!currentOptionId) {
      addToast("Debes seleccionar un plazo para activar este medio de pago.", "error");
      return;
    }
    onConfirm(currentOptionId);
  }

  return (
    <Modal className="max-w-2xl" onClose={onClose} open={open} title={`Configurar ${provider.name}`}>
      <div className="grid gap-5 p-5 sm:p-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface p-2">
            <Image alt={`Logo de ${provider.name}`} height={34} src={provider.logoSrc} width={34} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Medio de pago</p>
            <h2 className="truncate text-2xl font-bold text-text">{provider.name}</h2>
          </div>
        </div>

        <fieldset className="grid gap-3">
          <legend className="text-sm font-semibold text-text">Seleccioná un plazo de acreditación</legend>
          {provider.options.map((option) => (
            <label
              className={cn(
                "flex cursor-pointer gap-3 rounded-2xl border border-border p-4 transition hover:border-accent",
                currentOptionId === option.id && "border-accent bg-accent-soft",
              )}
              key={option.id}
            >
              <input
                checked={currentOptionId === option.id}
                className="mt-1 h-4 w-4 shrink-0 accent-accent"
                name="gateway-option"
                onBlur={() => undefined}
                onChange={() => setCurrentOptionId(option.id)}
                type="radio"
              />
              <span className="grid min-w-0 gap-1 text-sm sm:grid-cols-3 sm:gap-3">
                <span className="min-w-0"><strong className="block text-xs uppercase text-text-muted">Recibí en</strong>{option.receiveIn}</span>
                <span className="min-w-0"><strong className="block text-xs uppercase text-text-muted">Comisión</strong>{option.fee}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button onClick={onClose} type="button" variant="secondary">Cancelar</Button>
          <Button onClick={handleConfirm} type="button">Confirmar</Button>
        </div>
      </div>
    </Modal>
  );
}
