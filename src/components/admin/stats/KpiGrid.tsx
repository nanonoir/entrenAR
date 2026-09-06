import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { AdminKpiMetric } from "@/lib/data/admin/statistics/dashboard";

const trendIcons = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: ArrowRight,
};

export function KpiGrid({ metrics, isLoading = false }: { metrics?: AdminKpiMetric[]; isLoading?: boolean }) {
  if (isLoading && (!metrics || metrics.length === 0)) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" role="status" aria-label="Cargando métricas">
        {Array.from({ length: 5 }, (_, index) => (
          <article key={`kpi-skeleton-${index}`} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-200" />
            <div className="mt-5 h-8 w-1/2 animate-pulse rounded bg-zinc-200" />
            <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-zinc-100" />
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {(metrics ?? []).map((metric) => {
        const TrendIcon = trendIcons[metric.trend];
        const tone = metric.trend === "down" ? "sale" : metric.trend === "up" ? "success" : "neutral";

        return (
          <article key={metric.id} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-zinc-500">{metric.label}</p>
              <Badge tone={tone} className="normal-case">
                <TrendIcon aria-hidden size={14} /> {metric.variationPct}%
              </Badge>
            </div>
            <p className="mt-4 text-2xl font-bold tracking-tight text-zinc-950">{metric.value}</p>
            <p className="mt-2 text-xs text-zinc-500">Período anterior: {metric.previousValue}</p>
          </article>
        );
      })}
    </div>
  );
}
