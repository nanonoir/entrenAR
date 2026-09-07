"use client";

import { useEffect } from "react";

import { AdminBarChart } from "@/components/admin/charts";
import { PeriodFilter } from "@/components/admin/stats/PeriodFilter";
import { AdminCard, AdminCardHeader } from "@/components/admin/ui/AdminCard";
import { Button } from "@/components/ui/Button";
import type { StatisticsCoupon, StatisticsCouponsData } from "@/lib/api/admin/statistics/types";
import { couponComparison, topCoupons, type CouponComparison, type CouponUsage } from "@/lib/data/admin/statistics/coupons";
import { useAdminStatisticsStore } from "@/stores/admin-statistics-store";

const currencyFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export default function CouponsReportPage() {
  const period = useAdminStatisticsStore((state) => state.period);
  const customRange = useAdminStatisticsStore((state) => state.customRange);
  const coupons = useAdminStatisticsStore((state) => state.coupons);
  const fetchCoupons = useAdminStatisticsStore((state) => state.fetchCoupons);

  useEffect(() => {
    void fetchCoupons();
  }, [customRange, fetchCoupons, period]);

  const couponRows = coupons.data?.topCoupons ? toCouponRows(coupons.data.topCoupons) : topCoupons;
  const comparisonRows = coupons.data?.comparison ? toCouponComparisonRows(coupons.data.comparison) : couponComparison;
  const totalOrders = comparisonRows.reduce((sum, item) => sum + item.pedidos, 0);

  return (
    <div className="mx-auto grid max-w-7xl gap-6" aria-busy={coupons.isLoading}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Estadísticas</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">Estadísticas › Reporte de cupones</h1></div><PeriodFilter /></div>
      {coupons.error ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <p>{coupons.error.message}</p>
          <Button variant="secondary" size="sm" onClick={() => void fetchCoupons(true)} disabled={coupons.isLoading}>
            {coupons.isLoading ? "Reintentando..." : "Reintentar"}
          </Button>
        </div>
      ) : null}
      {coupons.isLoading ? <p className="text-sm text-zinc-500" role="status" aria-live="polite">Actualizando estadísticas...</p> : null}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminCard><AdminCardHeader title="Cupones más usados" description="Top códigos por cantidad de usos." /><AdminBarChart data={couponRows} xKey="code" layout="vertical" bars={[{ dataKey: "usos", name: "Usos", color: "#39b000" }]} /></AdminCard>
        <AdminCard><AdminCardHeader title="Ventas con/sin cupón" description="Comparación de pedidos y facturación." /><div className="grid gap-4">{comparisonRows.map((item) => { const percentage = totalOrders > 0 ? (item.pedidos / totalOrders) * 100 : 0; return <div key={item.label}><div className="mb-2 flex justify-between text-sm font-semibold"><span>{item.label}</span><span>{item.pedidos} pedidos</span></div><div className="h-3 rounded-full bg-zinc-100" role="progressbar" aria-label={item.label} aria-valuemax={totalOrders} aria-valuemin={0} aria-valuenow={item.pedidos}><div className={`h-3 rounded-full ${item.tone}`} style={{ width: `${percentage}%` }} /></div><p className="mt-2 text-sm text-zinc-500">{currencyFormatter.format(item.facturacion)}</p></div>; })}</div></AdminCard>
      </div>
    </div>
  );
}

function toCouponRows(items: StatisticsCoupon[]): CouponUsage[] {
  return items.map((item) => ({ code: item.code, usos: item.redemptions, ventas: item.revenue }));
}

function toCouponComparisonRows(comparison: StatisticsCouponsData["comparison"]): CouponComparison[] {
  return [
    { label: "Ventas con cupón", pedidos: comparison.withCoupon.orders, facturacion: comparison.withCoupon.revenue, tone: "bg-accent" },
    { label: "Ventas sin cupón", pedidos: comparison.withoutCoupon.orders, facturacion: comparison.withoutCoupon.revenue, tone: "bg-zinc-900" },
  ];
}
