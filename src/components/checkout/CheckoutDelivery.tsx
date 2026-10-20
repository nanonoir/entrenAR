"use client";

import { CheckCircle2, Pencil, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DeliveryOptions } from "@/components/checkout/DeliveryOptions";
import type {
  DeliveryErrors,
  DeliveryForm,
  DeliveryMethod,
} from "@/components/checkout/checkout-form.validators";
import type { CheckoutLocality } from "@/lib/data/locations/localities";
import { cn } from "@/lib/utils";

export type CheckoutDeliveryProps = {
  canOpen: boolean;
  completed: boolean;
  errors: DeliveryErrors;
  form: DeliveryForm;
  isActive: boolean;
  onBlurField: (field: keyof DeliveryForm) => void;
  onContinue: () => void;
  onFieldChange: (field: keyof DeliveryForm, value: string) => void;
  onModeChange: (mode: DeliveryForm["localityMode"]) => void;
  onOpen: () => void;
  onSelectLocality: (locality: CheckoutLocality) => void;
  onSelectMethod: (method: DeliveryMethod) => void;
  onSelectPickupPoint: (id: string) => void;
  onSelectProvince: (provinceId: string) => void;
  onSelectShipping: (selection: { id: string; providerId: string }) => void;
  selectedMethod: DeliveryMethod;
  selectedPickupPointId: string | null;
  selectedShippingId: string | null;
};

export function CheckoutDelivery({
  canOpen,
  completed,
  errors,
  form,
  isActive,
  onBlurField,
  onContinue,
  onFieldChange,
  onModeChange,
  onOpen,
  onSelectLocality,
  onSelectMethod,
  onSelectPickupPoint,
  onSelectProvince,
  onSelectShipping,
  selectedMethod,
  selectedPickupPointId,
  selectedShippingId,
}: CheckoutDeliveryProps) {
  const sectionId = "checkout-step-delivery";

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
          <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent-hover"><Truck aria-hidden size={18} /></span>
          <span>
            <span className="block text-xs font-semibold uppercase text-text-muted">Paso 2</span>
            <strong className="font-subtitle text-lg uppercase text-text">Entrega</strong>
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
          <DeliveryOptions
            errors={errors}
            form={form}
            onBlurField={onBlurField}
            onFieldChange={onFieldChange}
            onModeChange={onModeChange}
            onSelectLocality={onSelectLocality}
            onSelectMethod={onSelectMethod}
            onSelectPickupPoint={onSelectPickupPoint}
            onSelectProvince={onSelectProvince}
            onSelectShipping={onSelectShipping}
            selectedMethod={selectedMethod}
            selectedPickupPointId={selectedPickupPointId}
            selectedShippingId={selectedShippingId}
          />
          <Button className="mt-5" onClick={onContinue}>Continuar</Button>
        </div>
      ) : null}
    </article>
  );
}
