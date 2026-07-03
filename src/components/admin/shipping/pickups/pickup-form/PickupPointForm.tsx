"use client";

import { useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { FormActions } from "@/components/admin/form-actions/FormActions";
import { scrollToFirstError } from "@/components/admin/utils/scroll-to-error";
import { AddressSection } from "@/components/admin/shipping/pickups/pickup-form/AddressSection";
import { ScheduleSection } from "@/components/admin/shipping/pickups/pickup-form/ScheduleSection";
import { CoverageCostSection } from "@/components/admin/shipping/pickups/pickup-form/CoverageCostSection";
import { pickupPointFormSchema, type PickupPointFormInput, type PickupPointFormValues } from "@/schemas/admin/shipping-schemas";
import type { PickupPoint } from "@/lib/data/admin/shipping/shipping-config";

type PickupPointFormProps = { pickupPoint: PickupPoint; interceptNavigation: (href: string) => void; onDirtyChange?: (isDirty: boolean) => void; onSubmit: (values: PickupPointFormValues) => void };

function toInput(point: PickupPoint): PickupPointFormInput {
  return { ...point, preparationHours: String(point.preparationHours), fixedCost: point.fixedCost ? String(point.fixedCost) : "", schedule: point.schedule.length ? point.schedule : [{ id: "schedule-default", day: "Lunes", from: "09:00", to: "18:00" }] };
}

export function PickupPointForm({ interceptNavigation, onDirtyChange, onSubmit, pickupPoint }: PickupPointFormProps) {
  const methods = useForm<PickupPointFormInput, unknown, PickupPointFormValues>({ resolver: zodResolver(pickupPointFormSchema), defaultValues: toInput(pickupPoint), mode: "onBlur" });
  const { formState: { errors, isDirty, isSubmitting }, handleSubmit, setValue } = methods;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  function submit(status: "configured_inactive" | "active") {
    setValue("status", status, { shouldDirty: true, shouldValidate: true });
    void handleSubmit(onSubmit, (errors) => scrollToFirstError(errors))();
  }
  return <FormProvider {...methods}><form className="grid gap-5" noValidate onSubmit={(event) => event.preventDefault()}>{Object.keys(errors).length ? <div id="pickup-form-error" role="alert" className="flex items-start gap-2 rounded-2xl border border-sale/30 bg-white p-3 text-sm font-medium text-sale"><AlertTriangle aria-hidden className="mt-0.5 shrink-0" size={16} />Revisá los campos marcados antes de guardar.</div> : null}<AddressSection /><ScheduleSection /><CoverageCostSection /><FormActions><Button type="button" variant="secondary" onClick={() => interceptNavigation("/admin/envios/medios-de-envio")}>Cancelar</Button><Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => submit("configured_inactive")}>{isSubmitting ? <><Loader2 aria-hidden className="animate-spin" size={16} />Guardando…</> : "Guardar configuración"}</Button><Button type="button" disabled={isSubmitting} onClick={() => submit("active")}>{isSubmitting ? <><Loader2 aria-hidden className="animate-spin" size={16} />Guardando…</> : "Guardar y activar"}</Button></FormActions></form></FormProvider>;
}
