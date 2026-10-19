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
import type {
  InventoryAlertGroup,
  ProductSalesPoint,
  TopProductRow,
} from "@/lib/data/admin/statistics/products";
import { useAdminStatisticsStore } from "@/stores/admin-statistics-store";

const MAX_ALERT_ITEMS = 10;
const EMPTY_VALUE = "—";

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

  const productRows = products.data?.topProducts ? toProductRows(products.data.topProducts) : [];
  const metrics = {
    grossSales: products.data?.metrics.revenue?.current,
    reservedStock: products.data?.metrics.stockReserved?.current,
    unitsSold: products.data?.metrics.unitsSold?.current,
  };
  const maxUnits = Math.max(...productRows.map((product) => product.unidadesVendidas), 0);
  const salesSeries = products.data?.series ? toProductSalesSeries(products.data.series) : [];
  const alertGroups = products.data?.inventoryAlerts ? toInventoryAlertRows(products.data.inventoryAlerts) : [];
  const emptyMessage = products.isLoading ? "Cargando datos…" : products.error ? "No se pudieron cargar los datos." : "Sin ventas de productos en el período seleccionado.";

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
        <AdminCard><Metric label="Unidades vendidas" value={formatMetric(metrics.unitsSold, formatter)} /></AdminCard>
        <AdminCard><Metric label="Ventas brutas por producto" value={formatMetric(metrics.grossSales, currencyFormatter)} /></AdminCard>
        <AdminCard><Metric label="Stock reservado" value={formatMetric(metrics.reservedStock, formatter)} /></AdminCard>
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
                {productRows.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-zinc-500">{emptyMessage}</td></tr>
                ) : productRows.map((product) => (
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
          {salesSeries.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">{emptyMessage}</p>
          ) : (
            <AdminLineChart data={salesSeries} lines={[{ dataKey: "unidades", name: "Unidades", color: "#39b000" }, { dataKey: "facturacion", name: "Facturación", color: "#18181b" }]} />
          )}
        </AdminCard>

        <AdminCard>
          <AdminCardHeader title="Alertas de inventario" description="Categorías accionables para reposición." />
          <div className="grid gap-4 sm:grid-cols-2">
            {alertGroups.length === 0 ? <p className="text-sm text-zinc-500 sm:col-span-2">{products.isLoading ? "Cargando datos…" : products.error ? "No se pudieron cargar los datos." : "Sin alertas de inventario."}</p> : null}
            {alertGroups.map((group) => (
              <div key={group.id} className="rounded-2xl bg-zinc-50 p-4">
                <h3 className="font-semibold text-zinc-950">{group.label} <span className="font-normal text-zinc-500">({formatter.format(group.total)})</span></h3>
                <ul className="mt-3 grid gap-2 text-sm text-zinc-600">
                  {group.items.map((item) => <li key={item.id} className="truncate" title={item.name}>• {item.name}</li>)}
                </ul>
                {group.total > group.items.length ? <p className="mt-3 text-xs font-medium text-zinc-500">+{formatter.format(group.total - group.items.length)} más. Revisalos en Inventario.</p> : null}
              </div>
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
    items: group.items.slice(0, MAX_ALERT_ITEMS).map((item) => ({ id: item.id, name: item.name })),
    label: inventoryAlertLabels[group.type] ?? group.type,
    total: group.items.length,
  }));
}

function formatMetric(value: number | undefined, format: Intl.NumberFormat): string {
  return value === undefined ? EMPTY_VALUE : format.format(value);
}

function formatSeriesLabel(bucket: string): string {
  const date = new Date(bucket);
  return Number.isNaN(date.getTime()) ? bucket : seriesDateFormatter.format(date);
}
