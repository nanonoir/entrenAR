"use client";

import { create } from "zustand";

type UIState = {
  isCartOpen: boolean;
  isMobileMenuOpen: boolean;
  activeMegaMenu: string | null;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  openMobileMenu: () => void;
  closeMobileMenu: () => void;
  setActiveMegaMenu: (slug: string | null) => void;
};

export const useUIStore = create<UIState>((set) => ({
  isCartOpen: false,
  isMobileMenuOpen: false,
  activeMegaMenu: null,
  openCart: () => set({ isCartOpen: true }),
  closeCart: () => set({ isCartOpen: false }),
  toggleCart: () => set((state) => ({ isCartOpen: !state.isCartOpen })),
  openMobileMenu: () => set({ isMobileMenuOpen: true }),
  closeMobileMenu: () => set({ isMobileMenuOpen: false }),
  setActiveMegaMenu: (slug) => set({ activeMegaMenu: slug }),
}));
