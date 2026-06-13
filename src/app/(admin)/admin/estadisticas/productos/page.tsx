import { AdminLineChart } from "@/components/admin/charts";
import { PeriodFilter } from "@/components/admin/stats/PeriodFilter";
import { AdminCard, AdminCardHeader } from "@/components/admin/ui/AdminCard";
import { inventoryAlerts, productSalesSeries, topProducts } from "@/lib/data/admin/statistics/products";

const formatter = new Intl.NumberFormat("es-AR");
const currencyFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export default function ProductStatsPage() {
  const maxUnits = Math.max(...topProducts.map((product) => product.unidadesVendidas));

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <PageHeader title="Estadísticas › Productos" />

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminCard><Metric label="Unidades vendidas" value={formatter.format(topProducts.reduce((sum, product) => sum + product.unidadesVendidas, 0))} /></AdminCard>
        <AdminCard><Metric label="Ventas brutas por producto" value={currencyFormatter.format(topProducts.reduce((sum, product) => sum + product.ventasBrutas, 0))} /></AdminCard>
        <AdminCard><Metric label="Stock reservado" value={formatter.format(topProducts.reduce((sum, product) => sum + product.stockReservado, 0))} /></AdminCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminCard>
          <AdminCardHeader title="Top 10 productos" description="Productos ordenados por unidades vendidas." />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-400">
                <tr><th scope="col" className="py-3">Producto</th><th scope="col">Categoría</th><th scope="col">Unidades</th><th scope="col">Ventas brutas</th><th scope="col">Stock</th><th scope="col">Reservado</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {topProducts.map((product) => (
                  <tr key={product.id} className="text-zinc-700"><td className="py-3 font-semibold text-zinc-950">{product.producto}</td><td>{product.categoria}</td><td>{product.unidadesVendidas}</td><td>{currencyFormatter.format(product.ventasBrutas)}</td><td>{product.stockActual}</td><td>{product.stockReservado}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>

        <AdminCard>
          <AdminCardHeader title="Ranking visual" description="Barras CSS proporcionales al líder." />
          <div className="grid gap-3">
            {topProducts.slice(0, 10).map((product) => (
              <div key={product.id}>
                <div className="mb-1 flex min-w-0 justify-between gap-3 text-xs font-semibold text-zinc-600"><span className="min-w-0 truncate">{product.producto}</span><span className="shrink-0">{product.unidadesVendidas}</span></div>
                <div className="h-2 rounded-full bg-zinc-100"><div className="h-2 rounded-full bg-accent" style={{ width: `${(product.unidadesVendidas / maxUnits) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </AdminCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <AdminCard>
          <AdminCardHeader title="Unidades y facturación" description="Línea semanal de referencia para productos." />
          <AdminLineChart data={productSalesSeries} lines={[{ dataKey: "unidades", name: "Unidades", color: "#39b000" }, { dataKey: "facturacion", name: "Facturación", color: "#18181b" }]} />
        </AdminCard>

        <AdminCard>
          <AdminCardHeader title="Alertas de inventario" description="Categorías accionables para reposición." />
          <div className="grid gap-4 sm:grid-cols-2">
            {inventoryAlerts.map((group) => (
              <div key={group.id} className="rounded-2xl bg-zinc-50 p-4"><h3 className="font-semibold text-zinc-950">{group.label}</h3><ul className="mt-3 grid gap-2 text-sm text-zinc-600">{group.items.map((item) => <li key={item}>• {item}</li>)}</ul></div>
            ))}
          </div>
        </AdminCard>
      </div>
    </div>
  );
}

function PageHeader({ title }: { title: string }) {
  return <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Estadísticas</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">{title}</h1></div><PeriodFilter /></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <><p className="text-sm font-medium text-zinc-500">{label}</p><p className="mt-3 text-3xl font-bold text-zinc-950">{value}</p></>;
}
