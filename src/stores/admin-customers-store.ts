"use client";

import { create } from "zustand";
import { mockCustomers } from "@/lib/data/admin/customers/mock-customers";
import type { Customer, CustomerAddress } from "@/lib/data/admin/customers/types";
import type { CustomerFormValues } from "@/schemas/admin/customer-schema";
import { normalizeOptionalField } from "@/schemas/admin/customer-schema";
import { useAdminSalesStore } from "@/stores/admin-sales-store";
import { useAdminToastStore } from "@/stores/admin-toast-store";

type CustomerMutationResult =
  | { ok: true; customerId: string }
  | { ok: false; code: "EMAIL_EXISTS" | "CUSTOMER_NOT_FOUND" | "CUSTOMER_ANONYMIZED"; message: string };

type AdminCustomersState = {
  customers: Customer[];
  createCustomer: (input: CustomerFormValues) => CustomerMutationResult;
  updateCustomer: (id: string, input: CustomerFormValues) => CustomerMutationResult;
  updateCustomerNotes: (id: string, notes: string) => void;
  anonymizeCustomer: (id: string) => void;
  isEmailAvailable: (email: string, currentCustomerId?: string) => boolean;
};

function now() {
  return new Date().toISOString();
}

function generateCustomerId(customers: Customer[]) {
  const max = customers.reduce((current, customer) => {
    const numericId = Number(customer.id.replace("cus_", ""));
    return Number.isNaN(numericId) ? current : Math.max(current, numericId);
  }, 0);
  return `cus_${String(max + 1).padStart(3, "0")}`;
}

function toAddress(input: CustomerFormValues): CustomerAddress | undefined {
  const hasAddress = [input.street, input.number, input.floorOrApartment, input.postalCode, input.neighborhood, input.city, input.provinceOrState].some((value) => value?.trim());
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

function addToast(message: string, tone: "success" | "error" | "info" = "success") {
  useAdminToastStore.getState().addToast(message, tone);
}

export const useAdminCustomersStore = create<AdminCustomersState>()((set, get) => ({
  customers: mockCustomers,

  isEmailAvailable: (email, currentCustomerId) => {
    const normalized = email.trim().toLowerCase();
    return !get().customers.some((customer) => !customer.isAnonymized && customer.id !== currentCustomerId && customer.email.toLowerCase() === normalized);
  },

  createCustomer: (input) => {
    if (!get().isEmailAvailable(input.email)) {
      return { ok: false, code: "EMAIL_EXISTS", message: "Ya existe un cliente activo con ese e-mail." };
    }
    const id = generateCustomerId(get().customers);
    const timestamp = now();
    const customer: Customer = {
      id,
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: normalizeOptionalField(input.phone),
      dniOrCuil: normalizeOptionalField(input.dniOrCuil),
      firstInteractionDate: timestamp.slice(0, 10),
      address: toAddress(input),
      notes: "",
      isAnonymized: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    set((state) => ({ customers: [...state.customers, customer] }));
    addToast("Cliente agregado correctamente.");
    return { ok: true, customerId: id };
  },

  updateCustomer: (id, input) => {
    const existing = get().customers.find((customer) => customer.id === id);
    if (!existing) return { ok: false, code: "CUSTOMER_NOT_FOUND", message: "Cliente no encontrado." };
    if (existing.isAnonymized) return { ok: false, code: "CUSTOMER_ANONYMIZED", message: "No se puede editar un cliente anonimizado." };
    if (!get().isEmailAvailable(input.email, id)) {
      return { ok: false, code: "EMAIL_EXISTS", message: "Ya existe un cliente activo con ese e-mail." };
    }
    set((state) => ({
      customers: state.customers.map((customer) =>
        customer.id !== id
          ? customer
          : {
              ...customer,
              fullName: input.fullName.trim(),
              email: input.email.trim().toLowerCase(),
              phone: normalizeOptionalField(input.phone),
              dniOrCuil: normalizeOptionalField(input.dniOrCuil),
              address: toAddress(input),
              updatedAt: now(),
            },
      ),
    }));
    addToast("Cliente actualizado correctamente.");
    return { ok: true, customerId: id };
  },

  updateCustomerNotes: (id, notes) => {
    set((state) => ({
      customers: state.customers.map((customer) => (customer.id === id && !customer.isAnonymized ? { ...customer, notes, updatedAt: now() } : customer)),
    }));
    addToast("Notas actualizadas correctamente.");
  },

  anonymizeCustomer: (id) => {
    const existing = get().customers.find((customer) => customer.id === id);
    if (!existing || existing.isAnonymized) return;
    set((state) => ({
      customers: state.customers.map((customer) =>
        customer.id !== id
          ? customer
          : {
              ...customer,
              fullName: `Cliente eliminado (${id})`,
              email: "",
              phone: undefined,
              dniOrCuil: undefined,
              address: undefined,
              notes: undefined,
              isAnonymized: true,
              updatedAt: now(),
            },
      ),
    }));
    useAdminSalesStore.getState().anonymizeCustomerSales(id);
    addToast("Datos del cliente eliminados correctamente.");
  },
}));
