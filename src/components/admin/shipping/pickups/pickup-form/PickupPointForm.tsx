"use client";

import { AlertTriangle } from "lucide-react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { AddressSection } from "@/components/admin/shipping/pickups/pickup-form/AddressSection";
import { ScheduleSection } from "@/components/admin/shipping/pickups/pickup-form/ScheduleSection";
import { CoverageCostSection } from "@/components/admin/shipping/pickups/pickup-form/CoverageCostSection";
import { pickupPointFormSchema, type PickupPointFormInput, type PickupPointFormValues } from "@/schemas/admin/shipping-schemas";
import type { PickupPoint } from "@/lib/data/admin/shipping/shipping-config";

type PickupPointFormProps = { pickupPoint: PickupPoint; onSubmit: (values: PickupPointFormValues) => void };

function toInput(point: PickupPoint): PickupPointFormInput {
  return { ...point, preparationHours: String(point.preparationHours), fixedCost: point.fixedCost ? String(point.fixedCost) : "", schedule: point.schedule.length ? point.schedule : [{ id: "schedule-default", day: "Lunes", from: "09:00", to: "18:00" }] };
}

export function PickupPointForm({ onSubmit, pickupPoint }: PickupPointFormProps) {
  const methods = useForm<PickupPointFormInput, unknown, PickupPointFormValues>({ resolver: zodResolver(pickupPointFormSchema), defaultValues: toInput(pickupPoint), mode: "onBlur" });
  const { formState: { errors, isSubmitting }, handleSubmit, setValue } = methods;
  function submit(status: "configured_inactive" | "active") {
    setValue("status", status, { shouldDirty: true, shouldValidate: true });
    void handleSubmit(onSubmit, () => document.getElementById("pickup-form-error")?.scrollIntoView({ behavior: "smooth", block: "center" }))();
  }
  return <FormProvider {...methods}><form className="grid gap-5" noValidate onSubmit={(event) => event.preventDefault()}>{Object.keys(errors).length ? <div id="pickup-form-error" role="alert" className="flex items-start gap-2 rounded-2xl border border-sale/30 bg-white p-3 text-sm font-medium text-sale"><AlertTriangle aria-hidden className="mt-0.5 shrink-0" size={16} />Revisá los campos marcados antes de guardar.</div> : null}<AddressSection /><ScheduleSection /><CoverageCostSection /><div className="flex flex-col-reverse gap-2 pb-4 sm:flex-row sm:justify-end"><LinkButton href="/admin/envios/medios-de-envio" variant="secondary">Cancelar</LinkButton><Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => submit("configured_inactive")}>Guardar configuración</Button><Button type="button" disabled={isSubmitting} onClick={() => submit("active")}>Guardar y activar</Button></div></form></FormProvider>;
}
