import { clearAdminAccessToken } from "@/lib/api/admin/auth/admin-access-token";
import { invalidateAdminRequests } from "@/lib/api/admin/client";
import { invalidateAdminSession } from "@/lib/api/admin/auth/admin-session-generation";
import { useAdminAbandonedCartsStore } from "./admin-abandoned-carts-store";
import { useAdminCategoriesStore } from "./admin-categories-store";
import { useAdminCatalogOrganizationStore } from "./admin-catalog-organization-store";
import { useAdminCustomersStore } from "./admin-customers-store";
import { useAdminDiscountsStore } from "./admin-discounts-store";
import { useAdminPaymentMethodsStore } from "./admin-payment-methods-store";
import { useAdminProductsStore } from "./admin-products-store";
import { useAdminSalesStore } from "./admin-sales-store";
import { resetAdminShippingState, useAdminShippingStore } from "./admin-shipping-store";
import { useAdminStatisticsStore } from "./admin-statistics-store";
import { useAdminToastStore } from "./admin-toast-store";

export function resetAdminState(): void {
  clearAdminAccessToken();
  invalidateAdminSession();
  invalidateAdminRequests();

  useAdminSalesStore.setState({ sales: [], purchaseOrders: [], error: null, fallbackMessage: null, hasLoaded: false, isFallback: false, isInitializing: false, isLoading: false, loadingOperations: [], status: "idle" });
  useAdminCustomersStore.setState({ customers: [], dataSource: "api", error: null, fallbackMessage: null, hasLoaded: false, isFallback: false, isLoading: false });
  useAdminAbandonedCartsStore.setState({ carts: [], selectedCart: null, summary: null, pagination: null, filters: {}, isLoading: false, isDetailLoading: false, isMutating: false, error: null, lastRecoveryLink: null, source: "api", hasLoaded: false, isFallback: false, fallbackMessage: null });
  useAdminStatisticsStore.setState({ period: "current-week", customRange: undefined, overview: { data: null, error: null, isLoading: false }, sales: { data: null, error: null, isLoading: false }, products: { data: null, error: null, isLoading: false }, customers: { data: null, error: null, isLoading: false }, coupons: { data: null, error: null, isLoading: false } });
  useAdminPaymentMethodsStore.setState({ providers: { "bank-transfer": { id: "bank-transfer", status: "inactive" }, "mercado-pago": { id: "mercado-pago", status: "inactive" }, payway: { id: "payway", status: "inactive" }, stripe: { id: "stripe", status: "inactive" } }, error: null, hasLoaded: false, isEmpty: true, source: "api", status: "idle" });
  useAdminShippingStore.setState({ activeTab: "providers", providers: [], pickupPoints: [], error: null, hasLoaded: false, isEmpty: true, pickupPointsEmpty: true, providersEmpty: true, source: "api", status: "idle" });
  resetAdminShippingState();
  useAdminDiscountsStore.setState({ coupons: [], couponsEmpty: true, shippingDiscounts: [], shippingDiscountsEmpty: true, error: null, hasLoaded: false, isEmpty: true, source: "api", status: "idle" });
  useAdminProductsStore.setState({ products: [], stockHistory: [], selectedProductIds: [], isInitializing: false, error: null });
  useAdminCategoriesStore.setState({ categories: [] });
  useAdminCatalogOrganizationStore.setState({ categoryOrder: [] });
  useAdminToastStore.setState({ toasts: [] });
}
