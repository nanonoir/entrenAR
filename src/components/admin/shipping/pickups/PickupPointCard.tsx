"use client";

import { Edit2, Power } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { ShippingStatusBadge } from "@/components/admin/shipping/shipping-ui";
import type { PickupPoint } from "@/lib/data/admin/shipping/shipping-config";

export function PickupPointCard({ point, onDeactivate, disabled = false }: { point: PickupPoint; onDeactivate: () => void | Promise<void>; disabled?: boolean }) {
  return (
    <article className="w-full max-w-full min-w-0 overflow-hidden rounded-3xl border border-border bg-white p-5 shadow-sm">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-text">{point.name}</h2><ShippingStatusBadge status={point.status} />{point.isMain ? <span className="text-xs font-semibold uppercase tracking-wide text-accent">Principal</span> : null}</div>
          <p className="mt-2 truncate text-sm text-text-muted">{point.address.street ? `${point.address.street} ${point.address.number}, ${point.address.city}` : "Dirección pendiente"}</p>
          <p className="mt-1 text-sm text-text-muted">Franjas horarias: {point.schedule.length || "Sin franjas"}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <LinkButton href={`/admin/envios/medios-de-envio/retiros/${point.id}`} variant="secondary" size="sm"><Edit2 aria-hidden size={14} />Editar</LinkButton>
          {point.status === "active" ? <Button disabled={disabled} type="button" variant="secondary" size="sm" onClick={() => void onDeactivate()}><Power aria-hidden size={14} />Desactivar</Button> : null}
        </div>
      </div>
    </article>
  );
}
