"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { AccountState } from "@/components/shop/account/AccountState";
import { AccountLayout } from "@/components/shop/account/dashboard/AccountLayout";
import { QuickBuyController } from "@/components/shop/quick-buy/QuickBuyController";
import { accountRoutes } from "@/lib/routes";
import { ACCOUNT_ASYNC_STATUS, ACCOUNT_ROLE } from "@/types/account";
import { useAccountProfileStore } from "@/stores/account-profile-store";
import { useAuthStore } from "@/stores/auth-store";
import { useUIStore } from "@/stores/ui-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import { isAccountSection } from "@/lib/account-sections";
import type { AccountOrder, AccountSection } from "@/types/account";
import type { ProductSummary } from "@/types/product";

type AccountDashboardClientProps = {
  orders: AccountOrder[];
  products: ProductSummary[];
};

export function AccountDashboardClient({ orders, products }: AccountDashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openAccountDrawer = useUIStore((state) => state.openAccountDrawer);
  const user = useAuthStore((state) => state.user);
  const authStatus = useAuthStore((state) => state.status);
  const authError = useAuthStore((state) => state.error);
  const bootstrapAuth = useAuthStore((state) => state.bootstrap);
  const logout = useAuthStore((state) => state.logout);
  const bootstrapProfile = useAccountProfileStore((state) => state.bootstrap);
  const profilesByEmail = useAccountProfileStore((state) => state.profilesByEmail);
  const addressesByEmail = useAccountProfileStore((state) => state.addressesByEmail);
  const wishlistProductIds = useWishlistStore((state) => state.productIds);
  const bootstrapWishlist = useWishlistStore((state) => state.bootstrap);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const routeSection = searchParams.get("seccion");
  const initialSection = isAccountSection(routeSection) ? routeSection : null;
  const [selectedSection, setSelectedSection] = useState<AccountSection | null>(null);
  const [mobileContentOpen, setMobileContentOpen] = useState(Boolean(initialSection));
  const activeSection = selectedSection ?? initialSection ?? "perfil";

  useEffect(() => {
    let cancelled = false;

    async function hydrateAccount() {
      setHydrated(false);

      await Promise.all([
        useAuthStore.persist.rehydrate(),
        useAccountProfileStore.persist.rehydrate(),
        useWishlistStore.persist.rehydrate(),
      ]);

      if (cancelled) {
        return;
      }

      const authenticated = await bootstrapAuth();
      const currentUser = useAuthStore.getState().user;

      if (authenticated && currentUser?.role === ACCOUNT_ROLE.CUSTOMER) {
        await Promise.all([
          bootstrapProfile(currentUser.email),
          bootstrapWishlist(currentUser.email),
        ]);
      }

      if (!cancelled) {
        setHydrated(true);
      }
    }

    void hydrateAccount();

    return () => {
      cancelled = true;
    };
  }, [bootstrapAttempt, bootstrapAuth, bootstrapProfile, bootstrapWishlist]);

  useEffect(() => {
    if (!hydrated || !user || user.role !== ACCOUNT_ROLE.CUSTOMER) {
      return;
    }

    void Promise.all([
      bootstrapProfile(user.email),
      bootstrapWishlist(user.email),
    ]);
  }, [bootstrapProfile, bootstrapWishlist, hydrated, user]);

  const profile = user ? profilesByEmail[user.email] : null;
  const addresses = user ? addressesByEmail[user.email] ?? [] : [];
  const wishlistProducts = products.filter((product) => wishlistProductIds.includes(product.id));
  const displayName = profile?.firstName || user?.name || "Cliente";

  function selectSection(section: AccountSection) {
    setSelectedSection(section);
    setMobileContentOpen(true);
    router.push(`${accountRoutes.profile}?seccion=${section}`, { scroll: false });
  }

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    await logout();
    router.push(accountRoutes.profile);
    setSelectedSection(null);
    setMobileContentOpen(false);
    setIsLoggingOut(false);
  }

  function retryBootstrap() {
    useAuthStore.setState({
      error: null,
      isBootstrapped: false,
      status: ACCOUNT_ASYNC_STATUS.IDLE,
    });
    setHydrated(false);
    setBootstrapAttempt((attempt) => attempt + 1);
  }

  if (!hydrated) {
    return <AccountDashboardFallback />;
  }

  if (!user) {
    return (
      <Container className="py-12" size="wide">
        <AccountState
          empty={
            <EmptyState
              action={<Button onClick={openAccountDrawer}>Iniciar sesión / Registrarse</Button>}
              description="Accedé para ver tu perfil, direcciones, pedidos y lista de deseados."
              title="Tu cuenta todavía no está activa"
            />
          }
          error={authError}
          hasData={false}
          isEmpty={authStatus === ACCOUNT_ASYNC_STATUS.SUCCESS}
          onRetry={retryBootstrap}
          status={authStatus}
        >
          {null}
        </AccountState>
      </Container>
    );
  }

  if (user.role !== ACCOUNT_ROLE.CUSTOMER) {
    return (
      <Container className="py-12" size="wide">
        <EmptyState
          action={
            <Button disabled={isLoggingOut} onClick={() => void handleLogout()}>
              {isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
            </Button>
          }
          description="Esta sección está disponible para cuentas de cliente."
          title="Mi cuenta no está disponible"
        />
      </Container>
    );
  }

  return (
    <QuickBuyController>
      <AccountLayout
        activeSection={activeSection}
        addresses={addresses}
        displayName={displayName}
        mobileContentOpen={mobileContentOpen}
        onBackToMenu={() => setMobileContentOpen(false)}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
        onSelectSection={selectSection}
        orders={orders}
        products={wishlistProducts}
        profile={profile}
        userEmail={user.email}
      />
    </QuickBuyController>
  );
}

export function AccountDashboardFallback() {
  return (
    <Container className="py-12" size="wide">
      <div className="h-60 rounded-card border border-border bg-surface" />
    </Container>
  );
}
