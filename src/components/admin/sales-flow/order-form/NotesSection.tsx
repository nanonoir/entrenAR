import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { OrderFormInput } from "@/components/admin/sales-flow/OrderFormSchema";
import { Input } from "@/components/ui/Input";

type NotesSectionProps = {
  register: UseFormRegister<OrderFormInput>;
  errors: FieldErrors<OrderFormInput>;
};

export function NotesSection({ register, errors }: NotesSectionProps) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-zinc-950">Notas internas <span className="text-xs font-normal text-zinc-400">(opcional)</span></h2>
      <div className="grid gap-4">
        <Input
          id="source"
          label="Origen de la orden"
          helperText="Ej: Facebook Marketplace, WhatsApp, MercadoLibre."
          {...register("source")}
          errorText={errors.source?.message}
        />
        <label htmlFor="notes" className="grid gap-2 text-sm font-medium text-text">
          <span>Notas</span>
          <textarea id="notes" rows={3} {...register("notes")} aria-describedby="notes-helper" className="w-full rounded-button border border-border bg-surface px-3 py-2.5 text-base outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm" />
          <span id="notes-helper" className="text-xs text-text-muted">Notas internas visibles sólo para el equipo.</span>
        </label>
      </div>
    </section>
  );
}
