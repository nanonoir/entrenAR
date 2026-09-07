import { ShipTrackingCard } from "@/components/shop/account/cards/ShipTrackingCard";
import { AccountState } from "@/components/shop/account/AccountState";
import { SectionHeader } from "@/components/shop/account/dashboard/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ACCOUNT_ASYNC_STATUS, type AccountAsyncStatus, type AccountOperationError, type AccountOrder } from "@/types/account";

type OrdersSectionProps = {
  error: AccountOperationError | null;
  onRetry: () => void;
  orders: AccountOrder[];
  status: AccountAsyncStatus;
};

export function OrdersSection({ error, onRetry, orders, status }: OrdersSectionProps) {
  return (
    <AccountState
      empty={
        <EmptyState
          description="Cuando hagas una compra, vas a poder seguirla desde acá."
          title="Todavía no tenés pedidos"
        />
      }
      error={error}
      hasData={orders.length > 0}
      isEmpty={status === ACCOUNT_ASYNC_STATUS.SUCCESS && orders.length === 0}
      loadingDescription="Estamos buscando los pedidos de tu cuenta."
      loadingTitle="Cargando tus pedidos"
      onRetry={onRetry}
      status={status}
    >
      <div>
        <SectionHeader title="Pedidos" />
        {orders.length > 0 ? (
          <div className="grid gap-4">
            {orders.map((order) => (
              <ShipTrackingCard key={order.id} order={order} />
            ))}
          </div>
        ) : null}
      </div>
    </AccountState>
  );
}
