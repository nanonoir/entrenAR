"use client";

import { CheckCircle2, Pencil, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DeliveryOptions } from "@/components/checkout/DeliveryOptions";
import type {
  DeliveryForm,
  DeliveryMethod,
  FieldErrors,
} from "@/components/checkout/checkout-form.validators";
import {
  type CheckoutPickupPoint,
  type CheckoutPostalCodeLocation,
  type CheckoutShippingProvider,
} from "@/lib/data/checkout";
import { cn } from "@/lib/utils";

export type CheckoutDeliveryProps = {
  canOpen: boolean;
  completed: boolean;
  errors: FieldErrors<DeliveryForm>;
  form: DeliveryForm;
  hasFreeShipping: boolean;
  isActive: boolean;
  location: CheckoutPostalCodeLocation | undefined;
  onContinue: () => void;
  onFieldChange: (field: keyof DeliveryForm, value: string) => void;
  onOpen: () => void;
  onSelectMethod: (method: DeliveryMethod) => void;
  onSelectPickupPoint: (point: CheckoutPickupPoint) => void;
  onSelectProvider: (provider: CheckoutShippingProvider) => void;
  selectedMethod: DeliveryMethod;
  selectedPickupPointId: string | null;
  selectedProviderId: string;
};

export function CheckoutDelivery({
  canOpen,
  completed,
  errors,
  form,
  hasFreeShipping,
  isActive,
  location,
  onContinue,
  onFieldChange,
  onOpen,
  onSelectMethod,
  onSelectPickupPoint,
  onSelectProvider,
  selectedMethod,
  selectedPickupPointId,
  selectedProviderId,
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
            hasFreeShipping={hasFreeShipping}
            location={location}
            onFieldChange={onFieldChange}
            onSelectMethod={onSelectMethod}
            onSelectPickupPoint={onSelectPickupPoint}
            onSelectProvider={onSelectProvider}
            selectedMethod={selectedMethod}
            selectedPickupPointId={selectedPickupPointId}
            selectedProviderId={selectedProviderId}
          />
          <Button className="mt-5" onClick={onContinue}>Continuar</Button>
        </div>
      ) : null}
    </article>
  );
}
