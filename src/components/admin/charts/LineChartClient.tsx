"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type AdminLineChartProps = {
  data: Array<Record<string, string | number>>;
  lines: Array<{ dataKey: string; color: string; name: string }>;
  height?: number;
};

export default function AdminLineChartClient({ data, lines, height = 280 }: AdminLineChartProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => formatTooltipValue(value)} />
          {lines.map((line) => (
            <Line key={line.dataKey} type="monotone" dataKey={line.dataKey} name={line.name} stroke={line.color} strokeWidth={2.5} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatTooltipValue(value: unknown) {
  return typeof value === "number" ? value.toLocaleString("es-AR") : String(value ?? "");
}
