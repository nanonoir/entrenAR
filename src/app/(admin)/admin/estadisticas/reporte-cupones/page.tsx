import { AdminBarChart } from "@/components/admin/charts";
import { PeriodFilter } from "@/components/admin/stats/PeriodFilter";
import { AdminCard, AdminCardHeader } from "@/components/admin/ui/AdminCard";
import { couponComparison, topCoupons } from "@/lib/data/admin/statistics/coupons";

const currencyFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export default function CouponsReportPage() {
  const totalOrders = couponComparison.reduce((sum, item) => sum + item.pedidos, 0);

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Estadísticas</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">Estadísticas › Reporte de cupones</h1></div><PeriodFilter /></div>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminCard><AdminCardHeader title="Cupones más usados" description="Top códigos por cantidad de usos." /><AdminBarChart data={topCoupons} xKey="code" layout="vertical" bars={[{ dataKey: "usos", name: "Usos", color: "#39b000" }]} /></AdminCard>
        <AdminCard><AdminCardHeader title="Ventas con/sin cupón" description="Comparación de pedidos y facturación." /><div className="grid gap-4">{couponComparison.map((item) => <div key={item.label}><div className="mb-2 flex justify-between text-sm font-semibold"><span>{item.label}</span><span>{item.pedidos} pedidos</span></div><div className="h-3 rounded-full bg-zinc-100"><div className={`h-3 rounded-full ${item.tone}`} style={{ width: `${(item.pedidos / totalOrders) * 100}%` }} /></div><p className="mt-2 text-sm text-zinc-500">{currencyFormatter.format(item.facturacion)}</p></div>)}</div></AdminCard>
      </div>
    </div>
  );
}
