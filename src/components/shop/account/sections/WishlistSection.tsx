"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { WishlistProductCard } from "@/components/shop/account/cards/WishlistProductCard";
import { SectionHeader } from "@/components/shop/account/dashboard/SectionHeader";
import { useWishlistStore } from "@/stores/wishlist-store";
import type { ProductSummary } from "@/types/product";

type WishlistSectionProps = {
  products: ProductSummary[];
};

export function WishlistSection({ products }: WishlistSectionProps) {
  const removeProduct = useWishlistStore((state) => state.removeProduct);

  return (
    <div>
      <SectionHeader title="Lista de Deseados" />
      {products.length === 0 ? (
        <EmptyState
          description="Marcá productos con el corazón para verlos en esta lista."
          title="No tenés productos favoritos"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <WishlistProductCard key={product.id} onRemove={removeProduct} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
