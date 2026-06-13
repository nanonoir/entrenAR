export type ProductSalesPoint = { label: string; unidades: number; facturacion: number };
export type TopProductRow = {
  id: string;
  producto: string;
  categoria: string;
  unidadesVendidas: number;
  ventasBrutas: number;
  stockActual: number;
  stockReservado: number;
};
export type InventoryAlertGroup = { id: string; label: string; items: string[] };

export const productSalesSeries: ProductSalesPoint[] = [
  { label: "Lun", unidades: 72, facturacion: 4620000 },
  { label: "Mar", unidades: 86, facturacion: 5190000 },
  { label: "Mié", unidades: 94, facturacion: 5870000 },
  { label: "Jue", unidades: 78, facturacion: 4980000 },
  { label: "Vie", unidades: 118, facturacion: 7420000 },
  { label: "Sáb", unidades: 126, facturacion: 7810000 },
  { label: "Dom", unidades: 64, facturacion: 3980000 },
];

export const topProducts: TopProductRow[] = [
  { id: "whey-ena", producto: "Whey Protein ENA", categoria: "Proteínas", unidadesVendidas: 128, ventasBrutas: 10099200, stockActual: 18, stockReservado: 6 },
  { id: "creatina-star", producto: "Creatina Star Nutrition", categoria: "Creatina", unidadesVendidas: 116, ventasBrutas: 3619200, stockActual: 9, stockReservado: 4 },
  { id: "pre-workout", producto: "Pre Workout Energy", categoria: "Pre entreno", unidadesVendidas: 84, ventasBrutas: 2352000, stockActual: 6, stockReservado: 5 },
  { id: "shaker", producto: "Shaker EntrenAR 700ml", categoria: "Accesorios", unidadesVendidas: 76, ventasBrutas: 1292000, stockActual: 34, stockReservado: 8 },
  { id: "bcaa", producto: "BCAA 2:1:1 Blue Raspberry", categoria: "Aminoácidos", unidadesVendidas: 62, ventasBrutas: 2232000, stockActual: 12, stockReservado: 3 },
  { id: "remera-boxy", producto: "Remera Boxy Fit DROP #0", categoria: "Indumentaria", unidadesVendidas: 58, ventasBrutas: 2899942, stockActual: 15, stockReservado: 7 },
  { id: "omega", producto: "Omega 3 Ultra Concentrado", categoria: "Salud", unidadesVendidas: 44, ventasBrutas: 1188000, stockActual: 0, stockReservado: 0 },
  { id: "glutamina", producto: "Glutamina Micronizada", categoria: "Recuperación", unidadesVendidas: 41, ventasBrutas: 1312000, stockActual: 7, stockReservado: 2 },
  { id: "cinturon", producto: "Cinturón Powerlifting", categoria: "Accesorios", unidadesVendidas: 33, ventasBrutas: 3135000, stockActual: 4, stockReservado: 3 },
  { id: "barritas", producto: "Barritas Proteicas x12", categoria: "Snacks", unidadesVendidas: 30, ventasBrutas: 960000, stockActual: 22, stockReservado: 5 },
];

export const inventoryAlerts: InventoryAlertGroup[] = [
  { id: "no-stock", label: "Sin stock", items: ["Omega 3 Ultra Concentrado"] },
  { id: "low-stock", label: "Bajo stock", items: ["Creatina Star Nutrition", "Pre Workout Energy", "Cinturón Powerlifting"] },
  { id: "best-seller-low-stock", label: "Muy vendidos con bajo stock", items: ["Creatina Star Nutrition", "Pre Workout Energy"] },
  { id: "high-reserved", label: "Stock reservado alto", items: ["Shaker EntrenAR 700ml", "Remera Boxy Fit DROP #0"] },
];
