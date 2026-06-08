"use client";

import { CheckCircle2, Mail, Phone, ShoppingBag, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  isValidEmail,
  isValidPhone,
  isValidTextOnly,
  sanitizePhoneInput,
  sanitizeTextInput,
} from "@/lib/checkout-validation";

export interface SupportPayload {
  fullName: string;
  email: string;
  phone: string;
  orderNumber: string;
  message: string;
  hasReceivedOrder?: boolean;
}

type SupportActionFormProps = {
  idPrefix: string;
  messageLabel: string;
  messageHelper: string;
  submitLabel: string;
  successTitle: string;
  successMessage: string;
  includeReceivedCheckbox?: boolean;
  beforeFields?: ReactNode;
};

type SupportForm = {
  fullName: string;
  email: string;
  phone: string;
  orderNumber: string;
  hasReceivedOrder: boolean;
  message: string;
};

type SupportFormErrors = Partial<Record<keyof Omit<SupportForm, "hasReceivedOrder">, string>>;

const initialForm: SupportForm = {
  fullName: "",
  email: "",
  phone: "",
  orderNumber: "",
  hasReceivedOrder: false,
  message: "",
};

export function SupportActionForm({
  beforeFields,
  idPrefix,
  includeReceivedCheckbox = false,
  messageHelper,
  messageLabel,
  submitLabel,
  successMessage,
  successTitle,
}: SupportActionFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<SupportForm>(initialForm);
  const [errors, setErrors] = useState<SupportFormErrors>({});
  const [submittedPayload, setSubmittedPayload] = useState<SupportPayload | null>(null);
  const successOpen = Boolean(submittedPayload);

  function updateField(field: keyof SupportForm, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validateForm() {
    const nextErrors: SupportFormErrors = {};
    const normalizedOrderNumber = form.orderNumber.trim().toUpperCase();

    if (!form.fullName.trim()) {
      nextErrors.fullName = "Ingresá tu nombre y apellido.";
    } else if (!isValidTextOnly(form.fullName)) {
      nextErrors.fullName = "Usá solo letras para el nombre.";
    }

    if (!isValidEmail(form.email)) {
      nextErrors.email = "Ingresá un correo válido.";
    }

    if (!isValidPhone(form.phone)) {
      nextErrors.phone = "Ingresá un teléfono válido con código de área.";
    }

    if (!normalizedOrderNumber) {
      nextErrors.orderNumber = "Ingresá el número de pedido.";
    }

    if (!form.message.trim()) {
      nextErrors.message = "Agregá el detalle de tu solicitud.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmittedPayload({
      fullName: form.fullName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      orderNumber: form.orderNumber.trim().toUpperCase(),
      message: form.message.trim(),
      ...(includeReceivedCheckbox ? { hasReceivedOrder: form.hasReceivedOrder } : {}),
    });
  }

  function handleBackHome() {
    setForm(initialForm);
    setErrors({});
    setSubmittedPayload(null);
    router.push("/");
  }

  return (
    <>
      <form className="grid gap-5 rounded-card border border-border bg-white p-5 shadow-card sm:p-6" onSubmit={handleSubmit}>
        {beforeFields}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            errorText={errors.fullName}
            helperText="Nombre y apellido de quien realizó la compra."
            id={`${idPrefix}-full-name`}
            label="Nombre y apellido*"
            onChange={(event) => updateField("fullName", sanitizeTextInput(event.target.value))}
            trailingIcon={<User aria-hidden size={16} />}
            value={form.fullName}
          />
          <Input
            errorText={errors.email}
            helperText="Usaremos este correo para responder la solicitud."
            id={`${idPrefix}-email`}
            label="Correo electrónico*"
            onChange={(event) => updateField("email", event.target.value)}
            trailingIcon={<Mail aria-hidden size={16} />}
            type="email"
            value={form.email}
          />
          <Input
            errorText={errors.phone}
            helperText="Incluí código de área para que podamos contactarte."
            id={`${idPrefix}-phone`}
            label="Teléfono/Celular*"
            onChange={(event) => updateField("phone", sanitizePhoneInput(event.target.value))}
            trailingIcon={<Phone aria-hidden size={16} />}
            value={form.phone}
          />
          <Input
            errorText={errors.orderNumber}
            helperText="Se normaliza en mayúsculas. No validamos formato en esta etapa."
            id={`${idPrefix}-order-number`}
            label="Número de pedido*"
            onChange={(event) => updateField("orderNumber", event.target.value.toUpperCase())}
            trailingIcon={<ShoppingBag aria-hidden size={16} />}
            value={form.orderNumber}
          />
        </div>

        {includeReceivedCheckbox ? (
          <Checkbox
            checked={form.hasReceivedOrder}
            helperText="Marcá esta opción si el pedido ya fue entregado."
            id={`${idPrefix}-received`}
            label="Ya recibí mi pedido"
            onChange={(event) => updateField("hasReceivedOrder", event.target.checked)}
          />
        ) : null}

        <Textarea
          errorText={errors.message}
          helperText={messageHelper}
          id={`${idPrefix}-message`}
          label={`${messageLabel}*`}
          onChange={(event) => updateField("message", event.target.value)}
          value={form.message}
        />

        <Button className="w-full sm:w-fit" size="lg" type="submit">
          {submitLabel}
        </Button>
      </form>

      {successOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5">
          <div className="absolute inset-0 bg-black/45" />
          <div aria-label={successTitle} aria-modal="true" className="relative w-full max-w-lg rounded-card bg-white shadow-2xl" role="dialog">
            <div className="grid gap-5 p-6 text-center text-text">
              <CheckCircle2 aria-hidden className="mx-auto text-success" size={44} />
              <div className="grid gap-2">
                <h2 className="font-subtitle text-2xl font-semibold uppercase">{successTitle}</h2>
                <p className="text-sm leading-6 text-text-muted">{successMessage}</p>
              </div>
              <Button onClick={handleBackHome} size="lg">
                Volver al inicio
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
