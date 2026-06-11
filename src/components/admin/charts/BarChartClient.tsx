"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type AdminBarChartProps = {
  data: Array<Record<string, string | number>>;
  xKey: string;
  bars: Array<{ dataKey: string; color: string; name: string }>;
  layout?: "horizontal" | "vertical";
  height?: number;
};

export default function AdminBarChartClient({ data, xKey, bars, layout = "horizontal", height = 280 }: AdminBarChartProps) {
  const vertical = layout === "vertical";

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={layout} margin={{ left: vertical ? 24 : 0, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          {vertical ? (
            <>
              <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey={xKey} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={92} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            </>
          )}
          <Tooltip formatter={(value) => formatTooltipValue(value)} />
          {bars.map((bar) => (
            <Bar key={bar.dataKey} dataKey={bar.dataKey} name={bar.name} fill={bar.color} radius={[8, 8, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatTooltipValue(value: unknown) {
  return typeof value === "number" ? value.toLocaleString("es-AR") : String(value ?? "");
}
