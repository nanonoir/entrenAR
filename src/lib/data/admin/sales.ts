export type SalesMetric = { id: string; label: string; value: string; helper: string };
export type PaymentStatusPoint = { name: string; value: number; fill: string };
export type PaymentMethodRevenue = { method: string; ingresos: number };
export type TopCustomer = { id: string; nombre: string; mail: string; totalGastado: number; pedidos: number };
export type ShippingSplit = { label: string; value: number; tone: string };
export type ProvinceSales = { provincia: string; pedidos: number; facturacion: number };

export const salesMetrics: SalesMetric[] = [
  { id: "orders", label: "Pedidos creados", value: "612", helper: "486 pagos / 126 pendientes" },
  { id: "gross-billing", label: "Facturación bruta", value: "$ 31.420.000", helper: "Antes de descuentos y devoluciones" },
  { id: "average-ticket", label: "Ticket promedio", value: "$ 64.650", helper: "Promedio sobre pedidos pagos" },
];

export const paymentStatusData: PaymentStatusPoint[] = [
  { name: "Pago pendiente de acreditación", value: 92, fill: "#f59e0b" },
  { name: "Pagado", value: 486, fill: "#39b000" },
  { name: "Pago rechazado", value: 21, fill: "#ef4444" },
  { name: "Cancelado", value: 34, fill: "#71717a" },
  { name: "Reembolsado", value: 13, fill: "#18181b" },
];

export const paymentMethodRevenue: PaymentMethodRevenue[] = [
  { method: "Transferencia bancaria", ingresos: 8200000 },
  { method: "Tarjeta de débito", ingresos: 4100000 },
  { method: "Tarjeta de crédito", ingresos: 7600000 },
  { method: "MercadoPago", ingresos: 9100000 },
  { method: "Payway", ingresos: 1800000 },
  { method: "Billetera virtual", ingresos: 620000 },
];

export const topCustomers: TopCustomer[] = [
  { id: "c-1", nombre: "Camila Pérez", mail: "camila.perez@example.com", totalGastado: 642000, pedidos: 8 },
  { id: "c-2", nombre: "Martín Suárez", mail: "martin.suarez@example.com", totalGastado: 588000, pedidos: 6 },
  { id: "c-3", nombre: "Sofía Ledesma", mail: "sofia.ledesma@example.com", totalGastado: 421000, pedidos: 5 },
  { id: "c-4", nombre: "Nicolás Ferreyra", mail: "nicolas.ferreyra@example.com", totalGastado: 398000, pedidos: 4 },
];

export const shippingSplit: ShippingSplit[] = [
  { label: "Con envío", value: 384, tone: "bg-emerald-500" },
  { label: "Retiro / sin envío", value: 102, tone: "bg-accent" },
];

export const topProvinces: ProvinceSales[] = [
  { provincia: "Buenos Aires", pedidos: 218, facturacion: 14200000 },
  { provincia: "Córdoba", pedidos: 84, facturacion: 5280000 },
  { provincia: "Santa Fe", pedidos: 63, facturacion: 3970000 },
  { provincia: "Mendoza", pedidos: 41, facturacion: 2410000 },
  { provincia: "Tucumán", pedidos: 29, facturacion: 1720000 },
];
