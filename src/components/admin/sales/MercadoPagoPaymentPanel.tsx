"use client";

import { useState } from "react";
import { AdminCard, AdminCardHeader } from "@/components/admin/ui/AdminCard";
import { Badge } from "@/components/ui/Badge";
import { formatARS, formatShortDate } from "@/lib/data/admin/sales-flow/helpers";
import type { AdminSale, SalePaymentAttempt, SaleProviderPaymentDetail } from "@/lib/data/admin/sales-flow/types";

const ATTEMPT_LABELS: Record<string, { label: string; tone: "warning" | "success" | "neutral" | "sale" }> = {
  SUBMITTING: { label: "Enviando", tone: "warning" },
  UNKNOWN: { label: "Estado desconocido", tone: "warning" },
  PROCESSING: { label: "Procesando", tone: "warning" },
  ACTION_REQUIRED: { label: "Requiere acción del cliente", tone: "warning" },
  APPROVED: { label: "Aprobado", tone: "success" },
  REJECTED: { label: "Rechazado", tone: "sale" },
  CANCELLED: { label: "Cancelado", tone: "neutral" },
  EXPIRED: { label: "Vencido", tone: "neutral" },
  PARTIALLY_REFUNDED: { label: "Reembolso parcial", tone: "warning" },
  REFUNDED: { label: "Reembolsado", tone: "sale" },
  CHARGED_BACK: { label: "Contracargo", tone: "sale" },
};

const HOLD_LABELS: Record<string, string> = {
  dispute: "Disputa abierta",
  full_refund: "Reembolso total",
  fraud_alert: "Alerta de fraude",
  unverified_provider_state: "Estado sin verificar con Mercado Pago",
};

const HELD_STOCK_WARNING_MS = 60 * 60 * 1000;

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      {children}
    </div>
  );
}

function Attempt({ attempt }: { attempt: SalePaymentAttempt }) {
  const config = ATTEMPT_LABELS[attempt.status] ?? { label: attempt.status, tone: "neutral" as const };
  const rawStatus = [attempt.rawOrderStatus, attempt.rawOrderStatusDetail].filter(Boolean).join(" / ");
  return (
    <li className="grid gap-1 rounded-xl border border-zinc-100 px-3 py-2 text-xs text-zinc-600">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-zinc-800">Intento {attempt.attemptNumber}</span>
        <Badge tone={config.tone}>{config.label}</Badge>
      </div>
      <span>Enviado: {formatShortDate(attempt.submittedAt)}</span>
      {attempt.outcomeAt && <span>Resultado: {formatShortDate(attempt.outcomeAt)}</span>}
      {rawStatus && <span>Estado en Mercado Pago: {rawStatus}</span>}
      {attempt.providerOrderId && <span>Orden MP: <span className="font-mono">{attempt.providerOrderId}</span></span>}
      {attempt.providerTransactionId && <span>Transacción MP: <span className="font-mono">{attempt.providerTransactionId}</span></span>}
      {attempt.providerReferenceId && <span>Referencia: <span className="font-mono">{attempt.providerReferenceId}</span></span>}
      {attempt.refundedAmount > 0 && <span>Reembolsado: {formatARS(attempt.refundedAmount)}</span>}
    </li>
  );
}

function Details({ detail }: { detail: SaleProviderPaymentDetail }) {
  return (
    <>
      <dl className="grid gap-1.5 text-xs text-zinc-600">
        {detail.rawStatus && (
          <div className="flex justify-between gap-2">
            <dt>Estado en Mercado Pago</dt>
            <dd className="font-semibold text-zinc-800">{[detail.rawStatus, detail.rawStatusDetail].filter(Boolean).join(" / ")}</dd>
          </div>
        )}
        {detail.retryUntil && (
          <div className="flex justify-between gap-2">
            <dt>Reintentos hasta</dt>
            <dd className="font-semibold text-zinc-800">{formatShortDate(detail.retryUntil)}</dd>
          </div>
        )}
        {detail.reviewStartedAt && (
          <div className="flex justify-between gap-2">
            <dt>En revisión desde</dt>
            <dd className="font-semibold text-zinc-800">{formatShortDate(detail.reviewStartedAt)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <dt>Última verificación</dt>
          <dd className="font-semibold text-zinc-800">{detail.lastVerifiedAt ? formatShortDate(detail.lastVerifiedAt) : "Sin verificar"}</dd>
        </div>
      </dl>
      {detail.attempts.length > 0 && (
        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Intentos de pago</p>
          <ol className="grid gap-2">
            {detail.attempts.map((attempt) => <Attempt key={attempt.attemptNumber} attempt={attempt} />)}
          </ol>
        </div>
      )}
    </>
  );
}

export function MercadoPagoPaymentPanel({ sale }: { sale: AdminSale }) {
  const [renderedAt] = useState(() => Date.now());
  const provider = sale.providerPayment;
  if (!provider) return null;
  const detail = provider.detail;
  const refunded = detail?.refundedAmount ?? provider.refundedAmount ?? 0;
  const fullRefund = detail?.fullRefund ?? sale.paymentStatus === "refunded";
  const partialRefund = !fullRefund && refunded > 0;
  const holdsLabel = detail?.holds.map((hold) => HOLD_LABELS[hold] ?? hold) ?? [];
  const heldStockMs = sale.paymentStatus === "pending" ? renderedAt - new Date(sale.createdAt).getTime() : 0;

  return (
    <AdminCard>
      <AdminCardHeader title="Mercado Pago" />
      <div className="grid gap-3">
        {sale.paymentStatus === "pending" && heldStockMs > HELD_STOCK_WARNING_MS && (
          <Warning>Stock reservado hace {Math.floor(heldStockMs / 3_600_000)} h sin pago acreditado.</Warning>
        )}
        {partialRefund && (
          <Warning>
            Reembolso parcial de {formatARS(refunded)}. El pedido se puede seguir preparando y enviando.
          </Warning>
        )}
        {fullRefund && (
          <Warning>
            Reembolso total de {formatARS(refunded)}. El pedido no se puede preparar ni enviar; ya podés cancelarlo para devolver el stock.
          </Warning>
        )}
        {(detail?.chargedBack || sale.paymentStatus === "charged_back") && <Warning>El pago tiene un contracargo.</Warning>}
        {(detail?.dispute ?? provider.dispute) && <Warning>Hay una disputa abierta sobre este pago. Gestionala desde el panel de Mercado Pago.</Warning>}
        {detail?.fraudAlert && <Warning>Mercado Pago emitió una alerta de fraude para este pago.</Warning>}
        {detail?.unresolvedReconciliation && (
          <Warning>El estado del pago todavía no se pudo confirmar con Mercado Pago. Revisalo antes de cancelar o preparar el pedido.</Warning>
        )}
        {detail?.attentionReason && (
          <Warning>Requiere atención: {detail.attentionReason}{detail.attentionRequiredAt ? ` (${formatShortDate(detail.attentionRequiredAt)})` : ""}</Warning>
        )}
        {holdsLabel.length > 0 && (
          <p className="text-xs text-zinc-600">Retenciones activas: {holdsLabel.join(", ")}.</p>
        )}
        {detail ? <Details detail={detail} /> : <p className="text-xs text-zinc-500">Cargando detalle del pago…</p>}
        <p className="text-xs text-zinc-500">
          Los pagos de Mercado Pago no se marcan como recibidos a mano y los reembolsos se gestionan desde el panel de Mercado Pago, no desde EntrenAR.
        </p>
      </div>
    </AdminCard>
  );
}
