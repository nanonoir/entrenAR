import { Suspense } from "react";
import {
  AccountDashboardClient,
  AccountDashboardFallback,
} from "@/components/shop/account/AccountDashboardClient";
import type { AccountOrder } from "@/types/account";
import type { WishlistProduct } from "@/types/account";

type AccountDashboardProps = {
  orders: AccountOrder[];
  products: WishlistProduct[];
};

export function AccountDashboard({ orders, products }: AccountDashboardProps) {
  return (
    <Suspense fallback={<AccountDashboardFallback />}>
      <AccountDashboardClient orders={orders} products={products} />
    </Suspense>
  );
}
