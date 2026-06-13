import { Button } from "@/components/ui/Button";

type OrderFormHeaderProps = {
  mode: "create" | "edit";
  saleNumber?: string;
  isSubmitting: boolean;
  submitLabel: string;
  onCancel: () => void;
  onSubmitClick: () => void;
};

export function OrderFormHeader({ mode, saleNumber, isSubmitting, submitLabel, onCancel, onSubmitClick }: OrderFormHeaderProps) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Ventas</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950">
          {mode === "create" ? "Nueva orden de compra" : `Editar venta ${saleNumber}`}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" variant="primary" size="sm" disabled={isSubmitting} onClick={onSubmitClick} aria-label={submitLabel}>
          {isSubmitting ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
