"use client";

import { create } from "zustand";
import { initialPickupPoints, initialShippingProviders } from "@/lib/data/admin/shipping/shipping-config";
import type { PickupPoint, ShippingProviderConfig, ShippingProviderId } from "@/lib/data/admin/shipping/shipping-config";

type AdminShippingState = {
  activeTab: "providers" | "pickups";
  providers: ShippingProviderConfig[];
  pickupPoints: PickupPoint[];
  setActiveTab: (tab: "providers" | "pickups") => void;
  saveProviderConfig: (config: ShippingProviderConfig) => void;
  activateProvider: (providerId: ShippingProviderId) => void;
  deactivateProvider: (providerId: ShippingProviderId) => void;
  savePickupPoint: (pickupPoint: PickupPoint) => void;
  activatePickupPoint: (pickupPointId: string) => void;
  deactivatePickupPoint: (pickupPointId: string) => void;
};

function now() {
  return new Date().toISOString();
}

export const useAdminShippingStore = create<AdminShippingState>()((set) => ({
  activeTab: "providers",
  providers: initialShippingProviders,
  pickupPoints: initialPickupPoints,
  setActiveTab: (activeTab) => set({ activeTab }),
  saveProviderConfig: (config) => set((state) => ({
    providers: state.providers.map((provider) => provider.id === config.id ? { ...config, status: config.status === "active" ? "active" : "configured_inactive", updatedAt: now() } : provider),
  })),
  activateProvider: (providerId) => set((state) => ({
    providers: state.providers.map((provider) => provider.id === providerId ? { ...provider, status: "active", updatedAt: now() } : provider),
  })),
  deactivateProvider: (providerId) => set((state) => ({
    providers: state.providers.map((provider) => provider.id === providerId ? { ...provider, status: "configured_inactive", updatedAt: now() } : provider),
  })),
  savePickupPoint: (pickupPoint) => set((state) => {
    const nextPoint: PickupPoint = { ...pickupPoint, status: pickupPoint.status === "active" ? "active" : "configured_inactive", updatedAt: now() };
    return { pickupPoints: state.pickupPoints.some((point) => point.id === pickupPoint.id) ? state.pickupPoints.map((point) => point.id === pickupPoint.id ? nextPoint : point) : [...state.pickupPoints, nextPoint] };
  }),
  activatePickupPoint: (pickupPointId) => set((state) => ({
    pickupPoints: state.pickupPoints.map((point) => point.id === pickupPointId ? { ...point, status: "active", updatedAt: now() } : point),
  })),
  deactivatePickupPoint: (pickupPointId) => set((state) => ({
    pickupPoints: state.pickupPoints.map((point) => point.id === pickupPointId ? { ...point, status: "configured_inactive", updatedAt: now() } : point),
  })),
}));
