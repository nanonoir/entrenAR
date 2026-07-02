"use client";

import { useState } from "react";
import { Mail, Settings } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { LinkButton } from "@/components/ui/LinkButton";
import { useAdminAbandonedCartsStore } from "@/stores/admin-abandoned-carts-store";
import { cn } from "@/lib/utils";
import type { RecoveryTiming } from "@/lib/data/admin/sales-flow/types";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";

const TIMING_OPTIONS: { value: RecoveryTiming; label: string; helper: string }[] = [
  { value: "6hs", label: "a las 6 horas", helper: "Primer recordatorio rápido para carritos recientes." },
  { value: "24hs", label: "24hs", helper: "Opción recomendada para no saturar al cliente." },
  { value: "3_days", label: "3 días", helper: "Recordatorio suave luego de un fin de semana o pausa." },
  { value: "7_days", label: "7 días", helper: "Seguimiento semanal para compras consideradas." },
  { value: "14_days", label: "14 días", helper: "Último contacto antes de descartar el carrito." },
  { value: "manual", label: "Manual", helper: "No se programa envío automático; el admin decide cuándo contactar." },
];

export function RecoveryConfigModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const config = useAdminAbandonedCartsStore((state) => state.config);
  const updateConfig = useAdminAbandonedCartsStore((state) => state.updateConfig);
  const [timing, setTiming] = useState<RecoveryTiming>(config.timing);
  const [isActive, setIsActive] = useState(config.isActive);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const isDirty = timing !== config.timing || isActive !== config.isActive;
  const { discardModal, interceptNavigation } = useUnsavedChangesGuard({ isDirty });

  function handleClose() {
    setTiming(config.timing);
    setIsActive(config.isActive);
    setSubmitAttempted(false);
    onClose();
  }

  function requestClose() {
    interceptNavigation(handleClose);
  }

  function handleSave() {
    setSubmitAttempted(true);
    if (!timing) return;
    updateConfig({ timing, isActive });
    onClose();
  }

  return (
    <Modal open={open} onClose={requestClose} title="Configuración de recuperación" className="max-w-2xl">
      <div className="grid gap-5 p-5 sm:p-6">
        <div>
          <div className="flex items-center gap-2 text-accent">
            <Settings aria-hidden size={18} />
            <p className="text-sm font-semibold uppercase tracking-[0.2em]">Carritos abandonados</p>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950">Configuración</h2>
          <p className="mt-1 text-sm text-zinc-500">Definí si el recupero será automático o manual. Los cambios quedan disponibles para esta sesión administrativa.</p>
        </div>

        {submitAttempted && !timing && (
          <div role="alert" className="rounded-2xl border border-sale/20 bg-red-50 px-4 py-3 text-sm font-medium text-sale">
            Debes seleccionar un tiempo de envío para guardar la configuración.
          </div>
        )}

        <Checkbox
          id="recovery-active"
          label="Activar envío automático"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
        />

        <fieldset className="grid gap-3">
          <legend className="text-sm font-semibold text-zinc-900">Tiempo de envío *</legend>
          <p className="text-xs text-zinc-500">Elegí cuándo se prepara el mensaje de recuperación después de abandonar el carrito.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {TIMING_OPTIONS.map((option) => {
              const checked = timing === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-2xl border bg-white p-3 text-sm transition",
                    checked ? "border-accent bg-accent-soft/60" : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50",
                    submitAttempted && !timing && "border-sale",
                  )}
                >
                  <input
                    type="radio"
                    name="recovery-timing"
                    value={option.value}
                    checked={checked}
                    onChange={() => setTiming(option.value)}
                    aria-describedby={`timing-${option.value}-helper`}
                    aria-invalid={submitAttempted && !timing ? true : undefined}
                    className="mt-1 rounded-full border-zinc-300 text-accent focus:ring-accent"
                  />
                  <span>
                    <span className="block font-semibold text-zinc-900">{option.label}</span>
                    <span id={`timing-${option.value}-helper`} className="mt-0.5 block text-xs text-zinc-500">{option.helper}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <LinkButton href="/admin/ventas/carritos/email" variant="ghost" size="sm" className="w-fit justify-start px-0 text-accent hover:bg-transparent">
          <Mail aria-hidden size={16} />
          Editar mensaje de e-mail
        </LinkButton>

        <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" size="md" onClick={requestClose}>Cancelar</Button>
          <Button variant="primary" size="md" onClick={handleSave}>Guardar configuración</Button>
        </div>
      </div>
      {discardModal}
    </Modal>
  );
}
