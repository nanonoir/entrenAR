"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { PickupInput, PickupSection } from "@/components/admin/shipping/pickups/pickup-form/PickupFormField";
import type { PickupPointFormInput } from "@/schemas/admin/shipping-schemas";

const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function ScheduleSection() {
  const { control, formState: { errors } } = useFormContext<PickupPointFormInput>();
  const { append, fields, remove } = useFieldArray({ control, name: "schedule" });
  const schedule = useWatch({ control, name: "schedule" }) ?? [];

  function rangesFor(day: string) {
    return fields.map((field, index) => ({ field, index, value: schedule[index] })).filter((item) => item.value?.day === day);
  }

  function toggleDay(day: string, enabled: boolean) {
    if (enabled) {
      append({ id: `schedule-${day}-${fields.length + 1}`, day, from: "09:00", to: "18:00" });
      return;
    }
    rangesFor(day).map((item) => item.index).sort((a, b) => b - a).forEach((index) => remove(index));
  }

  return <PickupSection title="Horarios" description="Activá los días con retiro y agregá una o más franjas para cada uno."><div className="grid gap-3">{days.map((day) => {
    const dayRanges = rangesFor(day);
    const enabled = dayRanges.length > 0;
    return <section key={day} className="grid gap-3 rounded-2xl border border-border p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><label className="flex items-center gap-2 text-sm font-semibold text-text"><input type="checkbox" checked={enabled} onChange={(event) => toggleDay(day, event.target.checked)} className="shrink-0" />{day}</label><Button type="button" variant="secondary" size="sm" className="w-fit" disabled={!enabled} onClick={() => append({ id: `schedule-${day}-${fields.length + 1}`, day, from: "09:00", to: "18:00" })}><Plus aria-hidden size={16} />Agregar franja</Button></div>{enabled ? <div className="grid gap-3">{dayRanges.map(({ field, index }) => <div key={field.id} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><PickupInput name={`schedule.${index}.from`} label="Desde" helperText="Inicio." type="time" /><PickupInput name={`schedule.${index}.to`} label="Hasta" helperText="Cierre." type="time" /><Button className="self-end" type="button" variant="ghost" size="icon" aria-label="Eliminar franja" onClick={() => remove(index)}><Trash2 aria-hidden size={16} /></Button></div>)}</div> : <p className="text-sm text-text-muted">Sin retiros configurados para este día.</p>}</section>;
  })}{typeof errors.schedule?.message === "string" ? <p className="text-xs font-medium text-sale">{errors.schedule.message}</p> : null}</div></PickupSection>;
}
