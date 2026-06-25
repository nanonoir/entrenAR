import { Badge } from "@/components/ui/Badge";
import type { ShippingConfigStatus } from "@/lib/data/admin/shipping/shipping-config";

export function shippingStatusLabel(status: ShippingConfigStatus) {
  if (status === "active") return "ACTIVADO";
  if (status === "configured_inactive") return "DESACTIVADO";
  return "NO CONFIGURADO";
}

export function ShippingStatusBadge({ status }: { status: ShippingConfigStatus }) {
  const tone = status === "active" ? "success" : status === "configured_inactive" ? "warning" : "neutral";
  return <Badge tone={tone}>{shippingStatusLabel(status)}</Badge>;
}
