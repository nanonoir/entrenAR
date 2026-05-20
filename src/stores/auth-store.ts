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
  return {
    email: email.trim().toLowerCase(),
    name: "Cliente EntrenAR",
  };
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
