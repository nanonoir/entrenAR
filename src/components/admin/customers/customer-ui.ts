import { formatARS, getPaymentStatusLabel, getPaymentStatusTone, getShippingStatusLabel, getShippingStatusTone } from "@/lib/data/admin/sales-flow/helpers";

export { formatARS, getPaymentStatusLabel, getPaymentStatusTone, getShippingStatusLabel, getShippingStatusTone };

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function customerExportFilename(scope: "list" | "detail", id?: string) {
  const date = new Date().toISOString().slice(0, 10);
  return scope === "list" ? `clientes-${date}.csv` : `cliente-${id}-${date}.csv`;
}
