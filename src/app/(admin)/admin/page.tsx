"use client";

import { useEffect } from "react";

import { AdminCard, AdminCardHeader } from "@/components/admin/ui/AdminCard";
import { AdminLineChart } from "@/components/admin/charts";
import { KpiGrid } from "@/components/admin/stats/KpiGrid";
import { PeriodFilter } from "@/components/admin/stats/PeriodFilter";
import { Button } from "@/components/ui/Button";
import { overviewKpis, visitorBehaviorBlocks } from "@/lib/data/admin/statistics/dashboard";
import { visitSeries } from "@/lib/data/admin/statistics/visits";
import type { AdminKpiMetric } from "@/lib/data/admin/statistics/dashboard";
import type { StatisticsMetrics } from "@/lib/api/admin/statistics/types";
import { useAdminStatisticsStore } from "@/stores/admin-statistics-store";

const overviewMetricKeys: Record<string, keyof StatisticsMetrics> = {
  sales: "orders",
  billing: "revenue",
  "average-ticket": "averageTicket",
  "cart-conversion": "conversionRate",
};

const currencyFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const integerFormatter = new Intl.NumberFormat("es-AR");
const percentageFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

type OverviewMetricSource = AdminKpiMetric[] | StatisticsMetrics;

export default function AdminPage() {
  const period = useAdminStatisticsStore((state) => state.period);
  const customRange = useAdminStatisticsStore((state) => state.customRange);
  const overview = useAdminStatisticsStore((state) => state.overview);
  const fetchOverview = useAdminStatisticsStore((state) => state.fetchOverview);

  useEffect(() => {
    void fetchOverview();
  }, [customRange, fetchOverview, period]);

  const overviewMetrics = overview.data?.metrics ?? overviewKpis;
  const liveBehavior = overview.data?.behavior;
  const behaviorBlocks = visitorBehaviorBlocks.map((block) => {
    const liveValue = block.id === "paid-orders" ? liveBehavior?.paidOrders : block.id === "created-carts" ? liveBehavior?.createdCarts : undefined;
    return liveValue === undefined ? block : { ...block, value: formatBehaviorValue(liveValue) };
  });

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Inicio</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">Visión general</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">Resumen visual del rendimiento comercial de EntrenAR.</p>
        </div>
        <PeriodFilter />
      </div>

      {overview.error ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <p>{overview.error.message}</p>
          <Button variant="secondary" size="sm" onClick={() => void fetchOverview(true)} disabled={overview.isLoading}>Reintentar</Button>
        </div>
      ) : null}

      <KpiGrid metrics={toKpiMetrics(overviewMetrics)} isLoading={overview.isLoading} />

      <div className="grid gap-4 lg:grid-cols-3">
        {behaviorBlocks.map((block) => (
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

function toKpiMetrics(source: OverviewMetricSource): AdminKpiMetric[] {
  if (Array.isArray(source)) return source;

  return overviewKpis.map((metric) => {
    const liveKey = overviewMetricKeys[metric.id];
    const liveMetric = liveKey ? source[liveKey] : undefined;
    if (!liveMetric) return metric;

    return {
      ...metric,
      value: formatKpiValue(metric.id, liveMetric.current),
      previousValue: formatKpiValue(metric.id, liveMetric.previous),
      variationPct: liveMetric.variationPct,
      trend: liveMetric.trend,
    };
  });
}

function formatKpiValue(id: string, value: number): string {
  if (id === "billing" || id === "average-ticket") return currencyFormatter.format(value);
  if (id === "cart-conversion") return `${percentageFormatter.format(value)}%`;
  return integerFormatter.format(value);
}

function formatBehaviorValue(value: number): string {
  return integerFormatter.format(value);
}
