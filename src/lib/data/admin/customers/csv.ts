import type { AdminSale } from "@/lib/data/admin/sales-flow/types";
import type { Customer, CustomerSalesSummary } from "@/lib/data/admin/customers/types";
import { formatCustomerAddress, getCustomerDisplayName } from "@/lib/formatting/customer";

const BOM = "\ufeff";
const SEPARATOR = ";";

function escapeCsv(value: string | number | undefined) {
  const rawText = String(value ?? "");
  const text = /^[=+\-@\t\r]/.test(rawText) ? `'${rawText}` : rawText;
  if (text.includes(SEPARATOR) || text.includes("\n") || text.includes('"')) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function row(values: Array<string | number | undefined>) {
  return values.map(escapeCsv).join(SEPARATOR);
}

export function buildCustomersCsv(customers: Customer[], summaries: Record<string, CustomerSalesSummary>) {
  const header = row(["ID", "Nombre y apellido", "E-mail", "Teléfono", "DNI/CUIL", "País", "Provincia/Estado", "Ciudad", "Dirección completa", "Total consumido", "Cantidad de ventas", "Última compra", "Primera interacción"]);
  const rows = customers.map((customer) => {
    const summary = summaries[customer.id] ?? { totalSpent: 0, ordersCount: 0 };
    const anonymized = customer.isAnonymized;
    return row([
      customer.id,
      getCustomerDisplayName(customer),
      anonymized ? "" : customer.email,
      anonymized ? "" : customer.phone,
      anonymized ? "" : customer.dniOrCuil,
      anonymized ? "" : customer.address?.country,
      anonymized ? "" : customer.address?.provinceOrState,
      anonymized ? "" : customer.address?.city,
      anonymized ? "" : formatCustomerAddress(customer.address),
      summary.totalSpent,
      summary.ordersCount,
      summary.lastOrder ? `${summary.lastOrder.number} ${summary.lastOrder.date}` : "",
      customer.firstInteractionDate,
    ]);
  });
  return BOM + [header, ...rows].join("\n");
}

export function buildCustomerDetailCsv(customer: Customer, summary: CustomerSalesSummary, sales: AdminSale[]) {
  if (customer.isAnonymized) return BOM + "";
  const header = row(["Campo", "Valor"]);
  const lines = [
    header,
    row(["ID", customer.id]),
    row(["Nombre y apellido", customer.fullName]),
    row(["E-mail", customer.email]),
    row(["Teléfono", customer.phone]),
    row(["DNI/CUIL", customer.dniOrCuil]),
    row(["Primera interacción", customer.firstInteractionDate]),
    row(["Dirección de envío", formatCustomerAddress(customer.address)]),
    row(["Total consumido", summary.totalSpent]),
    row(["Cantidad de ventas", summary.ordersCount]),
    row(["Última compra", summary.lastOrder ? `${summary.lastOrder.number} ${summary.lastOrder.date}` : ""]),
    row(["Notas internas", customer.notes]),
    row(["Historial de ventas", sales.map((sale) => `${sale.number} ${sale.createdAt} ${sale.total}`).join(" | ")]),
  ];
  return BOM + lines.join("\n");
}
