"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { AccountLayout } from "@/components/shop/account/dashboard/AccountLayout";
import { QuickBuyController } from "@/components/shop/quick-buy/QuickBuyController";
import { accountRoutes } from "@/lib/routes";
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
  const logout = useAuthStore((state) => state.logout);
  const ensureProfile = useAccountProfileStore((state) => state.ensureProfile);
  const profilesByEmail = useAccountProfileStore((state) => state.profilesByEmail);
  const addressesByEmail = useAccountProfileStore((state) => state.addressesByEmail);
  const wishlistProductIds = useWishlistStore((state) => state.productIds);
  const [hydrated, setHydrated] = useState(false);
  const routeSection = searchParams.get("seccion");
  const initialSection = isAccountSection(routeSection) ? routeSection : null;
  const [selectedSection, setSelectedSection] = useState<AccountSection | null>(null);
  const [mobileContentOpen, setMobileContentOpen] = useState(Boolean(initialSection));
  const activeSection = selectedSection ?? initialSection ?? "perfil";

  useEffect(() => {
    Promise.all([
      useAuthStore.persist.rehydrate(),
      useAccountProfileStore.persist.rehydrate(),
      useWishlistStore.persist.rehydrate(),
    ]).finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (user) {
      ensureProfile(user.email);
    }
  }, [ensureProfile, user]);

  const profile = user ? profilesByEmail[user.email] : null;
  const addresses = user ? addressesByEmail[user.email] ?? [] : [];
  const wishlistProducts = useMemo(
    () => products.filter((product) => wishlistProductIds.includes(product.id)),
    [products, wishlistProductIds],
  );
  const displayName = profile?.firstName || user?.name || "Cliente";

  function selectSection(section: AccountSection) {
    setSelectedSection(section);
    setMobileContentOpen(true);
    router.push(`${accountRoutes.profile}?seccion=${section}`, { scroll: false });
  }

  function handleLogout() {
    logout();
    router.push(accountRoutes.profile);
    setSelectedSection(null);
    setMobileContentOpen(false);
  }

  if (!hydrated) {
    return <AccountDashboardFallback />;
  }

  if (!user) {
    return (
      <Container className="py-12" size="wide">
        <EmptyState
          action={<Button onClick={openAccountDrawer}>Iniciar sesión / Registrarse</Button>}
          description="Accedé para ver tu perfil, direcciones, pedidos y lista de deseados."
          title="Tu cuenta todavía no está activa"
        />
      </Container>
    );
  }

  if (!profile) {
    return null;
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
