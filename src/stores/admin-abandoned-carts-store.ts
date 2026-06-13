"use client";

import { create } from "zustand";
import {
  mockAbandonedCarts,
  mockRecoveryConfig,
  mockRecoveryEmailTemplate,
} from "@/lib/data/admin/sales-flow/abandonedCarts";
import type {
  AbandonedCart,
  RecoveryConfig,
  RecoveryEmailTemplate,
} from "@/lib/data/admin/sales-flow/types";

type AdminAbandonedCartsState = {
  carts: AbandonedCart[];
  config: RecoveryConfig;
  template: RecoveryEmailTemplate;
  updateConfig: (config: Partial<RecoveryConfig>) => void;
  updateTemplate: (template: Partial<RecoveryEmailTemplate>) => void;
  markManualRecovery: (cartId: string) => void;
  sendRecoveryEmail: (cartId: string) => void;
};

export const useAdminAbandonedCartsStore = create<AdminAbandonedCartsState>()((set) => ({
  carts: mockAbandonedCarts,
  config: mockRecoveryConfig,
  template: mockRecoveryEmailTemplate,
  updateConfig: (config) => {
    set((state) => ({ config: { ...state.config, ...config } }));
  },
  updateTemplate: (template) => {
    set((state) => ({ template: { ...state.template, ...template } }));
  },
  markManualRecovery: (cartId) => {
    set((state) => ({
      carts: state.carts.map((cart) =>
        cart.id === cartId
          ? { ...cart, recoveryStatus: "manual" }
          : cart,
      ),
    }));
  },
  sendRecoveryEmail: (cartId) => {
    set((state) => ({
      carts: state.carts.map((cart) =>
        cart.id === cartId
          ? { ...cart, recoveryStatus: "sent", lastEmailSentAt: new Date().toISOString() }
          : cart,
      ),
    }));
  },
}));
