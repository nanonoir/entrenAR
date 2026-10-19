import { AdminComingSoonState } from "@/components/admin/ui/States";

export default function VisitsStatsPage() {
  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Estadísticas</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">Estadísticas › Visitas</h1>
      </div>
      <AdminComingSoonState
        title="Visitas no disponibles"
        description="Todavía no registramos el tráfico de la tienda, por lo que no hay visitas, visitantes únicos, duración ni dispositivos para mostrar. Cuando exista una fuente de datos real, se mostrará acá."
      />
    </div>
  );
}
