"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { AccountState } from "@/components/shop/account/AccountState";
import { WishlistProductCard } from "@/components/shop/account/cards/WishlistProductCard";
import { SectionHeader } from "@/components/shop/account/dashboard/SectionHeader";
import { useWishlistStore } from "@/stores/wishlist-store";
import { ACCOUNT_ASYNC_STATUS } from "@/types/account";
import type { ProductSummary } from "@/types/product";

type WishlistSectionProps = {
  products: ProductSummary[];
  userEmail: string;
};

export function WishlistSection({ products, userEmail }: WishlistSectionProps) {
  const loadWishlist = useWishlistStore((state) => state.load);
  const removeProduct = useWishlistStore((state) => state.removeProduct);
  const pendingProductIds = useWishlistStore((state) => state.pendingProductIds);
  const productIds = useWishlistStore((state) => state.productIds);
  const status = useWishlistStore((state) => state.status);
  const error = useWishlistStore((state) => state.error);
  const hasWishlistData = products.length > 0 || productIds.length > 0;

  return (
    <div>
      <SectionHeader title="Lista de Deseados" />
      <AccountState
        empty={
          <EmptyState
            description="Marcá productos con el corazón para verlos en esta lista."
            title="No tenés productos favoritos"
          />
        }
        error={error}
        hasData={hasWishlistData}
        isEmpty={!hasWishlistData}
        loadingTitle="Cargando tus favoritos"
        onRetry={() => loadWishlist(userEmail)}
        status={status}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <WishlistProductCard
              key={product.id}
              onRemove={(productId) => removeProduct(productId, userEmail)}
              pending={pendingProductIds.includes(product.id) || status === ACCOUNT_ASYNC_STATUS.LOADING}
              product={product}
            />
          ))}
        </div>
      </AccountState>
    </div>
  );
}
