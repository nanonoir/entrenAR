import { Badge } from "@/components/ui/Badge";
import type { DiscountStatus } from "@/lib/data/admin/discounts/types";

export function DiscountStatusBadge({ status }: { status: DiscountStatus }) {
  return <Badge tone={status === "active" ? "success" : "neutral"}>{status === "active" ? "Activado" : "Desactivado"}</Badge>;
}
