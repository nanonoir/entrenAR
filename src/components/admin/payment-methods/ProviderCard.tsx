"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import type { PaymentProviderConfig } from "@/stores/admin-payment-methods-store";
import type { PaymentProviderDefinition } from "@/lib/data/admin/payment-methods";

type ProviderCardProps = {
  provider: PaymentProviderDefinition;
  config: PaymentProviderConfig;
  onActivate: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
};

export function ProviderCard({ config, onActivate, onDeactivate, onEdit, provider }: ProviderCardProps) {
  const isActive = config.status === "active";

  return (
    <AdminCard className="w-full max-w-full overflow-hidden">
      <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface p-2">
            <Image alt={`Logo de ${provider.name}`} className="max-h-10 w-auto object-contain" height={40} src={provider.logoSrc} width={40} />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="min-w-0 truncate text-lg font-semibold text-text">{provider.name}</h2>
              <Badge tone={isActive ? "success" : "neutral"}>{isActive ? "Activado" : "Desactivado"}</Badge>
            </div>
            <p className="mt-1 text-sm leading-6 text-text-muted">{provider.description}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
          {isActive ? (
            <>
              <Button onClick={onEdit} size="sm" variant="secondary">Editar configuración</Button>
              <Button onClick={onDeactivate} size="sm" variant="danger">Desactivar</Button>
            </>
          ) : (
            <Button onClick={onActivate} size="sm" variant="primary">Activar</Button>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl border border-border bg-surface p-3 text-sm md:grid-cols-3">
        <div className="hidden text-xs font-semibold uppercase tracking-wide text-text-muted md:block">Ventas en</div>
        <div className="hidden text-xs font-semibold uppercase tracking-wide text-text-muted md:block">Recibí en</div>
        <div className="hidden text-xs font-semibold uppercase tracking-wide text-text-muted md:block">Comisión</div>
        <div className="min-w-0 rounded-xl bg-white p-3 md:rounded-l-xl">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted md:hidden">Ventas en</span>
          <ul className="mt-1 grid min-w-0 gap-1 md:mt-0">
            {provider.acceptedMethods.map((method) => (
              <li key={method} className="min-w-0 truncate font-medium text-text">
                {method}
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0 rounded-xl bg-white p-3 md:rounded-none">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted md:hidden">Recibí en</span>
          <div className="mt-1 grid min-w-0 gap-2 md:mt-0">
            {provider.options.map((option) => (
              <div key={option.id} className="min-w-0">
                {option.salesIn !== option.receiveIn ? <p className="truncate text-xs font-medium text-text-muted">{option.salesIn}</p> : null}
                <p className="truncate text-text">{option.receiveIn}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-0 rounded-xl bg-white p-3 md:rounded-r-xl">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted md:hidden">Comisión</span>
          <div className="mt-1 grid min-w-0 gap-2 md:mt-0">
            {provider.options.map((option) => (
              <p key={option.id} className="truncate font-semibold text-text">
                {option.fee}
              </p>
            ))}
          </div>
        </div>
      </div>
    </AdminCard>
  );
}
