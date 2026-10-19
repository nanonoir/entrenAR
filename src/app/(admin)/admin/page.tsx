"use client";

import { useEffect } from "react";

import { AdminCard } from "@/components/admin/ui/AdminCard";
import { KpiGrid } from "@/components/admin/stats/KpiGrid";
import { PeriodFilter } from "@/components/admin/stats/PeriodFilter";
import { Button } from "@/components/ui/Button";
import { AdminEmptyState } from "@/components/admin/ui/States";
import type { AdminKpiMetric } from "@/lib/data/admin/statistics/dashboard";
import type { StatisticsMetrics } from "@/lib/api/admin/statistics/types";
import { useAdminStatisticsStore } from "@/stores/admin-statistics-store";

const overviewMetricDefinitions: { id: string; key: keyof StatisticsMetrics; label: string }[] = [
  { id: "sales", key: "orders", label: "Ventas" },
  { id: "billing", key: "revenue", label: "Facturación" },
  { id: "average-ticket", key: "averageTicket", label: "Ticket promedio" },
  { id: "cart-conversion", key: "conversionRate", label: "Conversión del carrito" },
];

const currencyFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const integerFormatter = new Intl.NumberFormat("es-AR");
const percentageFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

export default function AdminPage() {
  const period = useAdminStatisticsStore((state) => state.period);
  const customRange = useAdminStatisticsStore((state) => state.customRange);
  const overview = useAdminStatisticsStore((state) => state.overview);
  const fetchOverview = useAdminStatisticsStore((state) => state.fetchOverview);

  useEffect(() => {
    void fetchOverview();
  }, [customRange, fetchOverview, period]);

  const overviewMetrics = overview.data?.metrics ? toKpiMetrics(overview.data.metrics) : [];
  const liveBehavior = overview.data?.behavior;
  const behaviorBlocks = [
    { id: "paid-orders", title: "Pedidos pagos", value: liveBehavior?.paidOrders, description: "Pedidos con pago aprobado en el período." },
    { id: "created-carts", title: "Carritos creados", value: liveBehavior?.createdCarts, description: "Carritos iniciados en el período." },
  ];

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

      <KpiGrid metrics={overviewMetrics} isLoading={overview.isLoading} />
      {!overview.isLoading && overviewMetrics.length === 0 ? <AdminEmptyState title="Sin métricas" description={overview.error ? "No se pudieron cargar las métricas del período." : "Todavía no hay métricas para el período seleccionado."} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {behaviorBlocks.map((block) => (
          <AdminCard key={block.id}>
            <p className="text-sm font-medium text-zinc-500">{block.title}</p>
            <p className="mt-3 text-3xl font-bold text-zinc-950">{block.value === undefined ? "—" : formatBehaviorValue(block.value)}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">{block.description}</p>
          </AdminCard>
        ))}
      </div>

      <AdminEmptyState title="Visitas no disponibles" description="Todavía no registramos el tráfico de la tienda, por eso no se muestran visitas, visitantes únicos ni duración de sesión." />
    </div>
  );
}

function toKpiMetrics(source: StatisticsMetrics): AdminKpiMetric[] {
  return overviewMetricDefinitions.flatMap((definition) => {
    const liveMetric = source[definition.key];
    if (!liveMetric) return [];

    return [{
      id: definition.id,
      label: definition.label,
      value: formatKpiValue(definition.id, liveMetric.current),
      previousValue: formatKpiValue(definition.id, liveMetric.previous),
      variationPct: liveMetric.variationPct,
      trend: liveMetric.trend,
    }];
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
