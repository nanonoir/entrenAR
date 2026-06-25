"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import type { Customer } from "@/lib/data/admin/customers/types";
import { useAdminToastStore } from "@/stores/admin-toast-store";

const ADMIN_EMAIL = "admin@entrenar.com";

export function CustomerEmailModal({ customer, onClose, open }: { customer: Customer | null; onClose: () => void; open: boolean }) {
  const addToast = useAdminToastStore((state) => state.addToast);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [bcc, setBcc] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [bounceError, setBounceError] = useState<string | null>(null);

  function resetAndClose() {
    setSubject("");
    setMessage("");
    setBcc(false);
    setSubmitAttempted(false);
    setBounceError(null);
    onClose();
  }

  function handleSubmit() {
    setSubmitAttempted(true);
    setBounceError(null);
    if (subject.trim().length < 3 || message.trim().length < 5 || !customer) return;
    if (customer.email.toLowerCase() === "bounce@mock.com") {
      setBounceError("El e-mail rebotó en la simulación controlada.");
      addToast("El e-mail rebotó. Revisá el destinatario.", "error");
      return;
    }
    addToast("Email enviado correctamente.");
    resetAndClose();
  }

  return (
    <Modal open={open} onClose={resetAndClose} title="Enviar un email" className="max-w-xl">
      <div className="grid gap-5 p-5">
        <div><h2 className="text-lg font-semibold text-zinc-950">Enviar un email</h2><p className="mt-1 text-sm text-zinc-500">El envío es una simulación local.</p></div>
        {(submitAttempted && (subject.trim().length < 3 || message.trim().length < 5)) || bounceError ? <div role="alert" className="rounded-2xl border border-sale/20 bg-red-50 px-4 py-3 text-sm font-medium text-sale">{bounceError ?? "Debes completar asunto y mensaje correctamente."}</div> : null}
        <Input id="email-to" label="Para" value={customer?.email ?? ""} readOnly helperText="Destinatario del cliente." />
        <Input id="email-from" label="De" value={ADMIN_EMAIL} readOnly helperText="Cuenta de la tienda." />
        <Input id="email-subject" label="Asunto *" value={subject} onChange={(event) => setSubject(event.currentTarget.value)} helperText="Mínimo 3 caracteres." errorText={submitAttempted && subject.trim().length < 3 ? "Ingresá un asunto válido" : undefined} />
        <Textarea id="email-message" label="Mensaje *" value={message} onChange={(event) => setMessage(event.currentTarget.value)} helperText="Mínimo 5 caracteres." errorText={submitAttempted && message.trim().length < 5 ? "Ingresá un mensaje válido" : undefined} />
        <Checkbox id="email-bcc" checked={bcc} onChange={(event) => setBcc(event.currentTarget.checked)} label={`Enviar a ${ADMIN_EMAIL} como copia oculta`} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={resetAndClose}>Cancelar</Button><Button type="button" onClick={handleSubmit}>Enviar</Button></div>
      </div>
    </Modal>
  );
}
