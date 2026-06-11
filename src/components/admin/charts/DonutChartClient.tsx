"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export type AdminDonutChartProps = {
  data: Array<{ name: string; value: number; fill: string }>;
  height?: number;
};

export default function AdminDonutChartClient({ data, height = 280 }: AdminDonutChartProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={3}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => formatTooltipValue(value)} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatTooltipValue(value: unknown) {
  return typeof value === "number" ? value.toLocaleString("es-AR") : String(value ?? "");
}
