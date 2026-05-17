"use client";

import { useState } from "react";

export function useFavoriteProduct() {
  // Mock hasta implementar auth real y persistencia de favoritos en backend.
  const isAuthenticated = false;
  const [favoriteModalOpen, setFavoriteModalOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  function toggleFavorite() {
    if (!isAuthenticated) {
      setFavoriteModalOpen(true);
      return;
    }

    setIsFavorite((current) => !current);
  }

  function closeFavoriteModal() {
    setFavoriteModalOpen(false);
  }

  return {
    closeFavoriteModal,
    favoriteModalOpen,
    isFavorite,
    toggleFavorite,
  };
}
