"use client";

import { useState } from "react";
import { useAuthStore } from "@/stores/auth-store";

export function useFavoriteProduct() {
  const user = useAuthStore((state) => state.user);
  const [favoriteAuthModalOpen, setFavoriteAuthModalOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  function toggleFavorite() {
    if (!user) {
      setFavoriteAuthModalOpen(true);
      return;
    }

    setIsFavorite((current) => !current);
  }

  function closeFavoriteAuthModal() {
    setFavoriteAuthModalOpen(false);
  }

  return {
    closeFavoriteAuthModal,
    favoriteAuthModalOpen,
    isFavorite,
    toggleFavorite,
  };
}
