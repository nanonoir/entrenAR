import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/pricing";
import type { AccountOrder, AccountOrderStatus } from "@/types/account";

type ShipTrackingCardProps = {
  order: AccountOrder;
};

export function ShipTrackingCard({ order }: ShipTrackingCardProps) {
  return (
    <article className="overflow-hidden rounded-card border border-border bg-white shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-zinc-100 px-4 py-3">
        <div>
          <h3 className="font-subtitle text-lg font-semibold uppercase">Pedido {order.id}</h3>
          <p className="text-sm text-text-muted">{order.date}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <OrderStatusBadge status={order.status} />
          <span className="font-subtitle text-lg font-bold">{formatCurrency(order.total)}</span>
        </div>
      </header>
      <div className="grid gap-3 px-4 py-4">
        <p className="text-sm font-semibold text-text-muted">Seguimiento: {order.trackingCode}</p>
        {order.items.map((item) => (
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3" key={item.id}>
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-text-muted">Cantidad: {item.quantity}</p>
            </div>
            <span className="font-subtitle font-semibold">{formatCurrency(item.price)}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function OrderStatusBadge({ status }: { status: AccountOrderStatus }) {
  const labels: Record<AccountOrderStatus, string> = {
    preparacion: "En preparación",
    "en-camino": "En camino",
    entregado: "Entregado",
  };
  const tones: Record<AccountOrderStatus, "warning" | "accent" | "success"> = {
    preparacion: "warning",
    "en-camino": "accent",
    entregado: "success",
  };

  return <Badge tone={tones[status]}>{labels[status]}</Badge>;
}
