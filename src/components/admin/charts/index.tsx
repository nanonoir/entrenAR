"use client";

import dynamic from "next/dynamic";
import type { AdminBarChartProps } from "@/components/admin/charts/BarChartClient";
import type { AdminDonutChartProps } from "@/components/admin/charts/DonutChartClient";
import type { AdminLineChartProps } from "@/components/admin/charts/LineChartClient";

export const AdminLineChart = dynamic<AdminLineChartProps>(() => import("@/components/admin/charts/LineChartClient"), {
  ssr: false,
  loading: () => <div className="h-[280px] animate-pulse rounded-2xl bg-zinc-100" />,
});

export const AdminBarChart = dynamic<AdminBarChartProps>(() => import("@/components/admin/charts/BarChartClient"), {
  ssr: false,
  loading: () => <div className="h-[280px] animate-pulse rounded-2xl bg-zinc-100" />,
});

export const AdminDonutChart = dynamic<AdminDonutChartProps>(() => import("@/components/admin/charts/DonutChartClient"), {
  ssr: false,
  loading: () => <div className="h-[280px] animate-pulse rounded-2xl bg-zinc-100" />,
});
