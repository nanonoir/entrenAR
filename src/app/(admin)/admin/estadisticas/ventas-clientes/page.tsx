import { AdminBarChart, AdminDonutChart } from "@/components/admin/charts";
import { PeriodFilter } from "@/components/admin/stats/PeriodFilter";
import { AdminCard, AdminCardHeader } from "@/components/admin/ui/AdminCard";
import { paymentMethodRevenue, paymentStatusData, salesMetrics, shippingSplit, topCustomers, topProvinces } from "@/lib/data/admin/statistics/sales";

const currencyFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export default function SalesCustomersStatsPage() {
  const shippingTotal = shippingSplit.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <Header />
      <div className="grid gap-4 lg:grid-cols-3">{salesMetrics.map((metric) => <AdminCard key={metric.id}><p className="text-sm font-medium text-zinc-500">{metric.label}</p><p className="mt-3 text-3xl font-bold text-zinc-950">{metric.value}</p><p className="mt-2 text-sm text-zinc-500">{metric.helper}</p></AdminCard>)}</div>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminCard><AdminCardHeader title="Pedidos por estado de pago" description="Distribución mock de pedidos." /><AdminDonutChart data={paymentStatusData} /></AdminCard>
        <AdminCard><AdminCardHeader title="Ingresos por medio de pago" description="Métodos de pago principales." /><AdminBarChart data={paymentMethodRevenue} xKey="method" bars={[{ dataKey: "ingresos", name: "Ingresos", color: "#39b000" }]} /></AdminCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminCard>
          <AdminCardHeader title="Clientes principales" description="Sólo compradores reales con pedidos pagados." />
          <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-zinc-400"><tr><th scope="col" className="py-3">Nombre</th><th scope="col">Mail</th><th scope="col">Total gastado</th><th scope="col">Pedidos</th></tr></thead><tbody className="divide-y divide-zinc-100">{topCustomers.map((customer) => <tr key={customer.id} className="text-zinc-700"><td className="py-3 font-semibold text-zinc-950">{customer.nombre}</td><td>{customer.mail}</td><td>{currencyFormatter.format(customer.totalGastado)}</td><td>{customer.pedidos}</td></tr>)}</tbody></table></div>
        </AdminCard>
        <AdminCard>
          <AdminCardHeader title="Ventas con/sin envío" />
          <div className="grid gap-4">{shippingSplit.map((item) => <div key={item.label}><div className="mb-2 flex justify-between text-sm font-semibold"><span>{item.label}</span><span>{item.value}</span></div><div className="h-3 rounded-full bg-zinc-100"><div className={`h-3 rounded-full ${item.tone}`} style={{ width: `${(item.value / shippingTotal) * 100}%` }} /></div></div>)}</div>
        </AdminCard>
      </div>

      <AdminCard><AdminCardHeader title="Top provincias" description="Pedidos y facturación por provincia." /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{topProvinces.map((province) => <div key={province.provincia} className="rounded-2xl bg-zinc-50 p-4"><p className="font-semibold text-zinc-950">{province.provincia}</p><p className="mt-2 text-sm text-zinc-500">{province.pedidos} pedidos</p><p className="text-sm text-zinc-500">{currencyFormatter.format(province.facturacion)}</p></div>)}</div></AdminCard>
    </div>
  );
}

function Header() {
  return <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Estadísticas</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">Estadísticas › Ventas y Clientes</h1></div><PeriodFilter /></div>;
}
