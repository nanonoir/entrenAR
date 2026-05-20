"use client";

import { create } from "zustand";

type UIState = {
  isAccountDrawerOpen: boolean;
  isCartOpen: boolean;
  isMobileMenuOpen: boolean;
  activeMegaMenu: string | null;
  openAccountDrawer: () => void;
  closeAccountDrawer: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  openMobileMenu: () => void;
  closeMobileMenu: () => void;
  setActiveMegaMenu: (slug: string | null) => void;
};

export const useUIStore = create<UIState>((set) => ({
  isAccountDrawerOpen: false,
  isCartOpen: false,
  isMobileMenuOpen: false,
  activeMegaMenu: null,
  openAccountDrawer: () => set({ isAccountDrawerOpen: true }),
  closeAccountDrawer: () => set({ isAccountDrawerOpen: false }),
  openCart: () => set({ isCartOpen: true }),
  closeCart: () => set({ isCartOpen: false }),
  toggleCart: () => set((state) => ({ isCartOpen: !state.isCartOpen })),
  openMobileMenu: () => set({ isMobileMenuOpen: true }),
  closeMobileMenu: () => set({ isMobileMenuOpen: false }),
  setActiveMegaMenu: (slug) => set({ activeMegaMenu: slug }),
}));
