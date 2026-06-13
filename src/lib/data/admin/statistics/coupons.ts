export type CouponUsage = { code: string; usos: number; ventas: number };
export type CouponComparison = { label: string; pedidos: number; facturacion: number; tone: string };

export const topCoupons: CouponUsage[] = [
  { code: "NANO10", usos: 84, ventas: 4210000 },
  { code: "CREATINA15", usos: 68, ventas: 3180000 },
  { code: "ENVIOGRATIS", usos: 57, ventas: 2740000 },
  { code: "DROP20", usos: 36, ventas: 1980000 },
  { code: "PROTEINA12", usos: 29, ventas: 1540000 },
];

export const couponComparison: CouponComparison[] = [
  { label: "Ventas con cupón", pedidos: 214, facturacion: 10840000, tone: "bg-accent" },
  { label: "Ventas sin cupón", pedidos: 272, facturacion: 20580000, tone: "bg-zinc-900" },
];
