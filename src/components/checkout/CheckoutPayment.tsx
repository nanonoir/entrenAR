"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard, Pencil } from "lucide-react";
import { BankTransferPanel } from "@/components/checkout/BankTransferPanel";
import { PaymentOptions } from "@/components/checkout/PaymentOptions";
import { Alert } from "@/components/ui/Alert";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/LinkButton";
import type { CheckoutCompletion } from "@/lib/api/checkout/checkout.repository";
import type { CheckoutPaymentMethodId } from "@/lib/data/checkout";
import { formatCurrency } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export type CheckoutPaymentProps = {
  canOpen: boolean;
  completed: boolean;
  completion: CheckoutCompletion | null;
  isActive: boolean;
  onOpen: () => void;
  onSelectPayment: (id: CheckoutPaymentMethodId) => void;
  onTransferProofChange: (hasProof: boolean) => void;
  selectedPaymentId: CheckoutPaymentMethodId;
};

export function CheckoutPayment({
  canOpen,
  completed,
  completion,
  isActive,
  onOpen,
  onSelectPayment,
  onTransferProofChange,
  selectedPaymentId,
}: CheckoutPaymentProps) {
  const [transferProofFileName, setTransferProofFileName] = useState("");
  const [showTransferPanel, setShowTransferPanel] = useState(false);
  const sectionId = "checkout-step-payment";

  function handleSelectPayment(id: CheckoutPaymentMethodId) {
    setShowTransferPanel(id === "bank-transfer");
    onSelectPayment(id);
  }

  function handleTransferProofFileSelect(fileName: string) {
    setTransferProofFileName(fileName);
    onTransferProofChange(Boolean(fileName));
  }

  if (completion) {
    const completedTotal = completion.total ?? completion.order?.total;

    return (
      <Container className="py-10" size="wide">
        <div className="mx-auto max-w-2xl">
          <Alert title="Compra completada" tone="success">
            <div className="grid gap-2">
              <p>
                Recibimos tu pedido <strong>{completion.number}</strong>.
              </p>
              {completedTotal !== undefined ? <p>Total confirmado: <strong>{formatCurrency(completedTotal)}</strong>.</p> : null}
              <LinkButton className="mt-3 w-fit" href="/" variant="secondary">Seguir comprando</LinkButton>
            </div>
          </Alert>
        </div>
      </Container>
    );
  }

  return (
    <article className={cn("rounded-card border border-border bg-surface shadow-card", !canOpen && "opacity-70")} id={sectionId}>
      <button
        aria-controls={`${sectionId}-content`}
        aria-expanded={isActive}
        className="flex w-full items-center justify-between gap-4 p-5 text-left disabled:cursor-not-allowed"
        disabled={!canOpen}
        onClick={onOpen}
        type="button"
      >
        <span className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent-hover"><CreditCard aria-hidden size={18} /></span>
          <span>
            <span className="block text-xs font-semibold uppercase text-text-muted">Paso 3</span>
            <strong className="font-subtitle text-lg uppercase text-text">Pago</strong>
          </span>
        </span>
        {completed && !isActive ? (
          <span className="inline-flex items-center gap-2 rounded-button border border-border px-3 py-2 font-subtitle text-xs font-semibold uppercase text-text-muted hover:border-accent hover:text-accent">
            Modificar
            <Pencil aria-hidden size={14} />
          </span>
        ) : (
          <CheckCircle2 className={cn(isActive || completed ? "text-accent" : "text-border")} aria-hidden size={20} />
        )}
      </button>
      {isActive ? (
        <div className="border-t border-border p-5" id={`${sectionId}-content`}>
          <PaymentOptions onSelectPayment={handleSelectPayment} selectedPaymentId={selectedPaymentId} />
          <BankTransferPanel
            fileName={transferProofFileName}
            onFileSelect={handleTransferProofFileSelect}
            open={showTransferPanel || selectedPaymentId === "bank-transfer"}
          />
        </div>
      ) : null}
    </article>
  );
}
