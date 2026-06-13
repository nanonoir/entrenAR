export type KpiTrend = "up" | "down" | "flat";

export type AdminKpiMetric = {
  id: string;
  label: string;
  value: string;
  previousValue: string;
  variationPct: number;
  trend: KpiTrend;
};

export type VisitorBehaviorBlock = {
  id: string;
  title: string;
  value: string;
  description: string;
  variationPct?: number;
};

export const overviewKpis: AdminKpiMetric[] = [
  { id: "unique-visits", label: "Visitas únicas", value: "12.840", previousValue: "11.930", variationPct: 7.6, trend: "up" },
  { id: "sales", label: "Ventas", value: "486", previousValue: "452", variationPct: 7.5, trend: "up" },
  { id: "billing", label: "Facturación", value: "$ 31.420.000", previousValue: "$ 28.900.000", variationPct: 8.7, trend: "up" },
  { id: "average-ticket", label: "Ticket promedio", value: "$ 64.650", previousValue: "$ 63.938", variationPct: 1.1, trend: "up" },
  { id: "cart-conversion", label: "Conversión del carrito", value: "18,4%", previousValue: "16,9%", variationPct: 1.5, trend: "up" },
];

export const visitorBehaviorBlocks: VisitorBehaviorBlock[] = [
  { id: "behavior", title: "Comportamiento del visitante", value: "3m 42s", description: "Duración promedio por sesión en la tienda.", variationPct: 4.2 },
  { id: "paid-orders", title: "Visitas a pedidos pagos", value: "1.284", description: "Sesiones que finalizaron en pagos aprobados.", variationPct: 6.8 },
  { id: "created-carts", title: "Visitas a carritos creados", value: "2.640", description: "Sesiones con al menos un carrito iniciado.", variationPct: 11.4 },
];
