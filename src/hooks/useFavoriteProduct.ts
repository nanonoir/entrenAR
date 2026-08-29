"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useWishlistStore } from "@/stores/wishlist-store";

export function useFavoriteProduct(productId: string) {
  const user = useAuthStore((state) => state.user);
  const isFavorite = useWishlistStore((state) => state.productIds.includes(productId));
  const favoriteError = useWishlistStore((state) => state.error);
  const isFavoritePending = useWishlistStore((state) => state.pendingProductIds.includes(productId));
  const toggleProduct = useWishlistStore((state) => state.toggleProduct);
  const [favoriteFeedbackKey, setFavoriteFeedbackKey] = useState(0);
  const [favoriteAuthModalOpen, setFavoriteAuthModalOpen] = useState(false);

  useEffect(() => {
    if (!useWishlistStore.persist.hasHydrated()) {
      void useWishlistStore.persist.rehydrate();
    }
  }, []);

  async function toggleFavorite() {
    if (!user) {
      setFavoriteAuthModalOpen(true);
      return;
    }

    const shouldAnimate = !isFavorite;
    const updated = await toggleProduct(productId, user.email);

    if (updated && shouldAnimate) {
      setFavoriteFeedbackKey((current) => current + 1);
    }
  }

  function closeFavoriteAuthModal() {
    setFavoriteAuthModalOpen(false);
  }

  return {
    closeFavoriteAuthModal,
    favoriteError,
    favoriteFeedbackKey,
    favoriteAuthModalOpen,
    isFavorite,
    isFavoritePending,
    toggleFavorite,
  };
}
