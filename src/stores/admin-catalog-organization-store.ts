"use client";

import { create } from "zustand";

type AdminCatalogOrganizationState = {
  categoryOrder: string[];
  saveCategoryOrder: (order: string[]) => void;
};

export const useAdminCatalogOrganizationStore = create<AdminCatalogOrganizationState>()((set) => ({
  categoryOrder: [],
  saveCategoryOrder: (order) => set({ categoryOrder: order }),
}));
