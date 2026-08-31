"use client";

import { create } from "zustand";
import { DATA_SOURCE, getCommerceRepository, type DataSource } from "@/lib/api/commerce/commerce.repository";
import type { UpdatePaymentMethodDTO } from "@/lib/api/commerce/commerce.repository";
import { paymentProviderOrder, type PaymentProviderId, type PaymentStatus } from "@/lib/data/admin/payment-methods";
import type { BankTransferFormValues } from "@/schemas/admin/payment-method-schemas";
import {
  COMMERCE_ASYNC_STATUS,
  toCommerceStoreError,
  type CommerceAsyncStatus,
  type CommerceStoreError,
} from "@/stores/admin-commerce-state";

export type PaymentProviderConfig = {
  id: PaymentProviderId;
  status: PaymentStatus;
  bankConfig?: BankTransferFormValues;
  selectedOptionId?: string;
};

export type AdminPaymentMethodsState = {
  clearError: () => void;
  error: CommerceStoreError | null;
  hasLoaded: boolean;
  isEmpty: boolean;
  load: () => Promise<boolean>;
  providers: Record<PaymentProviderId, PaymentProviderConfig>;
  activateProvider: (id: PaymentProviderId, config?: Partial<PaymentProviderConfig>) => Promise<boolean>;
  updateProviderConfig: (id: PaymentProviderId, config: Partial<PaymentProviderConfig>) => Promise<boolean>;
  deactivateProvider: (id: PaymentProviderId) => Promise<boolean>;
  source: DataSource;
  status: CommerceAsyncStatus;
};

let operationSequence = 0;

const configuredRepository = getCommerceRepository();
const initialProviders = createInitialProviders();
const initialSource = configuredRepository.source;

export const useAdminPaymentMethodsStore = create<AdminPaymentMethodsState>()((set, get) => ({
  clearError: () => set((state) => ({
    error: null,
    status: state.hasLoaded ? COMMERCE_ASYNC_STATUS.SUCCESS : COMMERCE_ASYNC_STATUS.IDLE,
  })),
  error: null,
  hasLoaded: initialSource === DATA_SOURCE.MOCK,
  isEmpty: initialSource === DATA_SOURCE.API,
  load: () => loadPaymentMethods(set),
  providers: initialProviders,
  source: initialSource,
  status: initialSource === DATA_SOURCE.MOCK ? COMMERCE_ASYNC_STATUS.SUCCESS : COMMERCE_ASYNC_STATUS.IDLE,

  activateProvider: (id, config = {}) => {
    return updatePaymentMethod(set, get, id, config, "active");
  },

  updateProviderConfig: (id, config) => {
    return updatePaymentMethod(set, get, id, config, get().providers[id].status);
  },

  deactivateProvider: (id) => {
    return updatePaymentMethod(set, get, id, {}, "inactive");
  },
}));

type PaymentStoreSetter = (
  partial: Partial<AdminPaymentMethodsState> | ((state: AdminPaymentMethodsState) => Partial<AdminPaymentMethodsState>),
) => void;

type PaymentStoreGetter = () => AdminPaymentMethodsState;

async function loadPaymentMethods(set: PaymentStoreSetter): Promise<boolean> {
  const repository = getCommerceRepository();
  const operationId = ++operationSequence;
  set({ error: null, source: repository.source, status: COMMERCE_ASYNC_STATUS.LOADING });

  try {
    const methods = await repository.getPaymentMethods();
    if (operationId !== operationSequence) return false;

    set({
      error: null,
      hasLoaded: true,
      isEmpty: methods.length === 0,
      providers: providersFromMethods(methods),
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.SUCCESS,
    });
    return true;
  } catch (error) {
    if (operationId !== operationSequence) return false;

    set({
      error: toCommerceStoreError(error, "PAYMENT_METHODS_LOAD_FAILED", "The payment methods could not be loaded."),
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.ERROR,
    });
    return false;
  }
}

function updatePaymentMethod(
  set: PaymentStoreSetter,
  get: PaymentStoreGetter,
  id: PaymentProviderId,
  config: Partial<PaymentProviderConfig>,
  status: PaymentStatus,
): Promise<boolean> {
  const repository = getCommerceRepository();
  const previousProviders = get().providers;
  const current = previousProviders[id];
  const nextConfig: PaymentProviderConfig = {
    ...current,
    ...config,
    id,
    status: config.status ?? status,
  };
  const input = toPaymentMethodInput(id, current, nextConfig);
  const operationId = ++operationSequence;

  if (repository.source === DATA_SOURCE.MOCK) {
    set({
      error: null,
      hasLoaded: true,
      isEmpty: false,
      providers: {
        ...previousProviders,
        [id]: nextConfig,
      },
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.LOADING,
    });
  } else {
    set({ error: null, source: repository.source, status: COMMERCE_ASYNC_STATUS.LOADING });
  }

  return repository.updatePaymentMethod(id, input).then((updated) => {
    if (operationId !== operationSequence) return false;

    set((state) => ({
      error: null,
      hasLoaded: true,
      isEmpty: false,
      providers: {
        ...state.providers,
        [id]: toPaymentProviderConfig(updated),
      },
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.SUCCESS,
    }));
    return true;
  }).catch((error: unknown) => {
    if (operationId !== operationSequence) return false;

    const operationError = toCommerceStoreError(error, "PAYMENT_METHOD_UPDATE_FAILED", "The payment method could not be updated.");
    if (repository.source === DATA_SOURCE.MOCK) {
      set({ error: operationError, providers: previousProviders, source: repository.source, status: COMMERCE_ASYNC_STATUS.ERROR });
    } else {
      set({ error: operationError, source: repository.source, status: COMMERCE_ASYNC_STATUS.ERROR });
    }
    return false;
  });
}

function createInitialProviders(): Record<PaymentProviderId, PaymentProviderConfig> {
  return paymentProviderOrder.reduce<Record<PaymentProviderId, PaymentProviderConfig>>((providers, id) => {
    providers[id] = { id, status: "inactive" };
    return providers;
  }, {
    "bank-transfer": { id: "bank-transfer", status: "inactive" },
    "mercado-pago": { id: "mercado-pago", status: "inactive" },
    payway: { id: "payway", status: "inactive" },
    stripe: { id: "stripe", status: "inactive" },
  });
}

function providersFromMethods(methods: Awaited<ReturnType<ReturnType<typeof getCommerceRepository>["getPaymentMethods"]>>): Record<PaymentProviderId, PaymentProviderConfig> {
  return methods.reduce<Record<PaymentProviderId, PaymentProviderConfig>>((providers, method) => {
    providers[method.id] = toPaymentProviderConfig(method);
    return providers;
  }, createInitialProviders());
}

function toPaymentProviderConfig(method: Awaited<ReturnType<ReturnType<typeof getCommerceRepository>["getPaymentMethods"]>>[number]): PaymentProviderConfig {
  return {
    ...(method.bankConfig ? { bankConfig: { ...method.bankConfig } } : {}),
    ...(method.selectedOptionId ? { selectedOptionId: method.selectedOptionId } : {}),
    id: method.id,
    status: method.status,
  };
}

function toPaymentMethodInput(
  id: PaymentProviderId,
  current: PaymentProviderConfig,
  next: PaymentProviderConfig,
): UpdatePaymentMethodDTO {
  return {
    bankConfig: id === "bank-transfer" ? next.bankConfig : null,
    selectedOptionId: next.selectedOptionId ?? current.selectedOptionId ?? null,
    status: next.status,
  };
}
