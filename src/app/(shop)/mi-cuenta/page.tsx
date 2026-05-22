import { AccountDashboard } from "@/components/shop/account/AccountDashboard";
import { accountOrders } from "@/lib/data/account";
import { getAllProducts } from "@/lib/data/products";

export default function AccountPage() {
  return <AccountDashboard orders={accountOrders} products={getAllProducts()} />;
}
