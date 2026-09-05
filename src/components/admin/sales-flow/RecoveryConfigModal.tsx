"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { scrollToFirstError } from "@/components/admin/utils/scroll-to-error";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { LinkButton } from "@/components/ui/LinkButton";
import { Modal } from "@/components/ui/Modal";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import type { RecoveryTiming } from "@/lib/data/admin/sales-flow/types";
import { useAdminAbandonedCartsStore } from "@/stores/admin-abandoned-carts-store";
import { cn } from "@/lib/utils";

const TIMING_OPTIONS: Array<{ value: RecoveryTiming; label: string; helper: string }> = [
  { value: "6hs", label: "a las 6 horas", helper: "Primer recordatorio rápido para carritos recientes." },
  { value: "24hs", label: "24hs", helper: "Opción recomendada para no saturar al cliente." },
  { value: "3_days", label: "3 días", helper: "Recordatorio suave luego de un fin de semana o pausa." },
  { value: "7_days", label: "7 días", helper: "Seguimiento semanal para compras consideradas." },
  { value: "14_days", label: "14 días", helper: "Último contacto antes de descartar el carrito." },
  { value: "manual", label: "Manual", helper: "No se programa envío automático; el admin decide cuándo contactar." },
];

const recoveryConfigSchema = z.object({
  isActive: z.boolean(),
  timing: z.enum(["6hs", "24hs", "3_days", "7_days", "14_days", "manual"], { error: "Seleccioná un tiempo de envío." }),
});

type RecoveryConfigInput = z.input<typeof recoveryConfigSchema>;
type RecoveryConfigValues = z.infer<typeof recoveryConfigSchema>;

export function RecoveryConfigModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const config = useAdminAbandonedCartsStore((state) => state.config);
  const error = useAdminAbandonedCartsStore((state) => state.error);
  const isMutating = useAdminAbandonedCartsStore((state) => state.isMutating);
  const fetchConfig = useAdminAbandonedCartsStore((state) => state.fetchConfig);
  const updateConfig = useAdminAbandonedCartsStore((state) => state.updateConfig);
  const clearError = useAdminAbandonedCartsStore((state) => state.clearError);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<RecoveryConfigInput, unknown, RecoveryConfigValues>({
    defaultValues: config,
    mode: "onBlur",
    resolver: zodResolver(recoveryConfigSchema),
  });
  const { errors, isDirty, isSubmitted, isSubmitting } = form.formState;
  const timing = useWatch({ control: form.control, name: "timing" });
  const isActive = useWatch({ control: form.control, name: "isActive" });
  const { discardModal, interceptNavigation } = useUnsavedChangesGuard({ isDirty });

  useEffect(() => {
    if (open) void fetchConfig();
  }, [fetchConfig, open]);

  useEffect(() => {
    if (open && !isDirty) form.reset(config);
  }, [config, form, isDirty, open]);

  function handleClose() {
    form.reset(config);
    setSubmitError(null);
    clearError();
    onClose();
  }

  function requestClose() {
    interceptNavigation(handleClose);
  }

  async function handleSave(values: RecoveryConfigValues) {
    setSubmitError(null);
    clearError();
    const result = await updateConfig(values);
    if (!result) {
      setSubmitError("No se pudo guardar la configuración. Intentá nuevamente.");
      return;
    }
    form.reset(result);
    onClose();
  }

  function handleInvalidSubmit(formErrors: typeof errors) {
    setSubmitError("Debes completar la configuración correctamente.");
    scrollToFirstError(formErrors, ["recovery-timing-section"]);
  }

  const globalError = submitError ?? (isSubmitted ? error : null);
  const saving = isSubmitting || isMutating;

  return (
    <Modal open={open} onClose={requestClose} title="Configuración de recuperación" className="max-w-2xl">
      <form className="grid gap-5 p-5 sm:p-6" noValidate onSubmit={form.handleSubmit(handleSave, handleInvalidSubmit)}>
        <div>
          <div className="flex items-center gap-2 text-accent"><Settings aria-hidden size={18} /><p className="text-sm font-semibold uppercase tracking-[0.2em]">Carritos abandonados</p></div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950">Configuración</h2>
          <p className="mt-1 text-sm text-zinc-500">Definí si el recupero será automático o manual. Los cambios quedan disponibles para esta sesión administrativa.</p>
        </div>

        {globalError ? <div role="alert" className="rounded-2xl border border-sale/20 bg-red-50 px-4 py-3 text-sm font-medium text-sale">{globalError}</div> : null}

        <Checkbox id="recovery-active" label="Activar envío automático" helperText="Cuando está activo, se preparan recuperos según el tiempo seleccionado." checked={isActive} {...form.register("isActive")} />

        <fieldset id="recovery-timing-section" className="grid gap-3" aria-invalid={errors.timing ? true : undefined} aria-describedby={errors.timing ? "recovery-timing-error" : "recovery-timing-helper"}>
          <legend className="text-sm font-semibold text-zinc-900">Tiempo de envío *</legend>
          <p id="recovery-timing-helper" className="text-xs text-zinc-500">Elegí cuándo se prepara el mensaje de recuperación después de abandonar el carrito.</p>
          {errors.timing ? <p id="recovery-timing-error" className="text-xs font-medium text-sale">{errors.timing.message}</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {TIMING_OPTIONS.map((option) => {
              const checked = timing === option.value;
              return <label key={option.value} className={cn("flex cursor-pointer gap-3 rounded-2xl border bg-white p-3 text-sm transition", checked ? "border-accent bg-accent-soft/60" : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50", errors.timing && "border-sale")}><input type="radio" value={option.value} checked={checked} aria-describedby={`timing-${option.value}-helper`} className="mt-1 rounded-full border-zinc-300 text-base text-accent focus:ring-accent md:text-sm" {...form.register("timing")} /><span><span className="block font-semibold text-zinc-900">{option.label}</span><span id={`timing-${option.value}-helper`} className="mt-0.5 block text-xs text-zinc-500">{option.helper}</span></span></label>;
            })}
          </div>
        </fieldset>

        <LinkButton href="/admin/ventas/carritos/email" variant="ghost" size="sm" className="w-fit justify-start px-0 text-accent hover:bg-transparent" onClick={(event) => { if (!isDirty) return; event.preventDefault(); interceptNavigation("/admin/ventas/carritos/email"); }}><Mail aria-hidden size={16} />Editar mensaje de e-mail</LinkButton>

        <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:justify-end"><Button variant="ghost" size="md" type="button" onClick={requestClose}>Cancelar</Button><Button variant="primary" size="md" type="submit" disabled={saving} aria-busy={saving}>{saving ? "Guardando…" : "Guardar configuración"}</Button></div>
      </form>
      {discardModal}
    </Modal>
  );
}
