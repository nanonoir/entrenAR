import type { AdminSale } from "@/lib/data/admin/sales-flow/types";

type ArchiveSale = Pick<AdminSale, "paymentStatus" | "shippingStatus"> & Partial<Pick<AdminSale, "status">>;

/** Cancellation is an order state: financial statuses such as refunded can coexist with it. */
export function isSaleCancelled(sale: ArchiveSale) {
  return sale.status === "cancelled" || sale.paymentStatus === "cancelled" || sale.shippingStatus === "cancelled";
}

/** Mirrors the backend `canArchiveSale` guard. */
export function isSaleArchivable(sale: ArchiveSale) {
  return (
    isSaleCancelled(sale) ||
    ((sale.paymentStatus === "received" || sale.paymentStatus === "partially_refunded") && sale.shippingStatus === "delivered")
  );
}

export function getSaleArchiveBlockReason(sale: ArchiveSale) {
  if (isSaleArchivable(sale)) return undefined;
  return "Sólo podés archivar ventas canceladas o entregadas con pago recibido o reembolsado parcialmente.";
}
