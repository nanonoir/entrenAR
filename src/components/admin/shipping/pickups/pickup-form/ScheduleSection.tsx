"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { PickupInput, PickupSection } from "@/components/admin/shipping/pickups/pickup-form/PickupFormField";
import type { PickupPointFormInput } from "@/schemas/admin/shipping-schemas";

const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function ScheduleSection() {
  const { control, formState: { errors }, register } = useFormContext<PickupPointFormInput>();
  const { append, fields, remove } = useFieldArray({ control, name: "schedule" });
  return <PickupSection title="Horarios" description="Definí días activos y franjas sin superposición."><div className="grid gap-3">{fields.map((field, index) => <div key={field.id} className="grid gap-3 rounded-2xl border border-border p-3 md:grid-cols-[1fr_1fr_1fr_auto]"><label className="grid gap-2 text-sm font-medium text-text">Día<select className="h-11 rounded-button border border-border bg-surface px-3 text-base md:text-sm" {...register(`schedule.${index}.day`)}>{days.map((day) => <option key={day} value={day}>{day}</option>)}</select></label><PickupInput name={`schedule.${index}.from`} label="Desde" helperText="Inicio." type="time" /><PickupInput name={`schedule.${index}.to`} label="Hasta" helperText="Cierre." type="time" /><Button className="self-end" type="button" variant="ghost" size="icon" aria-label="Eliminar franja" onClick={() => remove(index)}><Trash2 aria-hidden size={16} /></Button></div>)}{typeof errors.schedule?.message === "string" ? <p className="text-xs font-medium text-sale">{errors.schedule.message}</p> : null}<Button type="button" variant="secondary" size="sm" className="w-fit" onClick={() => append({ id: `schedule-${Date.now()}`, day: "Lunes", from: "09:00", to: "18:00" })}><Plus aria-hidden size={16} />Agregar franja</Button></div></PickupSection>;
}
