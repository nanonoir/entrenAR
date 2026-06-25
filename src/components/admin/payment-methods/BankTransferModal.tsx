"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAdminToastStore } from "@/stores/admin-toast-store";
import type { BankTransferFormInput, BankTransferFormValues } from "@/schemas/admin/payment-method-schemas";
import { bankTransferSchema, normalizeCbuCvu } from "@/schemas/admin/payment-method-schemas";

type BankTransferModalProps = {
  open: boolean;
  initialValues?: BankTransferFormValues;
  onClose: () => void;
  onSubmit: (values: BankTransferFormValues) => void;
};

const emptyValues: BankTransferFormInput = {
  alias: "",
  bankName: "",
  cbuCvu: "",
  cuitCuil: "",
  holderName: "",
};

export function BankTransferModal({ initialValues, onClose, onSubmit, open }: BankTransferModalProps) {
  const addToast = useAdminToastStore((state) => state.addToast);
  const form = useForm<BankTransferFormInput, unknown, BankTransferFormValues>({
    defaultValues: initialValues ?? emptyValues,
    mode: "onBlur",
    resolver: zodResolver(bankTransferSchema),
  });

  const { errors, isSubmitted, isSubmitting } = form.formState;
  const showGlobalError = isSubmitted && Object.keys(errors).length > 0;
  const cbuRegistration = form.register("cbuCvu");

  useEffect(() => {
    if (open) {
      form.reset(initialValues ?? emptyValues);
    }
  }, [form, initialValues, open]);

  function handleInvalidSubmit() {
    addToast("Debes completar todos los campos obligatorios correctamente.", "error");
    document.getElementById("bank-transfer-error-summary")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <Modal className="max-w-2xl" onClose={onClose} open={open} title="Configurar Transferencia Bancaria">
      <form className="grid gap-5 p-5 sm:p-6" onSubmit={form.handleSubmit(onSubmit, handleInvalidSubmit)}>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Medio de pago</p>
          <h2 className="mt-1 text-2xl font-bold text-text">Transferencia Bancaria</h2>
          <p className="mt-1 text-sm leading-6 text-text-muted">Estos datos se usarán para mostrar instrucciones de pago cuando el backend sincronice checkout.</p>
        </div>

        {showGlobalError ? (
          <div id="bank-transfer-error-summary" role="alert" className="flex gap-2 rounded-2xl border border-sale/20 bg-sale/10 p-3 text-sm font-medium text-sale">
            <AlertTriangle aria-hidden className="shrink-0" size={18} />
            Debes completar todos los campos obligatorios correctamente.
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="bank-cbu-cvu"
            label="CBU/CVU"
            helperText="Ingresá 22 dígitos. Podés escribir espacios o guiones; se guardará sin separadores."
            errorText={errors.cbuCvu?.message}
            inputMode="numeric"
            {...cbuRegistration}
            onBlur={(event) => {
              cbuRegistration.onBlur(event);
              form.setValue("cbuCvu", normalizeCbuCvu(event.target.value), { shouldDirty: true, shouldValidate: true });
            }}
          />
          <Input id="bank-alias" label="Alias" helperText="Ejemplo: entrenar.pagos.mp" errorText={errors.alias?.message} {...form.register("alias")} />
          <Input id="bank-holder" label="Titular" helperText="Nombre completo de la cuenta receptora." errorText={errors.holderName?.message} {...form.register("holderName")} />
          <Input id="bank-cuit" label="CUIT/CUIL" helperText="Formato requerido: XX-YYYYYYYYY-Z." errorText={errors.cuitCuil?.message} {...form.register("cuitCuil")} />
          <Input className="sm:col-span-2" id="bank-name" label="Banco o billetera" helperText="Nombre visible para administración interna." errorText={errors.bankName?.message} {...form.register("bankName")} />
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button onClick={onClose} type="button" variant="secondary">Cancelar</Button>
          <Button disabled={isSubmitting} type="submit">Guardar configuración</Button>
        </div>
      </form>
    </Modal>
  );
}
