"use client";

import { Edit2, Power } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { ShippingStatusBadge } from "@/components/admin/shipping/shipping-ui";
import type { ShippingProviderConfig } from "@/lib/data/admin/shipping/shipping-config";

export function ProviderCard({ provider, onDeactivate }: { provider: ShippingProviderConfig; onDeactivate: () => void }) {
  const isActive = provider.status === "active";
  return (
    <article className="w-full max-w-full min-w-0 overflow-hidden rounded-3xl border border-border bg-white p-5 shadow-sm">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-text">{provider.name}</h2><ShippingStatusBadge status={provider.status} /></div>
          <p className="mt-2 text-sm text-text-muted">Modalidades: {provider.enabledModalities.length ? provider.enabledModalities.map((item) => item === "home_delivery" ? "Domicilio" : "Sucursal").join(", ") : "Sin modalidades configuradas"}</p>
          <p className="mt-1 text-sm text-text-muted">Rangos de peso: {provider.weightRanges.length || "Sin rangos"}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <LinkButton href={`/admin/envios/medios-de-envio/${provider.id}`} variant="secondary" size="sm"><Edit2 aria-hidden size={14} />{provider.status === "not_configured" ? "Configurar" : "Editar"}</LinkButton>
          {isActive ? <Button type="button" variant="secondary" size="sm" onClick={onDeactivate}><Power aria-hidden size={14} />Desactivar</Button> : null}
        </div>
      </div>
    </article>
  );
}
