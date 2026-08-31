"use client";

import { useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { FormProvider, useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { FormActions } from "@/components/admin/form-actions/FormActions";
import { scrollToFirstError } from "@/components/admin/utils/scroll-to-error";
import { applyCommerceFieldIssues, focusFirstCommerceError } from "@/components/admin/ui/CommerceFieldIssues";
import { AddressSection } from "@/components/admin/shipping/pickups/pickup-form/AddressSection";
import { ScheduleSection } from "@/components/admin/shipping/pickups/pickup-form/ScheduleSection";
import { CoverageCostSection } from "@/components/admin/shipping/pickups/pickup-form/CoverageCostSection";
import { pickupPointFormSchema, type PickupPointFormInput, type PickupPointFormValues } from "@/schemas/admin/shipping-schemas";
import type { PickupPoint } from "@/lib/data/admin/shipping/shipping-config";
import { useAdminShippingStore } from "@/stores/admin-shipping-store";

type PickupPointFormProps = { pickupPoint: PickupPoint; interceptNavigation: (href: string) => void; onDirtyChange?: (isDirty: boolean) => void; onSubmit: (values: PickupPointFormValues) => Promise<boolean | void> | boolean | void };

const pickupDayLabels: Record<string, string> = {
  friday: "Viernes",
  lunes: "Lunes",
  monday: "Lunes",
  martes: "Martes",
  miércoles: "Miércoles",
  miercoles: "Miércoles",
  jueves: "Jueves",
  sábado: "Sábado",
  sabado: "Sábado",
  domingo: "Domingo",
  saturday: "Sábado",
  sunday: "Domingo",
  thursday: "Jueves",
  tuesday: "Martes",
  wednesday: "Miércoles",
};

function toInput(point: PickupPoint): PickupPointFormInput {
  return { ...point, preparationHours: String(point.preparationHours), fixedCost: point.fixedCost ? String(point.fixedCost) : "", schedule: point.schedule.length ? point.schedule.map((range) => ({ ...range, day: pickupDayLabels[range.day.toLocaleLowerCase()] ?? range.day })) : [{ id: "schedule-default", day: "Lunes", from: "09:00", to: "18:00" }] };
}

export function PickupPointForm({ interceptNavigation, onDirtyChange, onSubmit, pickupPoint }: PickupPointFormProps) {
  const clearError = useAdminShippingStore((state) => state.clearError);
  const apiError = useAdminShippingStore((state) => state.error);
  const methods = useForm<PickupPointFormInput, unknown, PickupPointFormValues>({ resolver: zodResolver(pickupPointFormSchema), defaultValues: toInput(pickupPoint), mode: "onBlur" });
  const { formState: { errors, isDirty, isSubmitting }, handleSubmit, setError, setValue } = methods;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!apiError) return;

    const firstField = applyCommerceFieldIssues(apiError.issues, resolvePickupField, setError);
    if (!firstField) return;

    const frame = window.requestAnimationFrame(focusFirstCommerceError);
    return () => window.cancelAnimationFrame(frame);
  }, [apiError, setError]);

  function submit(status: "configured_inactive" | "active") {
    clearError();
    setValue("status", status, { shouldDirty: true, shouldValidate: true });
    void handleSubmit(onSubmit, (errors) => scrollToFirstError(errors))();
  }
  return <FormProvider {...methods}><form className="grid gap-5" noValidate onSubmit={(event) => event.preventDefault()}>{Object.keys(errors).length || apiError ? <div id="pickup-form-error" role="alert" className="flex items-start gap-2 rounded-2xl border border-sale/30 bg-white p-3 text-sm font-medium text-sale"><AlertTriangle aria-hidden className="mt-0.5 shrink-0" size={16} /><span>{apiError?.message ?? "Revisá los campos marcados antes de guardar."}</span></div> : null}<AddressSection /><ScheduleSection /><CoverageCostSection /><FormActions><Button type="button" variant="secondary" onClick={() => interceptNavigation("/admin/envios/medios-de-envio")}>Cancelar</Button><Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => submit("configured_inactive")}>{isSubmitting ? <><Loader2 aria-hidden className="animate-spin" size={16} />Guardando…</> : "Guardar configuración"}</Button><Button type="button" disabled={isSubmitting} onClick={() => submit("active")}>{isSubmitting ? <><Loader2 aria-hidden className="animate-spin" size={16} />Guardando…</> : "Guardar y activar"}</Button></FormActions></form></FormProvider>;
}

const PICKUP_FIELD = {
  ADDRESS_CITY: "address.city",
  ADDRESS_NUMBER: "address.number",
  ADDRESS_POSTAL_CODE: "address.postalCode",
  ADDRESS_PROVINCE: "address.province",
  ADDRESS_STREET: "address.street",
  CONTACT_NAME: "contactName",
  CONTACT_PHONE: "contactPhone",
  COST_TYPE: "costType",
  COVERAGE_TYPE: "coverageType",
  FIXED_COST: "fixedCost",
  IS_MAIN: "isMain",
  NAME: "name",
  PREPARATION_HOURS: "preparationHours",
  PROVINCES: "provinces",
  SCHEDULE: "schedule",
  STATUS: "status",
} as const;

type PickupField = (typeof PICKUP_FIELD)[keyof typeof PICKUP_FIELD] | `schedule.${number}.day` | `schedule.${number}.from` | `schedule.${number}.to`;

function resolvePickupField(field: string): FieldPath<PickupPointFormInput> | undefined {
  if (Object.values(PICKUP_FIELD).includes(field as (typeof PICKUP_FIELD)[keyof typeof PICKUP_FIELD])) return field as PickupField;
  if (/^schedule\.\d+\.(?:day|from|to)$/.test(field)) return field as PickupField;
  if (/^schedule\.\d+$/.test(field)) return "schedule";
  return undefined;
}
