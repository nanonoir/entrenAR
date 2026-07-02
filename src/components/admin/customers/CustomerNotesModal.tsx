"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import type { Customer } from "@/lib/data/admin/customers/types";
import { useAdminCustomersStore } from "@/stores/admin-customers-store";

export function CustomerNotesModal({ customer, onClose, open }: { customer: Customer; onClose: () => void; open: boolean }) {
  const updateCustomerNotes = useAdminCustomersStore((state) => state.updateCustomerNotes);
  const [notes, setNotes] = useState(customer.notes ?? "");
  const notesError = notes.length > 500 ? "Las notas no pueden superar los 500 caracteres." : undefined;
  function handleSave() {
    if (notesError) return;
    updateCustomerNotes(customer.id, notes.trim());
    onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title="Editar notas" className="max-w-lg">
      <div className="grid gap-5 p-5"><h2 className="text-lg font-semibold text-zinc-950">Editar notas</h2><Textarea id="customer-notes" label="Notas internas del cliente" value={notes} onChange={(event) => setNotes(event.currentTarget.value)} helperText="Solo visible para administración. Máximo 500 caracteres." errorText={notesError} /><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="button" onClick={handleSave}>Guardar</Button></div></div>
    </Modal>
  );
}
