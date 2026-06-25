"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { Customer } from "@/lib/data/admin/customers/types";
import { useAdminCustomersStore } from "@/stores/admin-customers-store";

export function CustomerAnonymizeModal({ customer, onClose, open }: { customer: Customer; onClose: () => void; open: boolean }) {
  const anonymizeCustomer = useAdminCustomersStore((state) => state.anonymizeCustomer);
  function handleConfirm() {
    anonymizeCustomer(customer.id);
    onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title="Eliminar datos del cliente" className="max-w-lg">
      <div className="grid gap-5 p-5"><div><h2 className="text-lg font-semibold text-zinc-950">Eliminar datos del cliente</h2><p className="mt-2 whitespace-pre-line text-sm text-zinc-600">{`¿Estás seguro de que querés eliminar los datos de este cliente?\n\nEsta acción es irreversible. Se perderán todos los datos personales y de contacto del cliente. Las ventas asociadas se conservarán, pero quedarán anonimizadas.`}</p></div><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="button" variant="danger" onClick={handleConfirm}>Eliminar datos</Button></div></div>
    </Modal>
  );
}
