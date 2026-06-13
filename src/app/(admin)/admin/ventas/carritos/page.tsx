"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { CalendarDays, CircleCheck, Mail, SendHorizontal, Settings, ShoppingCart } from "lucide-react";
import { useAdminAbandonedCartsStore } from "@/stores/admin-abandoned-carts-store";
import { formatARS, formatShortDate } from "@/lib/data/admin/sales-flow/helpers";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RecoveryConfigModal } from "@/components/admin/sales-flow/RecoveryConfigModal";
import { cn } from "@/lib/utils";
import type { AbandonedCartRecoveryStatus } from "@/lib/data/admin/sales-flow/types";

type DateFilter = "today" | "week" | "month" | "90days";

const DATE_FILTER_LABELS: Record<DateFilter, string> = {
  today: "Hoy",
  week: "Última semana",
  month: "Último mes",
  "90days": "Últimos 90 días",
};

const STATUS_LABELS: Record<AbandonedCartRecoveryStatus, string> = {
  pending: "Pendiente",
  sent: "E-mail enviado",
  manual: "Manual",
  recovered: "Recuperado",
};

const STATUS_TONES: Record<AbandonedCartRecoveryStatus, "neutral" | "accent" | "warning" | "success"> = {
  pending: "warning",
  sent: "accent",
  manual: "neutral",
  recovered: "success",
};

function getDateCutoff(filter: DateFilter) {
  const now = new Date("2026-06-12T23:59:59.000Z");
  const cutoff = new Date(now);
  if (filter === "today") cutoff.setHours(0, 0, 0, 0);
  if (filter === "week") cutoff.setDate(now.getDate() - 7);
  if (filter === "month") cutoff.setMonth(now.getMonth() - 1);
  if (filter === "90days") cutoff.setDate(now.getDate() - 90);
  return cutoff;
}

export default function AbandonedCartsPage() {
  const carts = useAdminAbandonedCartsStore((state) => state.carts);
  const config = useAdminAbandonedCartsStore((state) => state.config);
  const sendRecoveryEmail = useAdminAbandonedCartsStore((state) => state.sendRecoveryEmail);
  const [activeFilter, setActiveFilter] = useState<DateFilter>("week");
  const [configOpen, setConfigOpen] = useState(false);

  const filtered = carts.filter((cart) => new Date(cart.abandonedAt) >= getDateCutoff(activeFilter));
  const pendingCount = carts.filter((cart) => cart.recoveryStatus === "pending").length;
  const recoveredCount = carts.filter((cart) => cart.recoveryStatus === "recovered").length;
  const recoverableTotal = carts
    .filter((cart) => cart.recoveryStatus !== "recovered")
    .reduce((sum, cart) => sum + cart.total, 0);

  return (
    <div className="mx-auto grid max-w-7xl gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Ventas</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">Carritos Abandonados</h1>
          <p className="mt-1 text-sm text-zinc-500">Seguimiento local de carritos y recuperación por e-mail simulado.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setConfigOpen(true)}>
          <Settings aria-hidden size={16} />
          Configuración
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard icon={<ShoppingCart aria-hidden size={18} />} label="Carritos pendientes" value={String(pendingCount)} helper="Listos para recuperar" />
        <SummaryCard icon={<Mail aria-hidden size={18} />} label="Recuperación" value={config.isActive ? "Automática" : "Manual"} helper={`Tiempo actual: ${DATE_TIMING_LABELS[config.timing]}`} />
        <SummaryCard icon={<CalendarDays aria-hidden size={18} />} label="Potencial" value={formatARS(recoverableTotal)} helper={`${recoveredCount} recuperados en mock`} />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtros por fecha">
        {(Object.keys(DATE_FILTER_LABELS) as DateFilter[]).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={cn(
              "h-9 rounded-full border px-3 text-xs font-semibold transition",
              activeFilter === filter
                ? "border-accent bg-accent text-on-accent"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50",
            )}
          >
            {DATE_FILTER_LABELS[filter]}
          </button>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Carrito</th>
                <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Abandono</th>
                <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Cliente</th>
                <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Productos</th>
                <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Total</th>
                <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Estado</th>
                <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filtered.map((cart) => (
                <tr key={cart.id} className="transition hover:bg-zinc-50/80">
                  <td className="px-4 py-3 font-semibold text-zinc-900">{cart.id}</td>
                  <td className="px-3 py-3 text-zinc-600">{formatShortDate(cart.abandonedAt)}</td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-zinc-800">{cart.customer.firstName} {cart.customer.lastName}</p>
                    <p className="text-xs text-zinc-500">{cart.customer.email}</p>
                  </td>
                  <td className="px-3 py-3 text-zinc-600">{cart.products.reduce((sum, product) => sum + product.quantity, 0)} ud.</td>
                  <td className="px-3 py-3 font-semibold text-zinc-900">{formatARS(cart.total)}</td>
                  <td className="px-3 py-3"><Badge tone={STATUS_TONES[cart.recoveryStatus]}>{STATUS_LABELS[cart.recoveryStatus]}</Badge></td>
                  <td className="px-3 py-3">
                    {cart.recoveryStatus === "sent" || cart.recoveryStatus === "recovered" ? (
                      <Button variant="ghost" size="sm" disabled aria-disabled="true">
                        E-mail Enviado
                        <CircleCheck aria-hidden size={14} />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => sendRecoveryEmail(cart.id)}>
                        Enviar E-mail
                        <SendHorizontal aria-hidden size={14} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 lg:hidden">
        {filtered.map((cart) => (
          <div key={cart.id} className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-zinc-900">{cart.id}</p>
                <p className="text-xs text-zinc-500">{formatShortDate(cart.abandonedAt)}</p>
              </div>
              <Badge tone={STATUS_TONES[cart.recoveryStatus]} className="text-[10px]">{STATUS_LABELS[cart.recoveryStatus]}</Badge>
            </div>
            <p className="mt-3 text-sm font-medium text-zinc-800">{cart.customer.firstName} {cart.customer.lastName}</p>
            <p className="text-xs text-zinc-500">{cart.customer.email}</p>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-zinc-500">{cart.products.reduce((sum, product) => sum + product.quantity, 0)} productos</span>
              <span className="font-bold text-zinc-900">{formatARS(cart.total)}</span>
            </div>
            {cart.recoveryStatus === "sent" || cart.recoveryStatus === "recovered" ? (
              <Button className="mt-3" variant="ghost" size="sm" disabled aria-disabled="true">
                E-mail Enviado
                <CircleCheck aria-hidden size={14} />
              </Button>
            ) : (
              <Button className="mt-3" variant="ghost" size="sm" onClick={() => sendRecoveryEmail(cart.id)}>
                Enviar E-mail
                <SendHorizontal aria-hidden size={14} />
              </Button>
            )}
          </div>
        ))}
      </div>

      <RecoveryConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
    </div>
  );
}

const DATE_TIMING_LABELS = {
  "6hs": "a las 6 horas",
  "24hs": "24hs",
  "3_days": "3 días",
  "7_days": "7 días",
  "14_days": "14 días",
  manual: "manual",
};

function SummaryCard({ icon, label, value, helper }: { icon: ReactNode; label: string; value: string; helper: string }) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-accent">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-bold text-zinc-950">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{helper}</p>
    </div>
  );
}
