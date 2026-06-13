import type { AdminSale } from "@/lib/data/admin/sales-flow/types";

export function isSaleArchivable(sale: Pick<AdminSale, "paymentStatus" | "shippingStatus">) {
  return (
    sale.paymentStatus === "cancelled" ||
    sale.paymentStatus === "refunded" ||
    (sale.paymentStatus === "received" && sale.shippingStatus === "delivered")
  );
}

export function getSaleArchiveBlockReason(sale: Pick<AdminSale, "paymentStatus" | "shippingStatus">) {
  if (isSaleArchivable(sale)) return undefined;
  return "Sólo podés archivar ventas canceladas, reintegradas o entregadas con pago recibido.";
}
