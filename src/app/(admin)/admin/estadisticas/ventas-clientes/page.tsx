"use client";

import { useEffect } from "react";

import { AdminBarChart, AdminDonutChart } from "@/components/admin/charts";
import { PeriodFilter } from "@/components/admin/stats/PeriodFilter";
import { AdminCard, AdminCardHeader } from "@/components/admin/ui/AdminCard";
import { Button } from "@/components/ui/Button";
import type {
  StatisticsCustomer,
  StatisticsMetrics,
  StatisticsPaymentMethod,
  StatisticsPaymentStatus,
  StatisticsProvinceBreakdown,
  StatisticsShippingBreakdown,
} from "@/lib/api/admin/statistics/types";
import {
  paymentMethodRevenue,
  paymentStatusData,
  salesMetrics,
  shippingSplit,
  topCustomers,
  topProvinces,
} from "@/lib/data/admin/statistics/sales";
import { useAdminStatisticsStore } from "@/stores/admin-statistics-store";

const currencyFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const integerFormatter = new Intl.NumberFormat("es-AR");
const salesMetricKeys: Record<string, keyof StatisticsMetrics> = {
  orders: "orders",
  "gross-billing": "revenue",
  "average-ticket": "averageTicket",
};
const paymentStatusFills = ["#f59e0b", "#39b000", "#ef4444", "#71717a", "#18181b"] as const;

export default function SalesCustomersStatsPage() {
  const period = useAdminStatisticsStore((state) => state.period);
  const customRange = useAdminStatisticsStore((state) => state.customRange);
  const sales = useAdminStatisticsStore((state) => state.sales);
  const fetchSales = useAdminStatisticsStore((state) => state.fetchSales);
  const customers = useAdminStatisticsStore((state) => state.customers);
  const fetchCustomers = useAdminStatisticsStore((state) => state.fetchCustomers);

  useEffect(() => {
    void fetchSales();
    void fetchCustomers();
  }, [customRange, fetchCustomers, fetchSales, period]);

  const metrics = toSalesMetrics(sales.data?.metrics);
  const paymentStatuses = toPaymentStatusData(sales.data?.paymentStatuses);
  const paymentMethods = toPaymentMethodData(sales.data?.paymentMethods);
  const customerRows = toCustomerRows(customers.data?.topCustomers);
  const shippingRows = toShippingRows(sales.data?.shipping);
  const provinceRows = toProvinceRows(sales.data?.provinces);
  const shippingTotal = shippingRows.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="mx-auto grid max-w-7xl gap-6" aria-busy={sales.isLoading}>
      <Header />
      {sales.error ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <p>{sales.error.message}</p>
          <Button variant="secondary" size="sm" onClick={() => void fetchSales(true)} disabled={sales.isLoading}>
            {sales.isLoading ? "Reintentando..." : "Reintentar"}
          </Button>
        </div>
      ) : null}
      {sales.isLoading ? <p className="text-sm text-zinc-500" role="status">Actualizando estadísticas...</p> : null}

      <div className="grid gap-4 lg:grid-cols-3">{metrics.map((metric) => <AdminCard key={metric.id}><p className="text-sm font-medium text-zinc-500">{metric.label}</p><p className="mt-3 text-3xl font-bold text-zinc-950">{metric.value}</p><p className="mt-2 text-sm text-zinc-500">{metric.helper}</p></AdminCard>)}</div>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminCard><AdminCardHeader title="Pedidos por estado de pago" description="Distribución de pedidos por estado." /><AdminDonutChart data={paymentStatuses} /></AdminCard>
        <AdminCard><AdminCardHeader title="Ingresos por medio de pago" description="Métodos de pago principales." /><AdminBarChart data={paymentMethods} xKey="method" bars={[{ dataKey: "ingresos", name: "Ingresos", color: "#39b000" }]} /></AdminCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminCard>
          <AdminCardHeader title="Clientes principales" description="Sólo compradores reales con pedidos pagados." />
          <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-zinc-400"><tr><th scope="col" className="py-3">Nombre</th><th scope="col">Mail</th><th scope="col">Total gastado</th><th scope="col">Pedidos</th></tr></thead><tbody className="divide-y divide-zinc-100">{customerRows.map((customer) => <tr key={customer.id} className="text-zinc-700"><td className="py-3 font-semibold text-zinc-950">{customer.nombre}</td><td>{customer.mail}</td><td>{currencyFormatter.format(customer.totalGastado)}</td><td>{customer.pedidos}</td></tr>)}</tbody></table></div>
        </AdminCard>
        <AdminCard>
          <AdminCardHeader title="Ventas con/sin envío" />
          <div className="grid gap-4">{shippingRows.map((item) => { const percentage = shippingTotal > 0 ? (item.value / shippingTotal) * 100 : 0; return <div key={item.label}><div className="mb-2 flex justify-between text-sm font-semibold"><span>{item.label}</span><span>{item.value}</span></div><div className="h-3 rounded-full bg-zinc-100" role="progressbar" aria-label={item.label} aria-valuemax={shippingTotal} aria-valuemin={0} aria-valuenow={item.value}><div className={`h-3 rounded-full ${item.tone}`} style={{ width: `${percentage}%` }} /></div></div>; })}</div>
        </AdminCard>
      </div>

      <AdminCard><AdminCardHeader title="Top provincias" description="Pedidos y facturación por provincia." /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{provinceRows.map((province) => <div key={province.provincia} className="rounded-2xl bg-zinc-50 p-4"><p className="font-semibold text-zinc-950">{province.provincia}</p><p className="mt-2 text-sm text-zinc-500">{province.pedidos} pedidos</p><p className="text-sm text-zinc-500">{currencyFormatter.format(province.facturacion)}</p></div>)}</div></AdminCard>
    </div>
  );
}

function Header() {
  return <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Estadísticas</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">Estadísticas › Ventas y Clientes</h1></div><PeriodFilter /></div>;
}

function toSalesMetrics(metrics?: StatisticsMetrics) {
  if (!metrics) return salesMetrics;

  return salesMetrics.map((metric) => {
    const liveMetric = metrics[salesMetricKeys[metric.id]];
    return liveMetric ? { ...metric, value: formatSalesMetric(metric.id, liveMetric.current) } : metric;
  });
}

function toPaymentStatusData(items?: StatisticsPaymentStatus[]) {
  if (!items) return paymentStatusData;

  return items.map((item, index) => ({
    name: item.status,
    value: item.count,
    fill: paymentStatusData.find((fallback) => fallback.name === item.status)?.fill ?? paymentStatusFills[index % paymentStatusFills.length],
  }));
}

function toPaymentMethodData(items?: StatisticsPaymentMethod[]) {
  if (!items) return paymentMethodRevenue;
  return items.map((item) => ({ method: item.method, ingresos: item.revenue }));
}

function toCustomerRows(items?: StatisticsCustomer[]) {
  if (!items) return topCustomers;
  return items.map((item) => ({ id: item.id, nombre: item.name, mail: item.email, totalGastado: item.totalSpent, pedidos: item.ordersCount }));
}

function toShippingRows(items?: StatisticsShippingBreakdown[]) {
  if (!items) return shippingSplit;
  return items.map((item, index) => ({ label: item.type, value: item.orders, tone: shippingSplit[index]?.tone ?? "bg-accent" }));
}

function toProvinceRows(items?: StatisticsProvinceBreakdown[]) {
  if (!items) return topProvinces;
  return items.map((item) => ({ provincia: item.province, pedidos: item.orders, facturacion: item.revenue }));
}

function formatSalesMetric(id: string, value: number): string {
  if (id === "gross-billing" || id === "average-ticket") return currencyFormatter.format(value);
  return integerFormatter.format(value);
}
