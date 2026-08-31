"use client";

import Image from "next/image";
import { Edit2, Power } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { ShippingStatusBadge } from "@/components/admin/shipping/shipping-ui";
import type { ShippingProviderConfig } from "@/lib/data/admin/shipping/shipping-config";

const providerLogoById: Record<ShippingProviderConfig["id"], string> = {
  andreani: "/andreani.svg",
  "correo-argentino": "/correoArgentino.svg",
};

export function ProviderCard({ provider, onDeactivate, disabled = false }: { provider: ShippingProviderConfig; onDeactivate: () => void | Promise<void>; disabled?: boolean }) {
  const isActive = provider.status === "active";
  return (
    <article className="w-full max-w-full min-w-0 overflow-hidden rounded-3xl border border-border bg-white p-5 shadow-sm">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-border bg-surface p-2">
            <Image src={providerLogoById[provider.id]} alt={`Logo de ${provider.name}`} width={96} height={40} className="max-h-8 w-auto object-contain" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-text">{provider.name}</h2><ShippingStatusBadge status={provider.status} /></div>
          <p className="mt-2 text-sm text-text-muted">Modalidades: {provider.enabledModalities.length ? provider.enabledModalities.map((item) => item === "home_delivery" ? "Domicilio" : "Sucursal").join(", ") : "Sin modalidades configuradas"}</p>
          <p className="mt-1 text-sm text-text-muted">Rangos de peso: {provider.weightRanges.length || "Sin rangos"}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <LinkButton href={`/admin/envios/medios-de-envio/${provider.id}`} variant="secondary" size="sm"><Edit2 aria-hidden size={14} />{provider.status === "not_configured" ? "Configurar" : "Editar"}</LinkButton>
           {isActive ? <Button disabled={disabled} type="button" variant="secondary" size="sm" onClick={() => void onDeactivate()}><Power aria-hidden size={14} />Desactivar</Button> : null}
        </div>
      </div>
    </article>
  );
}
