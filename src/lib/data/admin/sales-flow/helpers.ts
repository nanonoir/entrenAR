import type { AdminSale, SalePaymentStatus, SaleShippingStatus } from "@/lib/data/admin/sales-flow/types";
import { isSaleArchivable } from "@/lib/data/admin/sales-flow/archive";

// ARS currency formatter
export const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

export function formatARS(value: number): string {
  return arsFormatter.format(value);
}

export function formatShortDate(isoDate: string): string {
  const date = new Date(isoDate);
  const day = date.getDate();
  const month = date.toLocaleString("es-AR", { month: "short" });
  const time = date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day} ${month} ${time}`;
}

export function getPaymentStatusLabel(status: SalePaymentStatus): string {
  const labels: Record<SalePaymentStatus, string> = {
    pending: "Pendiente",
    received: "Recibido",
    cancelled: "Cancelado",
    refunded: "Reembolsado",
  };
  return labels[status];
}

export function getPaymentStatusTone(status: SalePaymentStatus): "warning" | "success" | "neutral" | "sale" {
  const tones: Record<SalePaymentStatus, "warning" | "success" | "neutral" | "sale"> = {
    pending: "warning",
    received: "success",
    cancelled: "neutral",
    refunded: "sale",
  };
  return tones[status];
}

export function getShippingStatusLabel(status: SaleShippingStatus): string {
  const labels: Record<SaleShippingStatus, string> = {
    to_pack: "Por empaquetar",
    to_ship: "Por enviar",
    shipped: "Enviado",
    delivered: "Entregado",
    pickup: "Por retirar",
    cancelled: "Cancelado",
  };
  return labels[status];
}

export function getShippingStatusTone(status: SaleShippingStatus): "warning" | "success" | "neutral" | "accent" | "sale" {
  const tones: Record<SaleShippingStatus, "warning" | "success" | "neutral" | "accent" | "sale"> = {
    to_pack: "warning",
    to_ship: "accent",
    shipped: "success",
    delivered: "success",
    pickup: "accent",
    cancelled: "neutral",
  };
  return tones[status];
}

export function calculateTotals(
  products: Array<{ quantity: number; unitPrice: number }>,
  discountType: "percentage" | "fixed" | undefined,
  discountValue: number | undefined,
  shippingCost: number,
): { subtotal: number; discount: number; total: number } {
  const subtotal = products.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0);
  let discount = 0;
  if (discountType === "percentage" && discountValue) {
    discount = Math.min(subtotal, subtotal * (discountValue / 100));
  } else if (discountType === "fixed" && discountValue) {
    discount = Math.min(subtotal, discountValue);
  }
  const total = Math.max(0, subtotal - discount + shippingCost);
  return { subtotal, discount, total };
}

export function getActiveSalesCount(sales: AdminSale[]): number {
  return sales.filter((s) => !s.archived && s.paymentStatus !== "cancelled").length;
}

export function getQuickFilterCounts(sales: AdminSale[]) {
  const active = sales.filter((s) => !s.archived);
  return {
    porCobrar: active.filter((s) => s.paymentStatus === "pending").length,
    porEmpaquetar: active.filter((s) => s.shippingStatus === "to_pack" && s.paymentStatus !== "cancelled").length,
    porEnviar: active.filter((s) => s.shippingStatus === "to_ship").length,
    porRetirar: active.filter((s) => s.shippingStatus === "pickup").length,
    porArchivar: active.filter(isSaleArchivable).length,
  };
}

export function generatePurchaseOrderId(): string {
  const year = new Date().getFullYear();
  const digits = String(Math.floor(100000 + Math.random() * 900000));
  return `OC-${year}-${digits}`;
}

export function generateNextSaleId(sales: AdminSale[]): string {
  const ids = sales.map((s) => parseInt(s.id, 10)).filter((n) => !isNaN(n));
  const max = ids.length > 0 ? Math.max(...ids) : 100;
  return String(max + 1);
}

export function generateEventId(): string {
  return `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function isSaleEditable(sale: AdminSale): boolean {
  const nonEditableShipping: AdminSale["shippingStatus"][] = ["to_ship", "shipped", "delivered", "cancelled"];
  if (nonEditableShipping.includes(sale.shippingStatus)) return false;
  if (sale.paymentStatus === "cancelled") return false;
  if (sale.archived) return false;
  return true;
}
