"use client";

import Image from "next/image";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAdminPaymentMethodsStore } from "@/stores/admin-payment-methods-store";
import { useAdminToastStore } from "@/stores/admin-toast-store";
import { cn } from "@/lib/utils";
import type { PaymentProviderDefinition } from "@/lib/data/admin/payment-methods";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";

type GatewayModalProps = {
  open: boolean;
  provider: PaymentProviderDefinition | null;
  selectedOptionId?: string;
  onClose: () => void;
  onConfirm: (optionId: string) => Promise<boolean | void> | boolean | void;
};

export function GatewayModal({ onClose, onConfirm, open, provider, selectedOptionId }: GatewayModalProps) {
  const [currentOptionId, setCurrentOptionId] = useState(selectedOptionId ?? "");
  const [selectionError, setSelectionError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const clearError = useAdminPaymentMethodsStore((state) => state.clearError);
  const apiError = useAdminPaymentMethodsStore((state) => state.error);
  const addToast = useAdminToastStore((state) => state.addToast);
  const isDirty = currentOptionId !== (selectedOptionId ?? "");
  const { discardModal, interceptNavigation } = useUnsavedChangesGuard({ isDirty });

  if (!provider) return null;

  const apiSelectionError = apiError?.issues.find((issue) => resolveGatewayField(issue.field) === "selectedOptionId")?.message;
  const optionError = selectionError || apiSelectionError;

  async function handleConfirm() {
    if (isSubmitting) return;
    if (!currentOptionId) {
      setSelectionError("Seleccioná un plazo de acreditación para continuar.");
      addToast("Debes seleccionar un plazo para activar este medio de pago.", "error");
      return;
    }
    setSelectionError("");
    clearError();
    setIsSubmitting(true);
    try {
      await onConfirm(currentOptionId);
    } finally {
      setIsSubmitting(false);
    }
  }

  function requestClose() {
    interceptNavigation(onClose);
  }

  return (
    <Modal className="max-w-2xl" onClose={requestClose} open={open} title={`Configurar ${provider.name}`}>
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

         <fieldset className="grid gap-3" aria-invalid={optionError ? true : undefined} aria-describedby={optionError ? "gateway-option-error" : "gateway-option-helper"}>
           <legend className="text-sm font-semibold text-text">Seleccioná un plazo de acreditación</legend>
           <p id="gateway-option-helper" className="text-xs text-text-muted">El plazo define cuándo se acredita el pago en la cuenta de la tienda.</p>
           {optionError ? <p id="gateway-option-error" className="text-xs font-medium text-sale">{optionError}</p> : null}
           {apiError ? <div role="alert" className="rounded-2xl border border-sale/20 bg-sale/10 p-3 text-sm font-medium text-sale">{apiError.message}</div> : null}
          {provider.options.map((option) => (
            <label
              className={cn(
                "flex cursor-pointer gap-3 rounded-2xl border border-border p-4 transition hover:border-accent",
                currentOptionId === option.id && "border-accent bg-accent-soft",
                 optionError && "border-sale",
              )}
              key={option.id}
            >
              <input
                checked={currentOptionId === option.id}
                className="mt-1 h-4 w-4 shrink-0 accent-accent"
                name="gateway-option"
                onBlur={() => undefined}
                 disabled={isSubmitting}
                 onChange={() => { clearError(); setCurrentOptionId(option.id); setSelectionError(""); }}
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
           <Button disabled={isSubmitting} onClick={requestClose} type="button" variant="secondary">Cancelar</Button>
           <Button disabled={isSubmitting} onClick={handleConfirm} type="button">{isSubmitting ? "Guardando…" : "Confirmar"}</Button>
        </div>
      </div>
      {discardModal}
    </Modal>
  );
}

function resolveGatewayField(field: string) {
  return field === "selectedOptionId" ? field : undefined;
}
