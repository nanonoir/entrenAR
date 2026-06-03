import { Suspense } from "react";
import {
  AccountDashboardClient,
  AccountDashboardFallback,
} from "@/components/shop/account/AccountDashboardClient";
import type { AccountOrder } from "@/types/account";
import type { ProductSummary } from "@/types/product";

type AccountDashboardProps = {
  orders: AccountOrder[];
  products: ProductSummary[];
};

export function AccountDashboard({ orders, products }: AccountDashboardProps) {
  return (
    <Suspense fallback={<AccountDashboardFallback />}>
      <AccountDashboardClient orders={orders} products={products} />
    </Suspense>
  );
}
