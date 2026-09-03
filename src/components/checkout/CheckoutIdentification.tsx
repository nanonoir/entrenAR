"use client";

import { CheckCircle2, IdCard, Mail, Pencil, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { FieldErrors, IdentificationForm } from "@/components/checkout/checkout-form.validators";
import { cn } from "@/lib/utils";

export type CheckoutIdentificationProps = {
  canOpen: boolean;
  completed: boolean;
  errors: FieldErrors<IdentificationForm>;
  form: IdentificationForm;
  isActive: boolean;
  onContinue: () => void;
  onFieldChange: (field: keyof IdentificationForm, value: string) => void;
  onOpen: () => void;
};

export function CheckoutIdentification({
  canOpen,
  completed,
  errors,
  form,
  isActive,
  onContinue,
  onFieldChange,
  onOpen,
}: CheckoutIdentificationProps) {
  const sectionId = "checkout-step-identification";

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
          <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent-hover"><User aria-hidden size={18} /></span>
          <span>
            <span className="block text-xs font-semibold uppercase text-text-muted">Paso 1</span>
            <strong className="font-subtitle text-lg uppercase text-text">Identificación</strong>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Input errorText={errors.email} helperText="Usaremos este correo para enviarte novedades del pedido." id="checkout-email" label="Correo*" onChange={(event) => onFieldChange("email", event.target.value)} trailingIcon={<Mail aria-hidden size={16} />} type="email" value={form.email} />
            <Input errorText={errors.firstName} helperText="Tu nombre legal o de contacto." id="checkout-first-name" label="Nombres*" onChange={(event) => onFieldChange("firstName", event.target.value)} trailingIcon={<User aria-hidden size={16} />} value={form.firstName} />
            <Input errorText={errors.lastName} helperText="Tu apellido." id="checkout-last-name" label="Apellido*" onChange={(event) => onFieldChange("lastName", event.target.value)} trailingIcon={<User aria-hidden size={16} />} value={form.lastName} />
            <Input errorText={errors.dni} helperText="Documento para identificación de la compra." id="checkout-dni" label="DNI*" onChange={(event) => onFieldChange("dni", event.target.value)} trailingIcon={<IdCard aria-hidden size={16} />} value={form.dni} />
            <Input errorText={errors.phone} helperText="Teléfono para coordinación de entrega." id="checkout-phone" label="Teléfono/Celular*" onChange={(event) => onFieldChange("phone", event.target.value)} trailingIcon={<Phone aria-hidden size={16} />} value={form.phone} />
          </div>
          <label className="mt-4 flex items-start gap-3 text-sm text-text-muted">
            <input className="mt-1 accent-accent" type="checkbox" />
            Quiero recibir notificaciones de ofertas y promociones
          </label>
          <Button className="mt-5" onClick={onContinue}>Continuar</Button>
        </div>
      ) : null}
    </article>
  );
}
