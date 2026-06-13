export type VisitSeriesPoint = { label: string; visitas: number; visitantes: number; ingresos: number };
export type ProductVisitRow = { id: string; producto: string; categoria: string; visitas: number; conversion: string };
export type DeviceBreakdown = { device: string; value: number; description: string };

export const visitSummary = {
  totalVisits: "42.380",
  uniqueVisitors: "12.840",
  averageDuration: "3m 42s",
  bounceRate: "38%",
};

export const visitSeries: VisitSeriesPoint[] = [
  { label: "Lun", visitas: 5480, visitantes: 1680, ingresos: 3900000 },
  { label: "Mar", visitas: 6020, visitantes: 1810, ingresos: 4200000 },
  { label: "Mié", visitas: 6250, visitantes: 1920, ingresos: 4560000 },
  { label: "Jue", visitas: 5840, visitantes: 1740, ingresos: 3980000 },
  { label: "Vie", visitas: 7200, visitantes: 2140, ingresos: 5360000 },
  { label: "Sáb", visitas: 7620, visitantes: 2310, ingresos: 5890000 },
  { label: "Dom", visitas: 3970, visitantes: 1240, ingresos: 2150000 },
];

export const mostVisitedProducts: ProductVisitRow[] = [
  { id: "v-1", producto: "Whey Protein ENA", categoria: "Proteínas", visitas: 2480, conversion: "8,4%" },
  { id: "v-2", producto: "Creatina Star Nutrition", categoria: "Creatina", visitas: 2210, conversion: "9,1%" },
  { id: "v-3", producto: "Pre Workout Energy", categoria: "Pre entreno", visitas: 1760, conversion: "5,8%" },
  { id: "v-4", producto: "Remera Boxy Fit DROP #0", categoria: "Indumentaria", visitas: 1320, conversion: "4,7%" },
];

export const deviceBreakdown: DeviceBreakdown[] = [
  { device: "Mobile", value: 64, description: "Mayor tráfico desde redes sociales" },
  { device: "Desktop", value: 29, description: "Sesiones con mayor ticket promedio" },
  { device: "Tablet", value: 7, description: "Uso minoritario" },
];
