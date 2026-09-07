import { AccountDashboard } from "@/components/shop/account/AccountDashboard";
import { getAccountRepository } from "@/lib/api/account/account.repository";
import { getCatalogRepository } from "@/lib/api/catalog/catalog.repository";
import type { AccountOrder } from "@/types/account";

async function loadInitialAccountOrders(): Promise<AccountOrder[]> {
  try {
    return await getAccountRepository().listOrders({ limit: 100 });
  } catch {
    // The browser authenticates the account after this server component renders.
    return [];
  }
}

export default async function AccountPage() {
  const [orders, productsResult] = await Promise.all([
    loadInitialAccountOrders(),
    getCatalogRepository().getPublicProducts(),
  ]);
  const products = productsResult.status === "success" || productsResult.status === "empty"
    ? productsResult.data
    : [];

  return <AccountDashboard orders={orders} products={products} />;
}
