import { formatCurrency } from "@/lib/pricing";

export interface SummaryShippingInput {
  /** Cost quoted by the backend; only meaningful when `resolved`. */
  quotedShipping: number | null;
  refreshing: boolean;
  /** True only when the quote offers the exact service or pickup point the customer selected. */
  resolved: boolean;
}

export interface SummaryShippingDisplay {
  /** False while shipping is pending or refreshing: the total is provisional. */
  final: boolean;
  label: string;
}

/**
 * "Gratis" is only a quoted zero for a selected, valid service. Pending shipping reads "A calcular" and a
 * refreshing quote stays neutral, so a free-shipping threshold or an empty selection can never look free.
 */
export function getSummaryShippingDisplay({ quotedShipping, refreshing, resolved }: SummaryShippingInput): SummaryShippingDisplay {
  if (refreshing) return { final: false, label: "Calculando…" };
  if (!resolved || quotedShipping === null) return { final: false, label: "A calcular" };
  return { final: true, label: quotedShipping === 0 ? "Gratis" : formatCurrency(quotedShipping) };
}
