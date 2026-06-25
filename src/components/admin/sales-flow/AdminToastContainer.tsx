"use client";

import { CheckCircle, Info, XCircle, X } from "lucide-react";
import { useAdminToastStore } from "@/stores/admin-toast-store";
import { cn } from "@/lib/utils";

const toneConfig = {
  success: {
    icon: CheckCircle,
    className: "border-green-200 bg-green-50 text-green-800",
    iconClass: "text-green-600",
  },
  error: {
    icon: XCircle,
    className: "border-red-200 bg-red-50 text-red-800",
    iconClass: "text-red-600",
  },
  info: {
    icon: Info,
    className: "border-zinc-200 bg-white text-zinc-700",
    iconClass: "text-zinc-500",
  },
};

export function AdminToastContainer() {
  const { dismissToast, toasts } = useAdminToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notificaciones"
      className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2"
    >
      {toasts.map((toast) => {
        const config = toneConfig[toast.tone];
        const Icon = config.icon;
        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "flex min-w-[260px] items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg transition-all",
              config.className,
            )}
          >
            <Icon aria-hidden size={18} className={config.iconClass} />
            <span className="flex-1 text-sm font-semibold">{toast.message}</span>
            <button
              type="button"
              aria-label="Cerrar notificación"
              onClick={() => dismissToast(toast.id)}
              className="ml-1 rounded-full p-0.5 opacity-70 transition hover:opacity-100"
            >
              <X aria-hidden size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
