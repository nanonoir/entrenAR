import { AdminLineChart } from "@/components/admin/charts";
import { PeriodFilter } from "@/components/admin/stats/PeriodFilter";
import { AdminCard, AdminCardHeader } from "@/components/admin/ui/AdminCard";
import { AdminComingSoonState } from "@/components/admin/ui/States";
import { deviceBreakdown, mostVisitedProducts, visitSeries, visitSummary } from "@/lib/data/admin/visits";

export default function VisitsStatsPage() {
  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <Header />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminCard><Metric label="Visitas totales" value={visitSummary.totalVisits} /></AdminCard>
        <AdminCard><Metric label="Visitantes únicos" value={visitSummary.uniqueVisitors} /></AdminCard>
        <AdminCard><Metric label="Duración promedio" value={visitSummary.averageDuration} /></AdminCard>
        <AdminCard><Metric label="Rebote" value={visitSummary.bounceRate} /></AdminCard>
      </div>

      <AdminCard><AdminCardHeader title="Visitas y visitantes únicos" description="Evolución semanal mock." /><AdminLineChart data={visitSeries} lines={[{ dataKey: "visitas", name: "Visitas", color: "#39b000" }, { dataKey: "visitantes", name: "Visitantes únicos", color: "#18181b" }]} /></AdminCard>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminCard><AdminCardHeader title="Productos más visitados" /><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-zinc-400"><tr><th scope="col" className="py-3">Producto</th><th scope="col">Categoría</th><th scope="col">Visitas</th><th scope="col">Conversión</th></tr></thead><tbody className="divide-y divide-zinc-100">{mostVisitedProducts.map((product) => <tr key={product.id} className="text-zinc-700"><td className="py-3 font-semibold text-zinc-950">{product.producto}</td><td>{product.categoria}</td><td>{product.visitas}</td><td>{product.conversion}</td></tr>)}</tbody></table></div></AdminCard>
        <AdminCard><AdminCardHeader title="Acceso por dispositivo" />
          <div className="grid gap-4">{deviceBreakdown.map((item) => <div key={item.device} className="rounded-2xl bg-zinc-50 p-4"><div className="flex justify-between font-semibold text-zinc-950"><span>{item.device}</span><span>{item.value}%</span></div><p className="mt-2 text-sm text-zinc-500">{item.description}</p></div>)}</div>
        </AdminCard>
      </div>

      <AdminComingSoonState title="Visitas por origen" description="Próximamente: fuentes de tráfico y campañas." />
    </div>
  );
}

function Header() {
  return <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Estadísticas</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">Estadísticas › Visitas</h1></div><PeriodFilter /></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <><p className="text-sm font-medium text-zinc-500">{label}</p><p className="mt-3 text-3xl font-bold text-zinc-950">{value}</p></>;
}
