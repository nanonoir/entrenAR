"use client";

import { create } from "zustand";
import { customersRepository } from "@/lib/api/config";
import { MockCustomersRepository } from "@/lib/api/admin/customers/mock-customers.repository";
import type { CustomersRepository } from "@/lib/api/admin/customers/repository";
import type { CreateCustomerInput, Customer as ApiCustomer, CustomerDetailResult, CustomerListQuery, CustomerListResult, CustomerMutationResult as RepositoryCustomerMutationResult, UpdateCustomerInput } from "@/lib/api/admin/customers/types";
import { mockCustomers } from "@/lib/data/admin/customers/mock-customers";
import type { Customer as LegacyCustomer, CustomerAddress } from "@/lib/data/admin/customers/types";
import { normalizeOptionalField, type CustomerFormValues } from "@/schemas/admin/customer-schema";
import { useAdminSalesStore } from "@/stores/admin-sales-store";
import { useAdminToastStore } from "@/stores/admin-toast-store";

export type CustomerMutationResult = RepositoryCustomerMutationResult extends infer Result ? Result extends { ok: true; customerId: string } ? { ok: true; customerId: Result["customerId"] } : Result : never;

export type AdminCustomersStoreOptions = { fallbackRepository?: CustomersRepository; initialCustomers?: readonly LegacyCustomer[]; repository?: CustomersRepository };

export type AdminCustomersState = {
  customers: ApiCustomer[];
  dataSource: "api" | "mock";
  error: string | null;
  fallbackMessage: string | null;
  hasLoaded: boolean;
  isFallback: boolean;
  isLoading: boolean;
  createCustomer: (input: CustomerFormValues) => CustomerMutationResult; updateCustomer: (id: string, input: CustomerFormValues) => CustomerMutationResult;
  updateCustomerNotes: (id: string, notes: string) => void; anonymizeCustomer: (id: string) => void; isEmailAvailable: (email: string, currentCustomerId?: string) => boolean;
  fetchCustomers: (query?: CustomerListQuery) => Promise<void>; refreshCustomer: (id: string) => Promise<void>; retryLoad: () => Promise<void>;
};

const FALLBACK_MESSAGE = "No pudimos conectar con el backend. Mostramos datos locales hasta que se recupere.", FALLBACK_TOAST = "No pudimos conectar con el backend. Usando datos locales.", DEFAULT_ERROR = "No se pudo completar la operación de clientes.";

function now(): string {
  return new Date().toISOString();
}

function generateCustomerId(customers: readonly ApiCustomer[]): string {
  const max = customers.reduce((current, customer) => {
    const numericId = Number(customer.id.replace("cus_", ""));
    return Number.isNaN(numericId) ? current : Math.max(current, numericId);
  }, 0);
  return `cus_${String(max + 1).padStart(3, "0")}`;
}

function toAddress(input: CustomerFormValues): CustomerAddress | undefined {
  const hasAddress = [input.street, input.number, input.floorOrApartment, input.postalCode, input.neighborhood, input.city, input.provinceOrState]
    .some((value) => Boolean(value?.trim()));
  if (!hasAddress) return undefined;
  return {
    street: input.street?.trim() ?? "",
    number: input.number?.trim() ?? "",
    floorOrApartment: normalizeOptionalField(input.floorOrApartment),
    postalCode: input.postalCode?.trim() ?? "",
    neighborhood: normalizeOptionalField(input.neighborhood),
    city: input.city?.trim() ?? "",
    provinceOrState: input.provinceOrState?.trim() ?? "",
    country: input.country?.trim() || "Argentina",
  };
}

function cloneCustomer(customer: LegacyCustomer | ApiCustomer): ApiCustomer {
  return {
    ...customer,
    tags: [...(customer.tags ?? [])],
    ...(customer.address ? { address: { ...customer.address } } : {}),
    ...(customer.summary
      ? { summary: { ...customer.summary, ...(customer.summary.lastOrder ? { lastOrder: { ...customer.summary.lastOrder } } : {}) } }
      : {}),
  };
}

function optionalFormValue(value: string | undefined, mode: "create" | "update"): string | null | undefined {
  const normalized = normalizeOptionalField(value);
  return mode === "update" ? normalized ?? null : normalized;
}

function toRepositoryInput(input: CustomerFormValues, mode: "create" | "update"): CreateCustomerInput & UpdateCustomerInput {
  const optional = (value: string | undefined) => optionalFormValue(value, mode);
  return {
    city: optional(input.city),
    country: optional(input.country),
    dniOrCuil: optional(input.dniOrCuil),
    email: input.email.trim().toLowerCase(),
    floorOrApartment: optional(input.floorOrApartment),
    fullName: input.fullName.trim(),
    neighborhood: optional(input.neighborhood),
    number: optional(input.number),
    phone: optional(input.phone),
    postalCode: optional(input.postalCode),
    provinceOrState: optional(input.provinceOrState),
    street: optional(input.street),
    ...(mode === "create" ? { tags: [] } : {}),
  };
}

function optimisticCustomer(input: CustomerFormValues, id: string, existing?: ApiCustomer): ApiCustomer {
  const timestamp = now();
  return {
    ...(existing ? cloneCustomer(existing) : {}),
    id,
    fullName: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: normalizeOptionalField(input.phone),
    dniOrCuil: normalizeOptionalField(input.dniOrCuil),
    firstInteractionDate: existing?.firstInteractionDate ?? timestamp.slice(0, 10),
    address: toAddress(input),
    notes: existing?.notes ?? "",
    tags: [...(existing?.tags ?? [])],
    isAnonymized: false,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function anonymizedCustomer(customer: ApiCustomer, id: string): ApiCustomer {
  return {
    ...cloneCustomer(customer),
    fullName: `Cliente eliminado (${id})`,
    email: "",
    phone: undefined,
    dniOrCuil: undefined,
    address: undefined,
    notes: undefined,
    isAnonymized: true,
    updatedAt: now(),
  };
}

function unwrapMutation(result: RepositoryCustomerMutationResult): ApiCustomer {
  if (result.ok) return result.customer;
  throw result;
}

function localEmailAvailable(customers: readonly ApiCustomer[], email: string, currentCustomerId?: string): boolean {
  const normalized = email.trim().toLowerCase();
  return !customers.some((customer) => !customer.isAnonymized && customer.id !== currentCustomerId && customer.email.toLowerCase() === normalized);
}

function isRecoverableNetworkError(repository: CustomersRepository, error: unknown): boolean {
  if (repository.source !== "api") return false;
  const value = isRecord(error) ? error : {};
  const code = typeof value.code === "string" ? value.code : "";
  const message = typeof value.message === "string" ? value.message : "";
  return code === "CUSTOMERS_API_UNAVAILABLE" || value.status === 503 || /offline|network|fetch failed|unavailable/i.test(message);
}

function toStoreError(error: unknown): string {
  const value = isRecord(error) ? error : {};
  return typeof value.message === "string" && value.message.trim() ? value.message : error instanceof Error && error.message.trim() ? error.message : DEFAULT_ERROR;
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }

export function createAdminCustomersStore(options: AdminCustomersStoreOptions = {}) {
  const configuredRepository = options.repository ?? customersRepository;
  const fallbackRepository = options.fallbackRepository ?? new MockCustomersRepository();
  const initialCustomers = (options.initialCustomers ?? mockCustomers).map(cloneCustomer);
  let activeRepository = configuredRepository;
  let fallbackToastShown = false;
  let lastQuery: CustomerListQuery = {};

  const loadingOperations = new Set<string>();
  const operationVersions = new Map<string, number>();

  return create<AdminCustomersState>()((set, get) => {
    const addToast = (message: string, tone: "success" | "error" | "info" = "success"): void => {
      if (typeof window !== "undefined") useAdminToastStore.getState().addToast(message, tone);
    };

    const activateFallback = (): void => {
      activeRepository = fallbackRepository;
      set({
        dataSource: fallbackRepository.source,
        fallbackMessage: FALLBACK_MESSAGE,
        isFallback: true,
      });
      if (!fallbackToastShown) {
        fallbackToastShown = true;
        addToast(FALLBACK_TOAST, "info");
      }
    };

    const beginOperation = (key: string): { token: string; version: number } => {
      const version = (operationVersions.get(key) ?? 0) + 1;
      const token = `${key}:${version}`;
      operationVersions.set(key, version);
      loadingOperations.add(token);
      set({ error: null, isLoading: true });
      return { token, version };
    };

    const isCurrentOperation = (key: string, version: number): boolean => operationVersions.get(key) === version;

    const finishOperation = (token: string): void => {
      loadingOperations.delete(token);
      set({ isLoading: loadingOperations.size > 0 });
    };

    const runWithFallback = async <T>(operation: (repository: CustomersRepository) => Promise<T>): Promise<T> => {
      try { return await operation(activeRepository); }
      catch (error) {
        if (!isRecoverableNetworkError(activeRepository, error)) throw error;
        activateFallback();
        return operation(activeRepository);
      }
    };

    const runRepository = async <T>(
      key: string,
      operation: (repository: CustomersRepository) => Promise<T>,
      commit: (result: T) => void,
      rollback?: () => void,
    ): Promise<void> => {
      const { token, version } = beginOperation(key);
      try {
        const result = await runWithFallback(operation);
        if (isCurrentOperation(key, version)) {
          commit(result);
          set({ error: null });
        }
      } catch (error) {
        if (isCurrentOperation(key, version)) {
          rollback?.();
          const message = toStoreError(error);
          set({ error: message });
          addToast(message, "error");
        }
      } finally {
        finishOperation(token);
      }
    };

    const commitCustomer = (customer: ApiCustomer, optimisticId?: string): void => {
      const next = cloneCustomer(customer);
      const targetId = optimisticId ?? next.id;
      set((state) => {
        const targetIndex = state.customers.findIndex((entry) => entry.id === targetId);
        if (targetIndex < 0) return { customers: [...state.customers, next] };
        if (targetId === next.id) {
          return { customers: state.customers.map((entry) => entry.id === targetId ? next : entry) };
        }

        const customers = state.customers.filter((entry) => entry.id !== targetId && entry.id !== next.id);
        customers.splice(Math.min(targetIndex, customers.length), 0, next);
        return { customers };
      });
    };

    const restoreCustomer = (customer: ApiCustomer): void => {
      const previous = cloneCustomer(customer);
      set((state) => ({
        customers: state.customers.some((entry) => entry.id === previous.id)
          ? state.customers.map((entry) => entry.id === previous.id ? previous : entry)
          : [...state.customers, previous],
      }));
    };

    const localFailure = (code: Extract<CustomerMutationResult, { ok: false }>['code'], message: string): CustomerMutationResult => {
      set({ error: message });
      addToast(message, "error");
      return { ok: false, code, message };
    };

    const checkEmailRemotely = async (email: string, currentCustomerId?: string): Promise<void> => {
      try {
        await runWithFallback((repository) => repository.isEmailAvailable(email, currentCustomerId));
      } catch (error) {
        set({ error: toStoreError(error) });
      }
    };

    return {
      customers: initialCustomers,
      dataSource: configuredRepository.source,
      error: null,
      fallbackMessage: null,
      hasLoaded: configuredRepository.source === "mock",
      isFallback: false,
      isLoading: false,

      isEmailAvailable: (email, currentCustomerId) => {
        const normalized = email.trim().toLowerCase();
        const available = localEmailAvailable(get().customers, normalized, currentCustomerId);
        if (!normalized) return available;
        void checkEmailRemotely(normalized, currentCustomerId);
        return available;
      },

      createCustomer: (input) => {
        if (!localEmailAvailable(get().customers, input.email)) {
          return localFailure("EMAIL_EXISTS", "Ya existe un cliente activo con ese e-mail.");
        }

        const id = generateCustomerId(get().customers);
        const optimistic = optimisticCustomer(input, id);
        set((state) => ({ customers: [...state.customers, optimistic], error: null }));
        addToast("Cliente agregado correctamente.");
        void runRepository(
          `customer:${id}`,
          (repository) => repository.create(toRepositoryInput(input, "create")).then(unwrapMutation),
          (customer) => commitCustomer(customer, id),
          () => set((state) => ({ customers: state.customers.filter((entry) => entry.id !== id) })),
        );
        return { ok: true, customerId: id };
      },

      updateCustomer: (id, input) => {
        const existing = get().customers.find((customer) => customer.id === id);
        if (!existing) return localFailure("CUSTOMER_NOT_FOUND", "Cliente no encontrado.");
        if (existing.isAnonymized) return localFailure("CUSTOMER_ANONYMIZED", "No se puede editar un cliente anonimizado.");
        if (!localEmailAvailable(get().customers, input.email, id)) {
          return localFailure("EMAIL_EXISTS", "Ya existe un cliente activo con ese e-mail.");
        }

        const previous = cloneCustomer(existing);
        set((state) => ({ customers: state.customers.map((customer) => customer.id === id ? optimisticCustomer(input, id, customer) : customer), error: null }));
        addToast("Cliente actualizado correctamente.");
        void runRepository(
          `customer:${id}`,
          (repository) => repository.update(id, toRepositoryInput(input, "update")).then(unwrapMutation),
          (customer) => commitCustomer(customer, id),
          () => restoreCustomer(previous),
        );
        return { ok: true, customerId: id };
      },

      updateCustomerNotes: (id, notes) => {
        const existing = get().customers.find((customer) => customer.id === id);
        if (!existing || existing.isAnonymized) return;
        const previous = cloneCustomer(existing);
        const normalizedNotes = notes.trim();
        set((state) => ({ customers: state.customers.map((customer) => customer.id === id ? { ...customer, notes: normalizedNotes, updatedAt: now() } : customer), error: null }));
        addToast("Notas actualizadas correctamente.");
        void runRepository(
          `customer:${id}`,
          (repository) => repository.updateNotes(id, normalizedNotes).then(unwrapMutation),
          (customer) => commitCustomer(customer, id),
          () => restoreCustomer(previous),
        );
      },

      anonymizeCustomer: (id) => {
        const existing = get().customers.find((customer) => customer.id === id);
        if (!existing || existing.isAnonymized) return;
        const previous = cloneCustomer(existing);
        const optimistic = anonymizedCustomer(existing, id);
        set((state) => ({ customers: state.customers.map((customer) => customer.id === id ? optimistic : customer), error: null }));
        useAdminSalesStore.getState().anonymizeCustomerSales(id);
        addToast("Datos del cliente eliminados correctamente.");
        void runRepository(
          `customer:${id}`,
          (repository) => repository.anonymize(id).then(unwrapMutation),
          (customer) => commitCustomer(customer, id),
          () => restoreCustomer(previous),
        );
      },

      fetchCustomers: (query = {}) => {
        lastQuery = { ...query };
        return runRepository(
          "customers:list",
          (repository) => repository.list(query),
          (result: CustomerListResult) => set({ customers: result.items.map(cloneCustomer), hasLoaded: true }),
        );
      },

      refreshCustomer: (id) => runRepository(
        `customer:detail:${id}`,
        (repository) => repository.getById(id),
        (result: CustomerDetailResult) => {
          commitCustomer(result, id);
          set({ hasLoaded: true });
        },
      ),

      retryLoad: async () => {
        activeRepository = configuredRepository;
        fallbackToastShown = false;
        set({ dataSource: configuredRepository.source, error: null, fallbackMessage: null, isFallback: false });
        await get().fetchCustomers(lastQuery);
      },
    } satisfies AdminCustomersState;
  });
}

export const useAdminCustomersStore = createAdminCustomersStore();
