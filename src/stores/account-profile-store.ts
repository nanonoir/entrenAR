"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AccountAddress, AccountProfile } from "@/types/account";

type AccountProfileState = {
  profilesByEmail: Record<string, AccountProfile>;
  addressesByEmail: Record<string, AccountAddress[]>;
  ensureProfile: (email: string) => AccountProfile;
  updateProfile: (email: string, profile: AccountProfile) => void;
  addAddress: (email: string, address: AccountAddress) => void;
  updateAddress: (email: string, address: AccountAddress) => void;
  removeAddress: (email: string, addressId: string) => void;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function namePartsFromEmail(email: string) {
  if (email === "cliente@entrenar.com") {
    return { firstName: "Cliente", lastName: "" };
  }

  const [localPart] = email.split("@");
  const parts = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());

  return {
    firstName: parts[0] ?? "Cliente",
    lastName: parts.slice(1).join(" "),
  };
}

function createInitialProfile(email: string): AccountProfile {
  const normalizedEmail = normalizeEmail(email);
  const { firstName, lastName } = namePartsFromEmail(normalizedEmail);

  return {
    email: normalizedEmail,
    firstName,
    lastName,
    dni: "",
    gender: "",
    birthDate: "",
    phone: "",
  };
}

export const useAccountProfileStore = create<AccountProfileState>()(
  persist(
    (set, get) => ({
      profilesByEmail: {},
      addressesByEmail: {},
      ensureProfile: (email) => {
        const normalizedEmail = normalizeEmail(email);
        const existingProfile = get().profilesByEmail[normalizedEmail];

        if (existingProfile) {
          return existingProfile;
        }

        const profile = createInitialProfile(normalizedEmail);
        set((state) => ({
          profilesByEmail: {
            ...state.profilesByEmail,
            [normalizedEmail]: profile,
          },
          addressesByEmail: {
            ...state.addressesByEmail,
            [normalizedEmail]: state.addressesByEmail[normalizedEmail] ?? [],
          },
        }));

        return profile;
      },
      updateProfile: (email, profile) => {
        const normalizedEmail = normalizeEmail(email);

        set((state) => ({
          profilesByEmail: {
            ...state.profilesByEmail,
            [normalizedEmail]: {
              ...profile,
              email: normalizedEmail,
            },
          },
        }));
      },
      addAddress: (email, address) => {
        const normalizedEmail = normalizeEmail(email);

        set((state) => {
          const addresses = state.addressesByEmail[normalizedEmail] ?? [];

          if (addresses.length >= 6) {
            return state;
          }

          return {
            addressesByEmail: {
              ...state.addressesByEmail,
              [normalizedEmail]: [...addresses, address],
            },
          };
        });
      },
      updateAddress: (email, address) => {
        const normalizedEmail = normalizeEmail(email);

        set((state) => ({
          addressesByEmail: {
            ...state.addressesByEmail,
            [normalizedEmail]: (state.addressesByEmail[normalizedEmail] ?? []).map((item) =>
              item.id === address.id ? address : item,
            ),
          },
        }));
      },
      removeAddress: (email, addressId) => {
        const normalizedEmail = normalizeEmail(email);

        set((state) => ({
          addressesByEmail: {
            ...state.addressesByEmail,
            [normalizedEmail]: (state.addressesByEmail[normalizedEmail] ?? []).filter(
              (item) => item.id !== addressId,
            ),
          },
        }));
      },
    }),
    {
      name: "entrenar-account-profile-preview",
      skipHydration: true,
    },
  ),
);
