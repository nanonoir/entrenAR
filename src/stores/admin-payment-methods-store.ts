"use client";

import { create } from "zustand";
import type { PaymentProviderId, PaymentStatus } from "@/lib/data/admin/payment-methods";
import type { BankTransferFormValues } from "@/schemas/admin/payment-method-schemas";

export type PaymentProviderConfig = {
  id: PaymentProviderId;
  status: PaymentStatus;
  bankConfig?: BankTransferFormValues;
  selectedOptionId?: string;
};

type AdminPaymentMethodsState = {
  providers: Record<PaymentProviderId, PaymentProviderConfig>;
  activateProvider: (id: PaymentProviderId, config?: Partial<PaymentProviderConfig>) => void;
  updateProviderConfig: (id: PaymentProviderId, config: Partial<PaymentProviderConfig>) => void;
  deactivateProvider: (id: PaymentProviderId) => void;
};

const initialProviders: Record<PaymentProviderId, PaymentProviderConfig> = {
  "bank-transfer": { id: "bank-transfer", status: "inactive" },
  "mercado-pago": { id: "mercado-pago", status: "inactive" },
  stripe: { id: "stripe", status: "inactive" },
  payway: { id: "payway", status: "inactive" },
};

export const useAdminPaymentMethodsStore = create<AdminPaymentMethodsState>()((set) => ({
  providers: initialProviders,

  activateProvider: (id, config = {}) => {
    set((state) => ({
      providers: {
        ...state.providers,
        [id]: { ...state.providers[id], ...config, status: "active" },
      },
    }));
  },

  updateProviderConfig: (id, config) => {
    set((state) => ({
      providers: {
        ...state.providers,
        [id]: { ...state.providers[id], ...config },
      },
    }));
  },

  deactivateProvider: (id) => {
    set((state) => ({
      providers: {
        ...state.providers,
        [id]: { ...state.providers[id], status: "inactive" },
      },
    }));
  },
}));
