"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { applyCommerceFieldIssues, focusFirstCommerceError } from "@/components/admin/ui/CommerceFieldIssues";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { scrollToFirstError } from "@/components/admin/utils/scroll-to-error";
import { useAdminToastStore } from "@/stores/admin-toast-store";
import { useAdminPaymentMethodsStore } from "@/stores/admin-payment-methods-store";
import type { BankTransferFormInput, BankTransferFormValues } from "@/schemas/admin/payment-method-schemas";
import { bankTransferSchema, normalizeCbuCvu, normalizeCuitCuil, normalizeNameLike } from "@/schemas/admin/payment-method-schemas";

type BankTransferModalProps = {
  open: boolean;
  initialValues?: BankTransferFormValues;
  onClose: () => void;
  onSubmit: (values: BankTransferFormValues) => Promise<boolean | void> | boolean | void;
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
  const clearError = useAdminPaymentMethodsStore((state) => state.clearError);
  const apiError = useAdminPaymentMethodsStore((state) => state.error);
  const form = useForm<BankTransferFormInput, unknown, BankTransferFormValues>({
    defaultValues: initialValues ?? emptyValues,
    mode: "onBlur",
    resolver: zodResolver(bankTransferSchema),
  });

  const { errors, isSubmitted, isSubmitting } = form.formState;
  const showGlobalError = isSubmitted && Object.keys(errors).length > 0;
  const cbuValue = useWatch({ control: form.control, name: "cbuCvu" });
  const cuitValue = useWatch({ control: form.control, name: "cuitCuil" });
  const holderValue = useWatch({ control: form.control, name: "holderName" });
  const bankValue = useWatch({ control: form.control, name: "bankName" });

  useEffect(() => {
    if (open) {
      form.reset(initialValues ?? emptyValues);
      clearError();
    }
  }, [clearError, form, initialValues, open]);

  useEffect(() => {
    if (!open || !apiError) return;

    const firstField = applyCommerceFieldIssues(apiError.issues, resolveBankField, form.setError);
    if (!firstField) return;

    const frame = window.requestAnimationFrame(focusFirstCommerceError);
    return () => window.cancelAnimationFrame(frame);
  }, [apiError, form.setError, open]);

  function handleInvalidSubmit(formErrors: typeof errors) {
    addToast("Debes completar todos los campos obligatorios correctamente.", "error");
    scrollToFirstError(formErrors);
  }

  async function handleValidSubmit(values: BankTransferFormValues) {
    clearError();
    await onSubmit(values);
  }

  return (
    <Modal className="max-w-2xl" onClose={onClose} open={open} title="Configurar Transferencia Bancaria">
      <form className="grid gap-5 p-5 sm:p-6" onSubmit={form.handleSubmit(handleValidSubmit, handleInvalidSubmit)}>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Medio de pago</p>
          <h2 className="mt-1 text-2xl font-bold text-text">Transferencia Bancaria</h2>
          <p className="mt-1 text-sm leading-6 text-text-muted">Estos datos se usarán para mostrar instrucciones de pago en checkout.</p>
        </div>

        {showGlobalError ? (
          <div id="bank-transfer-error-summary" role="alert" className="flex gap-2 rounded-2xl border border-sale/20 bg-sale/10 p-3 text-sm font-medium text-sale">
            <AlertTriangle aria-hidden className="shrink-0" size={18} />
            Debes completar todos los campos obligatorios correctamente.
          </div>
        ) : null}
        {apiError ? <div role="alert" className="rounded-2xl border border-sale/20 bg-sale/10 p-3 text-sm font-medium text-sale">{apiError.message}</div> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="bank-cbu-cvu"
            label="CBU/CVU"
            helperText="Ingresá 22 dígitos. Podés escribir espacios o guiones; se guardará sin separadores."
            errorText={errors.cbuCvu?.message}
            inputMode="numeric"
            name="cbuCvu"
            onBlur={() => void form.trigger("cbuCvu")}
            value={cbuValue ?? ""}
            onChange={(event) => form.setValue("cbuCvu", normalizeCbuCvu(event.target.value), { shouldDirty: true, shouldValidate: true })}
          />
          <Input id="bank-alias" label="Alias" helperText="Ejemplo: entrenar.pagos.mp" errorText={errors.alias?.message} {...form.register("alias")} />
          <Input id="bank-holder" label="Titular" helperText="Nombre completo de la cuenta receptora." errorText={errors.holderName?.message} name="holderName" onBlur={() => void form.trigger("holderName")} value={holderValue ?? ""} onChange={(event) => form.setValue("holderName", normalizeNameLike(event.target.value), { shouldDirty: true, shouldValidate: true })} />
          <Input id="bank-cuit" label="CUIT/CUIL" helperText="Escribí solo números; se formatea automáticamente." errorText={errors.cuitCuil?.message} inputMode="numeric" name="cuitCuil" onBlur={() => void form.trigger("cuitCuil")} value={cuitValue ?? ""} onChange={(event) => form.setValue("cuitCuil", normalizeCuitCuil(event.target.value), { shouldDirty: true, shouldValidate: true })} />
          <Input className="sm:col-span-2" id="bank-name" label="Banco o billetera" helperText="Nombre visible para administración interna." errorText={errors.bankName?.message} name="bankName" onBlur={() => void form.trigger("bankName")} value={bankValue ?? ""} onChange={(event) => form.setValue("bankName", normalizeNameLike(event.target.value), { shouldDirty: true, shouldValidate: true })} />
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button disabled={isSubmitting} onClick={onClose} type="button" variant="secondary">Cancelar</Button>
          <Button disabled={isSubmitting} type="submit">Guardar configuración</Button>
        </div>
      </form>
    </Modal>
  );
}

const BANK_FIELD = {
  ALIAS: "alias",
  BANK_NAME: "bankName",
  CBU_CVU: "cbuCvu",
  CUIT_CUIL: "cuitCuil",
  HOLDER_NAME: "holderName",
} as const;

type BankField = (typeof BANK_FIELD)[keyof typeof BANK_FIELD];

function resolveBankField(field: string): BankField | undefined {
  const normalized = field.startsWith("bankConfig.") ? field.slice("bankConfig.".length) : field;
  return Object.values(BANK_FIELD).includes(normalized as BankField) ? normalized as BankField : undefined;
}
