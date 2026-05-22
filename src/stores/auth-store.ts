"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MockAccountUser } from "@/types/account";

type AuthState = {
  user: MockAccountUser | null;
  login: (email: string) => void;
  register: (email: string) => void;
  logout: () => void;
};

function createMockUser(email: string): MockAccountUser {
  const normalizedEmail = email.trim().toLowerCase();

  return {
    email: normalizedEmail,
    name: normalizedEmail === "cliente@entrenar.com" ? "Cliente" : deriveNameFromEmail(normalizedEmail),
  };
}

function deriveNameFromEmail(email: string) {
  const [localPart] = email.split("@");
  const [firstName = "Cliente"] = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());

  return firstName;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      login: (email) => set({ user: createMockUser(email) }),
      register: (email) => set({ user: createMockUser(email) }),
      logout: () => set({ user: null }),
    }),
    {
      name: "entrenar-auth-preview",
      skipHydration: true,
    },
  ),
);
