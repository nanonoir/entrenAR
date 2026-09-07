import { AuthenticationSection } from "@/components/shop/account/sections/AuthenticationSection";
import { AddressesSection } from "@/components/shop/account/sections/AddressesSection";
import { OrdersSection } from "@/components/shop/account/sections/OrdersSection";
import { PaymentMethodsSection } from "@/components/shop/account/sections/PaymentMethodsSection";
import { ProfileSection } from "@/components/shop/account/sections/ProfileSection";
import { WishlistSection } from "@/components/shop/account/sections/WishlistSection";
import type {
  AccountAddress,
  AccountAsyncStatus,
  AccountOperationError,
  AccountOrder,
  AccountProfile,
  AccountSection,
} from "@/types/account";
import type { ProductSummary } from "@/types/product";

type AccountSectionPanelProps = {
  activeSection: AccountSection;
  addresses: AccountAddress[];
  onRetryOrders: () => void;
  orders: AccountOrder[];
  ordersError: AccountOperationError | null;
  ordersStatus: AccountAsyncStatus;
  products: ProductSummary[];
  profile: AccountProfile | null;
  userEmail: string;
};

export function AccountSectionPanel({
  activeSection,
  addresses,
  onRetryOrders,
  orders,
  ordersError,
  ordersStatus,
  products,
  profile,
  userEmail,
}: AccountSectionPanelProps) {
  if (activeSection === "perfil") {
    return <ProfileSection profile={profile} userEmail={userEmail} />;
  }

  if (activeSection === "direcciones") {
    return <AddressesSection addresses={addresses} userEmail={userEmail} />;
  }

  if (activeSection === "pedidos") {
    return <OrdersSection error={ordersError} onRetry={onRetryOrders} orders={orders} status={ordersStatus} />;
  }

  if (activeSection === "metodos-de-pago") {
    return <PaymentMethodsSection />;
  }

  if (activeSection === "lista-de-deseados") {
    return <WishlistSection products={products} userEmail={userEmail} />;
  }

  return <AuthenticationSection email={profile?.email ?? userEmail} />;
}
