import { ShipTrackingCard } from "@/components/shop/account/cards/ShipTrackingCard";
import { SectionHeader } from "@/components/shop/account/dashboard/SectionHeader";
import type { AccountOrder } from "@/types/account";

type OrdersSectionProps = {
  orders: AccountOrder[];
};

export function OrdersSection({ orders }: OrdersSectionProps) {
  return (
    <div>
      <SectionHeader title="Pedidos" />
      <div className="grid gap-4">
        {orders.map((order) => (
          <ShipTrackingCard key={order.id} order={order} />
        ))}
      </div>
    </div>
  );
}
