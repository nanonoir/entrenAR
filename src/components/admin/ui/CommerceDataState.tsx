"use client";

import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { DataSource } from "@/lib/api/config";
import type { CommerceStoreError } from "@/stores/admin-commerce-state";

type CommerceStatusProps = {
  label: string;
};

type CommerceErrorProps = {
  error: CommerceStoreError;
  onRetry: () => void;
};

export function CommerceSourceBadge({ source }: { source: DataSource }) {
  return <Badge tone={source === "api" ? "accent" : "neutral"}>{source === "api" ? "Fuente API" : "Modo mock"}</Badge>;
}

export function CommerceLoadingState({ label }: CommerceStatusProps) {
  return (
    <div aria-live="polite" className="flex items-center justify-center gap-2 rounded-3xl border border-border bg-white p-10 text-sm font-medium text-text-muted" role="status">
      <Loader2 aria-hidden className="animate-spin text-accent" size={18} />
      {label}
    </div>
  );
}

export function CommerceMutationStatus({ label = "Guardando cambios…" }: Partial<CommerceStatusProps>) {
  return (
    <div aria-live="polite" className="flex items-center gap-2 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm font-medium text-accent-hover" role="status">
      <Loader2 aria-hidden className="animate-spin" size={16} />
      {label}
    </div>
  );
}

export function CommerceErrorBanner({ error, onRetry }: CommerceErrorProps) {
  return (
    <div aria-live="assertive" className="flex items-start gap-3 rounded-2xl border border-sale/30 bg-sale/10 p-4 text-sm text-sale" role="alert">
      <AlertTriangle aria-hidden className="mt-0.5 shrink-0" size={18} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">No pudimos completar la operación.</p>
        <p className="mt-1 leading-6">{error.message}</p>
        <Button className="mt-3" onClick={onRetry} size="sm" variant="secondary">
          <RefreshCw aria-hidden size={15} />
          Reintentar
        </Button>
      </div>
    </div>
  );
}
