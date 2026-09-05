"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Mail, MessageCircle, PackageCheck, ShoppingBag, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { scrollToFirstError } from "@/components/admin/utils/scroll-to-error";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { formatARS, formatShortDate } from "@/lib/data/admin/sales-flow/helpers";
import {
  RECOVERY_STATUS,
  type AbandonedCartDetail,
  type RecoveryActionResult,
  type RecoveryStatus,
} from "@/lib/api/admin/abandoned-carts/types";
import { useAdminAbandonedCartsStore } from "@/stores/admin-abandoned-carts-store";
import { useAdminToastStore } from "@/stores/admin-toast-store";

const STATUS_LABELS: Record<RecoveryStatus, string> = {
  [RECOVERY_STATUS.DISCARDED]: "Descartado",
  [RECOVERY_STATUS.MANUAL]: "Manual",
  [RECOVERY_STATUS.PENDING]: "Pendiente",
  [RECOVERY_STATUS.RECOVERED]: "Recuperado",
  [RECOVERY_STATUS.SENT]: "E-mail enviado",
};

const STATUS_TONES: Record<RecoveryStatus, "neutral" | "accent" | "warning" | "success"> = {
  [RECOVERY_STATUS.DISCARDED]: "neutral",
  [RECOVERY_STATUS.MANUAL]: "neutral",
  [RECOVERY_STATUS.PENDING]: "warning",
  [RECOVERY_STATUS.RECOVERED]: "success",
  [RECOVERY_STATUS.SENT]: "accent",
};

interface AbandonedCartDetailModalProps {
  cartId: string | null;
  open: boolean;
  onClose: () => void;
}

interface EventPresentation {
  label: string;
  tone: "neutral" | "accent" | "sale" | "warning" | "success";
}

type CustomerWithOptionalAddress = AbandonedCartDetail["customer"] & { address?: string | null };

type RecoveryMutation = () => Promise<RecoveryActionResult | null>;

const EVENT_PRESENTATION: Record<string, EventPresentation> = {
  MANUAL_CONTACT_LOGGED: { label: "Contacto manual registrado", tone: "accent" },
  NOTE_ADDED: { label: "Nota agregada", tone: "neutral" },
  RECOVERY_EMAIL_SENT: { label: "E-mail de recuperación enviado", tone: "accent" },
  SESSION_ABANDONED: { label: "Carrito marcado como abandonado", tone: "warning" },
  SESSION_CREATED: { label: "Sesión creada", tone: "neutral" },
  SESSION_DISCARDED: { label: "Carrito descartado", tone: "sale" },
  SESSION_RECOVERED: { label: "Carrito convertido en venta", tone: "success" },
};

const discardCartSchema = z.object({
  reason: z.string().trim().min(3, { error: "El motivo debe tener al menos 3 caracteres." }).max(2_000, { error: "El motivo es demasiado largo." }),
});

type DiscardCartInput = z.input<typeof discardCartSchema>;
type DiscardCartValues = z.infer<typeof discardCartSchema>;

export function AbandonedCartDetailModal({ cartId, onClose, open }: AbandonedCartDetailModalProps) {
  const selectedCart = useAdminAbandonedCartsStore((state) => state.selectedCart);
  const lastRecoveryLink = useAdminAbandonedCartsStore((state) => state.lastRecoveryLink);
  const error = useAdminAbandonedCartsStore((state) => state.error);
  const isDetailLoading = useAdminAbandonedCartsStore((state) => state.isDetailLoading);
  const isMutating = useAdminAbandonedCartsStore((state) => state.isMutating);
  const fetchCartById = useAdminAbandonedCartsStore((state) => state.fetchCartById);
  const selectCart = useAdminAbandonedCartsStore((state) => state.selectCart);
  const sendRecoveryEmail = useAdminAbandonedCartsStore((state) => state.sendRecoveryEmail);
  const markManualRecovery = useAdminAbandonedCartsStore((state) => state.markManualRecovery);
  const convertCart = useAdminAbandonedCartsStore((state) => state.convertCart);
  const addToast = useAdminToastStore((state) => state.addToast);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ cartId: string; message: string } | null>(null);

  const cart = selectedCart?.id === cartId ? selectedCart : null;

  useEffect(() => {
    if (!open || !cartId) return;
    void fetchCartById(cartId);
  }, [cartId, fetchCartById, open]);

  function handleClose() {
    setDiscardOpen(false);
    setCopiedUrl(null);
    setActionError(null);
    selectCart(null);
    onClose();
  }

  async function runAction(action: RecoveryMutation, successMessage: string) {
    setActionError(null);
    const result = await action();
    if (!result) {
      setActionError({ cartId: cart?.id ?? "", message: "No se pudo completar la acción. Revisá el estado del carrito e intentá nuevamente." });
      return;
    }
    addToast(successMessage);
    if (cart) await fetchCartById(cart.id);
  }

  async function copyRecoveryLink(url: string) {
    if (!navigator.clipboard) {
      addToast("Tu navegador no permite copiar el enlace automáticamente.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      addToast("Enlace de recuperación copiado.");
      window.setTimeout(() => setCopiedUrl((current) => current === url ? null : current), 2_200);
    } catch {
      addToast("No se pudo copiar el enlace de recuperación.", "error");
    }
  }

  const recoveryUrl = cart?.recoveryLink?.url
    ?? (cart && lastRecoveryLink?.cartId === cart.id ? lastRecoveryLink.recoveryUrl : undefined);
  const isTerminal = cart?.recoveryStatus === RECOVERY_STATUS.RECOVERED || cart?.recoveryStatus === RECOVERY_STATUS.DISCARDED;
  const visibleError = (cart && actionError?.cartId === cart.id ? actionError.message : null) ?? error;
  const copied = recoveryUrl !== undefined && copiedUrl === recoveryUrl;

  return (
    <Modal open={open} onClose={handleClose} title={cart ? `Detalle del carrito ${cart.id}` : "Detalle del carrito"} className="max-w-5xl">
      <div className="grid gap-5 p-5 sm:p-6">
        {isDetailLoading && !cart ? <p className="py-12 text-center text-sm text-zinc-500">Cargando detalle del carrito…</p> : null}
        {!isDetailLoading && !cart ? (
          <div className="py-12 text-center">
            <p className="font-semibold text-zinc-900">No encontramos este carrito.</p>
            <p className="mt-1 text-sm text-zinc-500">Cerrá este panel y volvé a intentar desde el listado.</p>
          </div>
        ) : null}

        {cart ? (
          <>
            <header className="border-b border-zinc-100 pb-5 pr-8">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Carrito abandonado</p>
                <Badge tone={STATUS_TONES[cart.recoveryStatus]}>{STATUS_LABELS[cart.recoveryStatus]}</Badge>
              </div>
              <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-950">{cart.id}</h2>
                <p className="text-sm text-zinc-500">Abandonado el {formatDateTime(cart.abandonedAt)}</p>
              </div>
            </header>

            {visibleError ? (
              <div role="alert" className="rounded-2xl border border-sale/20 bg-red-50 px-4 py-3 text-sm font-medium text-sale">
                {visibleError}
              </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="grid gap-5">
                <section aria-labelledby="abandoned-cart-customer" className="rounded-3xl border border-zinc-200 bg-zinc-50/70 p-4">
                  <div className="flex items-center gap-2 text-accent">
                    <UserRound aria-hidden size={17} />
                    <h3 id="abandoned-cart-customer" className="text-xs font-semibold uppercase tracking-[0.16em]">Cliente</h3>
                  </div>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <DetailValue label="Nombre" value={`${cart.customer.firstName} ${cart.customer.lastName}`} />
                    <DetailValue label="E-mail" value={cart.customer.email ?? "No informado"} />
                    <DetailValue label="Teléfono" value={cart.customer.phone ?? "No informado"} />
                    <DetailValue label="DNI / CUIL" value={cart.customer.dni ?? "No informado"} />
                    {getCustomerAddress(cart.customer) ? <DetailValue label="Dirección" value={getCustomerAddress(cart.customer) ?? ""} /> : null}
                  </dl>
                </section>

                <section aria-labelledby="abandoned-cart-products" className="overflow-hidden rounded-3xl border border-zinc-200 bg-white">
                  <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
                    <ShoppingBag aria-hidden className="text-accent" size={17} />
                    <h3 id="abandoned-cart-products" className="text-sm font-semibold text-zinc-900">Productos</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-400">
                        <tr>
                          <th scope="col" className="px-4 py-3">Producto</th>
                          <th scope="col" className="px-3 py-3">Variante</th>
                          <th scope="col" className="px-3 py-3 text-right">Cantidad</th>
                          <th scope="col" className="px-3 py-3 text-right">Precio unitario</th>
                          <th scope="col" className="px-4 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {(cart.items.length > 0 ? cart.items : cart.products).map((product, index) => {
                          const lineTotal = product.lineSubtotal ?? product.quantity * product.unitPrice;
                          return (
                            <tr key={`${product.productId}-${product.variantId ?? "base"}-${index}`}>
                              <td className="px-4 py-3 font-medium text-zinc-800">{product.name}</td>
                              <td className="px-3 py-3 text-zinc-500">{product.variantName ?? "Sin variante"}</td>
                              <td className="px-3 py-3 text-right text-zinc-600">{product.quantity}</td>
                              <td className="px-3 py-3 text-right text-zinc-600">{formatARS(product.unitPrice)}</td>
                              <td className="px-4 py-3 text-right font-semibold text-zinc-900">{formatARS(lineTotal)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-zinc-200 bg-zinc-50/70">
                          <th scope="row" colSpan={4} className="px-4 py-3 text-right text-sm font-semibold text-zinc-600">Total del carrito</th>
                          <td className="px-4 py-3 text-right text-base font-bold text-zinc-950">{formatARS(cart.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>

                <RecoveryLinkCard url={recoveryUrl} expiresAt={cart.recoveryLink?.expiresAt ?? cart.recoveryExpiresAt} isExpired={cart.recoveryLink?.isExpired} copied={copied} disabled={Boolean(isTerminal || isMutating)} onCopy={() => recoveryUrl ? void copyRecoveryLink(recoveryUrl) : undefined} onGenerate={() => void runAction(() => sendRecoveryEmail(cart.id), "E-mail preparado y enlace generado.")} />

                <section aria-labelledby="abandoned-cart-history">
                  <div className="flex items-center gap-2">
                    <PackageCheck aria-hidden className="text-accent" size={17} />
                    <h3 id="abandoned-cart-history" className="text-sm font-semibold text-zinc-900">Historial de eventos</h3>
                  </div>
                  <ol className="mt-4 grid gap-4">
                    {cart.timeline.length === 0 ? <li className="text-sm text-zinc-500">Todavía no hay eventos registrados.</li> : null}
                    {cart.timeline.map((event) => {
                      const presentation = EVENT_PRESENTATION[event.eventType] ?? { label: event.eventType, tone: "neutral" as const };
                      return (
                        <li key={event.id} className="relative pl-7 before:absolute before:bottom-[-18px] before:left-[7px] before:top-3 before:w-px before:bg-zinc-200 last:before:hidden">
                          <span className="absolute left-0 top-1.5 h-4 w-4 rounded-full border-4 border-white bg-accent shadow-sm" aria-hidden />
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                            <div>
                              <Badge tone={presentation.tone}>{presentation.label}</Badge>
                              <p className="mt-1 text-xs text-zinc-500">{formatActor(event.actorId, event.actorRole)}</p>
                              {event.notes ? <p className="mt-2 text-sm leading-6 text-zinc-700">{event.notes}</p> : null}
                            </div>
                            <time className="shrink-0 text-xs text-zinc-400" dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              </div>

              <aside className="h-fit rounded-3xl border border-zinc-200 bg-zinc-50/70 p-4 lg:sticky lg:top-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Resumen</p>
                <dl className="mt-3 grid gap-3 text-sm">
                  <DetailValue label="Carrito" value={cart.cartId} />
                  <DetailValue label="Fecha de abandono" value={formatShortDate(cart.abandonedAt)} />
                  <DetailValue label="Productos" value={`${cart.items.length || cart.products.length} líneas`} />
                  <div className="flex items-center justify-between border-t border-zinc-200 pt-3">
                    <dt className="font-semibold text-zinc-600">Total</dt>
                    <dd className="text-lg font-bold text-zinc-950">{formatARS(cart.total)}</dd>
                  </div>
                </dl>
              </aside>
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button variant="secondary" size="sm" onClick={handleClose}><X aria-hidden size={15} />Cerrar</Button>
              <Button variant="ghost" size="sm" disabled={Boolean(isTerminal || isMutating)} aria-disabled={isTerminal || isMutating ? "true" : undefined} onClick={() => void runAction(() => markManualRecovery(cart.id), "Contacto manual registrado.")}><MessageCircle aria-hidden size={15} />Contacto Manual</Button>
              <Button variant="ghost" size="sm" disabled={Boolean(isTerminal || isMutating)} aria-disabled={isTerminal || isMutating ? "true" : undefined} onClick={() => void runAction(() => sendRecoveryEmail(cart.id), "E-mail de recuperación preparado.")}><Mail aria-hidden size={15} />Enviar E-mail</Button>
              <Button variant="primary" size="sm" disabled={Boolean(isTerminal || isMutating)} aria-disabled={isTerminal || isMutating ? "true" : undefined} onClick={() => void runAction(() => convertCart(cart.id), "Carrito convertido en venta.")}><ShoppingBag aria-hidden size={15} />Convertir a Venta</Button>
              <Button variant="danger" size="sm" disabled={Boolean(isTerminal || isMutating)} aria-disabled={isTerminal || isMutating ? "true" : undefined} onClick={() => setDiscardOpen(true)}><Trash2 aria-hidden size={15} />Descartar Carrito</Button>
            </footer>

            <DiscardCartModal cartId={cart.id} open={discardOpen} onClose={() => setDiscardOpen(false)} onSuccess={() => { addToast("Carrito descartado correctamente."); void fetchCartById(cart.id); }} />
          </>
        ) : null}
      </div>
    </Modal>
  );
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-zinc-800">{value}</dd>
    </div>
  );
}

function RecoveryLinkCard({ copied, disabled, expiresAt, isExpired, onCopy, onGenerate, url }: { copied: boolean; disabled: boolean; expiresAt?: string | null; isExpired?: boolean; onCopy: () => void; onGenerate: () => void; url?: string }) {
  return (
    <section aria-labelledby="abandoned-cart-recovery-link" className="rounded-3xl border border-accent/20 bg-accent-soft/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Recuperación</p>
          <h3 id="abandoned-cart-recovery-link" className="mt-1 text-sm font-semibold text-zinc-900">Enlace de checkout</h3>
        </div>
        {isExpired ? <Badge tone="warning">Vencido</Badge> : null}
      </div>
      {url ? (
        <>
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-2">
            <code className="min-w-0 flex-1 break-all px-2 text-xs text-zinc-600">{url}</code>
            <Button variant="secondary" size="icon" aria-label="Copiar enlace de recuperación" onClick={onCopy} disabled={disabled}>
              <Copy aria-hidden size={15} />
            </Button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">{copied ? "Copiado." : expiresAt ? `Vence el ${formatDateTime(expiresAt)}.` : "Enlace generado para este carrito."}</p>
        </>
      ) : (
        <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-dashed border-accent/30 bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-600">Todavía no hay un enlace activo para este carrito.</p>
          <Button variant="secondary" size="sm" onClick={onGenerate} disabled={disabled}><Mail aria-hidden size={15} />Generar link</Button>
        </div>
      )}
    </section>
  );
}

function DiscardCartModal({ cartId, onClose, onSuccess, open }: { cartId: string; onClose: () => void; onSuccess: () => void; open: boolean }) {
  const discardCart = useAdminAbandonedCartsStore((state) => state.discardCart);
  const storeError = useAdminAbandonedCartsStore((state) => state.error);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<DiscardCartInput, unknown, DiscardCartValues>({
    defaultValues: { reason: "" },
    mode: "onBlur",
    resolver: zodResolver(discardCartSchema),
  });
  const { errors, isSubmitted, isSubmitting } = form.formState;

  function close() {
    form.reset();
    setSubmitError(null);
    onClose();
  }

  async function handleSubmit(values: DiscardCartValues) {
    setSubmitError(null);
    const result = await discardCart(cartId, values.reason);
    if (!result) {
      setSubmitError("No se pudo descartar el carrito. Intentá nuevamente.");
      return;
    }
    close();
    onSuccess();
  }

  function handleInvalidSubmit(formErrors: typeof errors) {
    setSubmitError("Debes indicar un motivo válido para descartar el carrito.");
    scrollToFirstError(formErrors);
  }

  const globalError = submitError ?? storeError;

  return (
    <Modal open={open} onClose={close} title="Descartar carrito" className="max-w-md">
      <form className="grid gap-5 p-5 sm:p-6" noValidate onSubmit={form.handleSubmit(handleSubmit, handleInvalidSubmit)}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sale">Acción irreversible</p>
          <h2 className="mt-2 text-xl font-bold text-zinc-950">¿Descartar {cartId}?</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-500">El motivo quedará registrado en el historial del carrito.</p>
        </div>
        {globalError && (isSubmitted || submitError) ? <div role="alert" className="rounded-2xl border border-sale/20 bg-red-50 px-4 py-3 text-sm font-medium text-sale">{globalError}</div> : null}
        <Textarea id="discard-cart-reason" label="Motivo *" helperText="Ingresá al menos 3 caracteres. Este dato es obligatorio." errorText={errors.reason?.message} {...form.register("reason")} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={close}>Cancelar</Button>
          <Button type="submit" variant="danger" size="sm" disabled={isSubmitting}>{isSubmitting ? "Descartando…" : "Confirmar descarte"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatActor(actorId?: string | null, actorRole?: string | null): string {
  if (actorId && actorRole) return `${actorRole} · ${actorId}`;
  if (actorRole) return actorRole;
  if (actorId) return actorId;
  return "Sistema";
}

function getCustomerAddress(customer: AbandonedCartDetail["customer"]): string | null {
  if (!("address" in customer)) return null;
  const address = (customer as CustomerWithOptionalAddress).address;
  return typeof address === "string" && address.trim() ? address.trim() : null;
}
