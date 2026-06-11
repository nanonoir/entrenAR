import { AlertCircle, Clock3, Loader2, PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type AdminStateProps = {
  title?: string;
  description?: string;
  className?: string;
};

function StateShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm", className)}>
      {children}
    </div>
  );
}

export function AdminLoadingState({ title = "Cargando datos", description = "Estamos preparando las estadísticas.", className }: AdminStateProps) {
  return (
    <StateShell className={className}>
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-accent" aria-hidden />
      <h3 className="mt-4 text-lg font-semibold text-zinc-950">{title}</h3>
      <p className="mt-2 text-sm text-zinc-500">{description}</p>
    </StateShell>
  );
}

export function AdminEmptyState({ title = "Sin datos", description = "Todavía no hay datos para este período.", className }: AdminStateProps) {
  return (
    <StateShell className={className}>
      <PackageOpen className="mx-auto h-8 w-8 text-zinc-400" aria-hidden />
      <h3 className="mt-4 text-lg font-semibold text-zinc-950">{title}</h3>
      <p className="mt-2 text-sm text-zinc-500">{description}</p>
    </StateShell>
  );
}

export function AdminErrorState({ title = "Error", description = "No pudimos cargar las estadísticas. Intentá nuevamente.", className }: AdminStateProps) {
  return (
    <StateShell className={className}>
      <AlertCircle className="mx-auto h-8 w-8 text-red-500" aria-hidden />
      <h3 className="mt-4 text-lg font-semibold text-zinc-950">{title}</h3>
      <p className="mt-2 text-sm text-zinc-500">{description}</p>
    </StateShell>
  );
}

export function AdminComingSoonState({ title = "Próximamente", description = "Este módulo se integrará en una próxima etapa del CRM.", className }: AdminStateProps) {
  return (
    <StateShell className={className}>
      <Clock3 className="mx-auto h-8 w-8 text-accent" aria-hidden />
      <h3 className="mt-4 text-lg font-semibold text-zinc-950">{title}</h3>
      <p className="mt-2 text-sm text-zinc-500">{description}</p>
    </StateShell>
  );
}
