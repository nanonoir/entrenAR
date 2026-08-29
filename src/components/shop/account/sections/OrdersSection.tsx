import { ShipTrackingCard } from "@/components/shop/account/cards/ShipTrackingCard";
import { SectionHeader } from "@/components/shop/account/dashboard/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AccountOrder } from "@/types/account";

type OrdersSectionProps = {
  orders: AccountOrder[];
};

export function OrdersSection({ orders }: OrdersSectionProps) {
  return (
    <div>
      <SectionHeader title="Pedidos" />
      {orders.length === 0 ? (
        <EmptyState
          description="Cuando hagas una compra, vas a poder seguirla desde acá."
          title="Todavía no tenés pedidos"
        />
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <ShipTrackingCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
