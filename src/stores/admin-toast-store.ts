"use client";

import { create } from "zustand";

export type AdminToastTone = "success" | "error" | "info";

export type AdminToast = {
  id: string;
  message: string;
  tone: AdminToastTone;
};

type AdminToastState = {
  toasts: AdminToast[];
  addToast: (message: string, tone?: AdminToastTone) => void;
  dismissToast: (id: string) => void;
};

function generateToastId() {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const useAdminToastStore = create<AdminToastState>()((set, get) => ({
  toasts: [],

  addToast: (message, tone = "success") => {
    const id = generateToastId();
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }));
    window.setTimeout(() => get().dismissToast(id), 4000);
  },

  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));
