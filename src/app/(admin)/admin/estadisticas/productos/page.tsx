"use client";

import { useEffect } from "react";

import { AdminLineChart } from "@/components/admin/charts";
import { PeriodFilter } from "@/components/admin/stats/PeriodFilter";
import { AdminCard, AdminCardHeader } from "@/components/admin/ui/AdminCard";
import { Button } from "@/components/ui/Button";
import type {
  StatisticsInventoryAlertGroup,
  StatisticsProduct,
  StatisticsProductSeriesPoint,
} from "@/lib/api/admin/statistics/types";
import {
  inventoryAlerts,
  productSalesSeries,
  topProducts,
  type InventoryAlertGroup,
  type ProductSalesPoint,
  type TopProductRow,
} from "@/lib/data/admin/statistics/products";
import { useAdminStatisticsStore } from "@/stores/admin-statistics-store";

const formatter = new Intl.NumberFormat("es-AR");
const currencyFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const seriesDateFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" });
const inventoryAlertLabels: Record<string, string> = {
  BEST_SELLER_LOW_STOCK: "Muy vendidos con bajo stock",
  HIGH_RESERVED: "Stock reservado alto",
  LOW_STOCK: "Bajo stock",
  OUT_OF_STOCK: "Sin stock",
};

export default function ProductStatsPage() {
  const period = useAdminStatisticsStore((state) => state.period);
  const customRange = useAdminStatisticsStore((state) => state.customRange);
  const products = useAdminStatisticsStore((state) => state.products);
  const fetchProducts = useAdminStatisticsStore((state) => state.fetchProducts);

  useEffect(() => {
    void fetchProducts();
  }, [customRange, fetchProducts, period]);

  const productRows = products.data?.topProducts ? toProductRows(products.data.topProducts) : topProducts;
  const fallbackMetrics = {
    grossSales: topProducts.reduce((sum, product) => sum + product.ventasBrutas, 0),
    reservedStock: topProducts.reduce((sum, product) => sum + product.stockReservado, 0),
    unitsSold: topProducts.reduce((sum, product) => sum + product.unidadesVendidas, 0),
  };
  const metrics = {
    grossSales: products.data?.metrics.revenue?.current ?? fallbackMetrics.grossSales,
    reservedStock: products.data?.metrics.stockReserved?.current ?? fallbackMetrics.reservedStock,
    unitsSold: products.data?.metrics.unitsSold?.current ?? fallbackMetrics.unitsSold,
  };
  const maxUnits = Math.max(...productRows.map((product) => product.unidadesVendidas), 0);
  const salesSeries = products.data?.series ? toProductSalesSeries(products.data.series) : productSalesSeries;
  const alertGroups = products.data?.inventoryAlerts ? toInventoryAlertRows(products.data.inventoryAlerts) : inventoryAlerts;

  return (
    <div className="mx-auto grid max-w-7xl gap-6" aria-busy={products.isLoading}>
      <PageHeader title="Estadísticas › Productos" />
      {products.error ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <p>{products.error.message}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void fetchProducts(true)}
            disabled={products.isLoading}
          >
            {products.isLoading ? "Reintentando..." : "Reintentar"}
          </Button>
        </div>
      ) : null}
      {products.isLoading ? <p className="text-sm text-zinc-500" role="status" aria-live="polite">Actualizando estadísticas...</p> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminCard><Metric label="Unidades vendidas" value={formatter.format(metrics.unitsSold)} /></AdminCard>
        <AdminCard><Metric label="Ventas brutas por producto" value={currencyFormatter.format(metrics.grossSales)} /></AdminCard>
        <AdminCard><Metric label="Stock reservado" value={formatter.format(metrics.reservedStock)} /></AdminCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminCard>
          <AdminCardHeader title="Top 10 productos" description="Productos ordenados por unidades vendidas." />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-400">
                <tr><th scope="col" className="py-3">Producto</th><th scope="col">Categoría</th><th scope="col">Unidades</th><th scope="col">Ventas brutas</th><th scope="col">Stock</th><th scope="col">Reservado</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {productRows.map((product) => (
                  <tr key={product.id} className="text-zinc-700"><td className="py-3 font-semibold text-zinc-950">{product.producto}</td><td>{product.categoria}</td><td>{product.unidadesVendidas}</td><td>{currencyFormatter.format(product.ventasBrutas)}</td><td>{product.stockActual}</td><td>{product.stockReservado}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>

        <AdminCard>
          <AdminCardHeader title="Ranking visual" description="Barras CSS proporcionales al líder." />
          <div className="grid gap-3">
            {productRows.slice(0, 10).map((product) => (
              <div key={product.id}>
                <div className="mb-1 flex min-w-0 justify-between gap-3 text-xs font-semibold text-zinc-600"><span className="min-w-0 truncate">{product.producto}</span><span className="shrink-0">{product.unidadesVendidas}</span></div>
                <div className="h-2 rounded-full bg-zinc-100"><div className="h-2 rounded-full bg-accent" style={{ width: `${maxUnits > 0 ? (product.unidadesVendidas / maxUnits) * 100 : 0}%` }} /></div>
              </div>
            ))}
          </div>
        </AdminCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <AdminCard>
          <AdminCardHeader title="Unidades y facturación" description="Línea semanal de referencia para productos." />
          <AdminLineChart data={salesSeries} lines={[{ dataKey: "unidades", name: "Unidades", color: "#39b000" }, { dataKey: "facturacion", name: "Facturación", color: "#18181b" }]} />
        </AdminCard>

        <AdminCard>
          <AdminCardHeader title="Alertas de inventario" description="Categorías accionables para reposición." />
          <div className="grid gap-4 sm:grid-cols-2">
            {alertGroups.map((group) => (
              <div key={group.id} className="rounded-2xl bg-zinc-50 p-4"><h3 className="font-semibold text-zinc-950">{group.label}</h3><ul className="mt-3 grid gap-2 text-sm text-zinc-600">{group.items.map((item) => <li key={item}>• {item}</li>)}</ul></div>
            ))}
          </div>
        </AdminCard>
      </div>
    </div>
  );
}

function PageHeader({ title }: { title: string }) {
  return <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Estadísticas</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">{title}</h1></div><PeriodFilter /></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <><p className="text-sm font-medium text-zinc-500">{label}</p><p className="mt-3 text-3xl font-bold text-zinc-950">{value}</p></>;
}

function toProductRows(items: StatisticsProduct[]): TopProductRow[] {
  return items.map((product) => ({
    categoria: product.category,
    id: product.id,
    producto: product.name,
    stockActual: product.stockAvailable,
    stockReservado: product.stockReserved,
    unidadesVendidas: product.unitsSold,
    ventasBrutas: product.revenue,
  }));
}

function toProductSalesSeries(items: StatisticsProductSeriesPoint[]): ProductSalesPoint[] {
  return items.map((point) => ({
    facturacion: point.revenue,
    label: formatSeriesLabel(point.bucket),
    unidades: point.unitsSold,
  }));
}

function toInventoryAlertRows(groups: StatisticsInventoryAlertGroup[]): InventoryAlertGroup[] {
  return groups.map((group, index) => ({
    id: `${group.type}-${index}`,
    items: group.items.map((item) => item.name),
    label: inventoryAlertLabels[group.type] ?? group.type,
  }));
}

function formatSeriesLabel(bucket: string): string {
  const date = new Date(bucket);
  return Number.isNaN(date.getTime()) ? bucket : seriesDateFormatter.format(date);
}
