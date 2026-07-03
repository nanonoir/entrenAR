"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { scrollToFirstError } from "@/components/admin/utils/scroll-to-error";
import type { Customer } from "@/lib/data/admin/customers/types";
import { useAdminToastStore } from "@/stores/admin-toast-store";

const ADMIN_EMAIL = "admin@entrenar.com";
const emailMessageSchema = z.object({
  bcc: z.boolean(),
  message: z.string().trim().min(5, "Ingresá un mensaje válido"),
  subject: z.string().trim().min(3, "Ingresá un asunto válido"),
});

type EmailMessageInput = z.input<typeof emailMessageSchema>;
type EmailMessageValues = z.infer<typeof emailMessageSchema>;

const defaultValues: EmailMessageInput = { bcc: false, message: "", subject: "" };

export function CustomerEmailModal({ customer, onClose, open }: { customer: Customer | null; onClose: () => void; open: boolean }) {
  const addToast = useAdminToastStore((state) => state.addToast);
  const [bounceError, setBounceError] = useState<string | null>(null);
  const form = useForm<EmailMessageInput, unknown, EmailMessageValues>({
    defaultValues,
    mode: "onBlur",
    resolver: zodResolver(emailMessageSchema),
  });
  const { errors, isSubmitted, isSubmitting } = form.formState;

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
  }, [form, open]);

  function resetAndClose() {
    form.reset(defaultValues);
    setBounceError(null);
    onClose();
  }

  function handleSubmit(values: EmailMessageValues) {
    setBounceError(null);
    if (!customer) return;
    if (customer.email.toLowerCase() === "bounce@mock.com") {
      setBounceError("El e-mail rebotó en la simulación controlada.");
      addToast("El e-mail rebotó. Revisá el destinatario.", "error");
      return;
    }
    void values;
    addToast("Email enviado correctamente.");
    resetAndClose();
  }

  function handleInvalidSubmit(formErrors: typeof errors) {
    addToast("Debes completar asunto y mensaje correctamente.", "error");
    scrollToFirstError(formErrors);
  }

  const showGlobalError = (isSubmitted && Object.keys(errors).length > 0) || bounceError;

  return (
    <Modal open={open} onClose={resetAndClose} title="Enviar un email" className="max-w-xl">
      <form className="grid gap-5 p-5" noValidate onSubmit={form.handleSubmit(handleSubmit, handleInvalidSubmit)}>
        <div><h2 className="text-lg font-semibold text-zinc-950">Enviar un email</h2><p className="mt-1 text-sm text-zinc-500">El envío es una simulación local.</p></div>
        {showGlobalError ? <div role="alert" className="rounded-2xl border border-sale/20 bg-red-50 px-4 py-3 text-sm font-medium text-sale">{bounceError ?? "Debes completar asunto y mensaje correctamente."}</div> : null}
        <Input id="email-to" label="Para" value={customer?.email ?? ""} readOnly helperText="Destinatario del cliente." />
        <Input id="email-from" label="De" value={ADMIN_EMAIL} readOnly helperText="Cuenta de la tienda." />
        <Input id="email-subject" label="Asunto *" helperText="Mínimo 3 caracteres." errorText={errors.subject?.message} {...form.register("subject")} />
        <Textarea id="email-message" label="Mensaje *" helperText="Mínimo 5 caracteres." errorText={errors.message?.message} {...form.register("message")} />
        <Checkbox id="email-bcc" label={`Enviar a ${ADMIN_EMAIL} como copia oculta`} {...form.register("bcc")} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={resetAndClose}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>Enviar</Button></div>
      </form>
    </Modal>
  );
}
