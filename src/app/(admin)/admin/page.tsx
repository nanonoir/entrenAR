import { AdminCard, AdminCardHeader } from "@/components/admin/ui/AdminCard";
import { AdminLineChart } from "@/components/admin/charts";
import { KpiGrid } from "@/components/admin/stats/KpiGrid";
import { PeriodFilter } from "@/components/admin/stats/PeriodFilter";
import { overviewKpis, visitorBehaviorBlocks } from "@/lib/data/admin/statistics/dashboard";
import { visitSeries } from "@/lib/data/admin/statistics/visits";

export default function AdminPage() {
  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Inicio</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">Visión general</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">Resumen visual del rendimiento comercial de EntrenAR con datos mock.</p>
        </div>
        <PeriodFilter />
      </div>

      <KpiGrid metrics={overviewKpis} />

      <div className="grid gap-4 lg:grid-cols-3">
        {visitorBehaviorBlocks.map((block) => (
          <AdminCard key={block.id}>
            <p className="text-sm font-medium text-zinc-500">{block.title}</p>
            <p className="mt-3 text-3xl font-bold text-zinc-950">{block.value}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">{block.description}</p>
          </AdminCard>
        ))}
      </div>

      <AdminCard>
        <AdminCardHeader title="Visitas a pedidos pagos y carritos" description="Tendencia semanal estática para validar la visualización del dashboard." />
        <AdminLineChart
          data={visitSeries}
          lines={[
            { dataKey: "visitas", name: "Visitas", color: "#39b000" },
            { dataKey: "visitantes", name: "Visitantes únicos", color: "#18181b" },
          ]}
        />
      </AdminCard>
    </div>
  );
}
