"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Eye, Mail, RefreshCw, Search, Settings, ShoppingCart, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { AbandonedCartDetailModal } from "@/components/admin/sales-flow/AbandonedCartDetailModal";
import { RecoveryConfigModal } from "@/components/admin/sales-flow/RecoveryConfigModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatARS, formatShortDate } from "@/lib/data/admin/sales-flow/helpers";
import { RECOVERY_STATUS, type AbandonedCartListItem, type AbandonedCartListQuery, type RecoveryStatus } from "@/lib/api/admin/abandoned-carts/types";
import { useAdminAbandonedCartsStore } from "@/stores/admin-abandoned-carts-store";
import { cn } from "@/lib/utils";

const DATE_FILTER = {
  TODAY: "today",
  WEEK: "week",
  MONTH: "month",
  NINETY_DAYS: "90days",
  ALL: "all",
} as const;

type DateFilter = (typeof DATE_FILTER)[keyof typeof DATE_FILTER];

const DATE_FILTER_LABELS: Record<DateFilter, string> = {
  [DATE_FILTER.TODAY]: "Hoy",
  [DATE_FILTER.WEEK]: "Última semana",
  [DATE_FILTER.MONTH]: "Último mes",
  [DATE_FILTER.NINETY_DAYS]: "Últimos 90 días",
  [DATE_FILTER.ALL]: "Todos",
};

const STATUS_FILTER = {
  ALL: "ALL",
  PENDING: RECOVERY_STATUS.PENDING,
  SENT: RECOVERY_STATUS.SENT,
  MANUAL: RECOVERY_STATUS.MANUAL,
  RECOVERED: RECOVERY_STATUS.RECOVERED,
  DISCARDED: RECOVERY_STATUS.DISCARDED,
} as const;

type StatusFilter = (typeof STATUS_FILTER)[keyof typeof STATUS_FILTER];

const STATUS_FILTER_OPTIONS: Array<{ label: string; value: StatusFilter }> = [
  { label: "Todos", value: STATUS_FILTER.ALL },
  { label: "Pendiente", value: STATUS_FILTER.PENDING },
  { label: "E-mail enviado", value: STATUS_FILTER.SENT },
  { label: "Manual", value: STATUS_FILTER.MANUAL },
  { label: "Recuperado", value: STATUS_FILTER.RECOVERED },
  { label: "Descartado", value: STATUS_FILTER.DISCARDED },
];

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

const DATE_TIMING_LABELS = {
  "6hs": "a las 6 horas",
  "24hs": "24hs",
  "3_days": "3 días",
  "7_days": "7 días",
  "14_days": "14 días",
  manual: "manual",
} as const;

const PAGE_SIZE = 20;

interface DateRange {
  from?: string;
  to?: string;
}

export default function AbandonedCartsPage() {
  const carts = useAdminAbandonedCartsStore((state) => state.carts);
  const config = useAdminAbandonedCartsStore((state) => state.config);
  const summary = useAdminAbandonedCartsStore((state) => state.summary);
  const pagination = useAdminAbandonedCartsStore((state) => state.pagination);
  const isLoading = useAdminAbandonedCartsStore((state) => state.isLoading);
  const isFallback = useAdminAbandonedCartsStore((state) => state.isFallback);
  const error = useAdminAbandonedCartsStore((state) => state.error);
  const fetchCarts = useAdminAbandonedCartsStore((state) => state.fetchCarts);
  const fetchConfig = useAdminAbandonedCartsStore((state) => state.fetchConfig);
  const retryLoad = useAdminAbandonedCartsStore((state) => state.retryLoad);
  const selectCart = useAdminAbandonedCartsStore((state) => state.selectCart);
  const [search, setSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState<StatusFilter>(STATUS_FILTER.ALL);
  const [activeDate, setActiveDate] = useState<DateFilter>(DATE_FILTER.ALL);
  const [page, setPage] = useState(1);
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedCartId, setSelectedCartId] = useState<string | null>(null);

  useEffect(() => {
    void fetchCarts(buildListQuery(search, activeStatus, activeDate, page));
  }, [activeDate, activeStatus, fetchCarts, page, search]);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const pendingCount = summary?.pendingCount ?? countByStatus(carts, RECOVERY_STATUS.PENDING);
  const sentCount = summary?.sentCount ?? countByStatus(carts, RECOVERY_STATUS.SENT);
  const recoveredCount = summary?.recoveredCount ?? countByStatus(carts, RECOVERY_STATUS.RECOVERED);
  const recoverableTotal = summary?.recoverableTotal ?? carts
    .filter((cart) => cart.recoveryStatus !== RECOVERY_STATUS.RECOVERED && cart.recoveryStatus !== RECOVERY_STATUS.DISCARDED)
    .reduce((total, cart) => total + cart.total, 0);
  const totalCount = summary?.totalCount ?? pagination?.total ?? carts.length;
  const totalPages = pagination?.totalPages ?? (carts.length > 0 ? 1 : 0);
  const currentPage = pagination?.page ?? page;
  const hasActiveFilters = Boolean(search.trim()) || activeStatus !== STATUS_FILTER.ALL || activeDate !== DATE_FILTER.ALL;

  function clearFilters() {
    setSearch("");
    setActiveStatus(STATUS_FILTER.ALL);
    setActiveDate(DATE_FILTER.ALL);
    setPage(1);
  }

  function openDetail(cartId: string) {
    setSelectedCartId(cartId);
  }

  function closeDetail() {
    setSelectedCartId(null);
    selectCart(null);
  }

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

      {isFallback ? <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">No pudimos conectar con el backend. Mostramos datos locales hasta que se recupere.</div> : null}
      {error ? (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-sale/20 bg-red-50 px-4 py-3 text-sm font-medium text-sale sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => void retryLoad()} disabled={isLoading}><RefreshCw aria-hidden size={14} />Reintentar</Button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={<ShoppingCart aria-hidden size={18} />} label="Carritos" value={String(totalCount)} helper="En la selección actual" />
        <SummaryCard icon={<Mail aria-hidden size={18} />} label="Pendientes" value={String(pendingCount)} helper="Listos para recuperar" />
        <SummaryCard icon={<CalendarDays aria-hidden size={18} />} label="Recuperados" value={String(recoveredCount)} helper={`${sentCount} e-mails enviados`} />
        <SummaryCard icon={<ShoppingCart aria-hidden size={18} />} label="Potencial" value={formatARS(recoverableTotal)} helper={`Recuperación ${config.isActive ? "automática" : "manual"} · ${DATE_TIMING_LABELS[config.timing]}`} />
      </div>

      <section aria-label="Filtros de carritos abandonados" className="grid gap-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div>
          <label htmlFor="abandoned-cart-search" className="text-sm font-semibold text-zinc-900">Buscar carrito</label>
          <div className="relative mt-2">
            <input
              id="abandoned-cart-search"
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              aria-label="Buscar carritos abandonados"
              aria-describedby="abandoned-cart-search-helper"
              className="h-11 w-full rounded-button border border-zinc-200 bg-zinc-50 px-3 pr-20 text-base outline-none transition placeholder:text-zinc-400 focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/20 md:text-sm"
              placeholder="CART-901, nombre o e-mail"
            />
            <Search aria-hidden className="pointer-events-none absolute right-11 top-1/2 -translate-y-1/2 text-zinc-400" size={17} />
            {search ? <button type="button" aria-label="Limpiar búsqueda" onClick={() => { setSearch(""); setPage(1); }} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900"><X aria-hidden size={16} /></button> : null}
          </div>
          <p id="abandoned-cart-search-helper" className="mt-1 text-xs text-zinc-500">Buscá por ID, nombre, e-mail, teléfono o producto.</p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Estado</p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Filtros por estado">
              {STATUS_FILTER_OPTIONS.map((option) => (
                <button key={option.value} type="button" aria-pressed={activeStatus === option.value} onClick={() => { setActiveStatus(option.value); setPage(1); }} className={cn("min-h-9 rounded-full border px-3 text-xs font-semibold transition", activeStatus === option.value ? "border-accent bg-accent text-on-accent" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50")}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Fecha de abandono</p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Filtros por fecha">
              {(Object.keys(DATE_FILTER_LABELS) as DateFilter[]).map((filter) => (
                <button key={filter} type="button" aria-pressed={activeDate === filter} onClick={() => { setActiveDate(filter); setPage(1); }} className={cn("min-h-9 rounded-full border px-3 text-xs font-semibold transition", activeDate === filter ? "border-accent bg-accent text-on-accent" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50")}>
                  {DATE_FILTER_LABELS[filter]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {isLoading ? <div role="status" aria-live="polite" className="text-sm text-zinc-500">Actualizando carritos…</div> : null}
      {!isLoading && carts.length === 0 ? <EmptyState hasFilters={hasActiveFilters} onClear={clearFilters} /> : null}
      {carts.length > 0 ? <CartResults carts={carts} onOpen={openDetail} /> : null}

      {totalPages > 1 ? (
        <nav aria-label="Paginación de carritos abandonados" className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          <Button variant="ghost" size="sm" disabled={currentPage <= 1 || isLoading} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft aria-hidden size={15} />Anterior</Button>
          <p className="text-sm font-medium text-zinc-600">Página {currentPage} de {totalPages}</p>
          <Button variant="ghost" size="sm" disabled={currentPage >= totalPages || isLoading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Siguiente<ChevronRight aria-hidden size={15} /></Button>
        </nav>
      ) : null}

      <RecoveryConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
      <AbandonedCartDetailModal open={selectedCartId !== null} cartId={selectedCartId} onClose={closeDetail} />
    </div>
  );
}

function CartResults({ carts, onOpen }: { carts: AbandonedCartListItem[]; onOpen: (cartId: string) => void }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead><tr className="border-b border-zinc-100"><th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Carrito</th><th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Abandono</th><th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Cliente</th><th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Productos</th><th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Total</th><th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Estado</th><th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Acción</th></tr></thead>
            <tbody className="divide-y divide-zinc-50">
              {carts.map((cart) => <CartTableRow key={cart.id} cart={cart} onOpen={onOpen} />)}
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid gap-3 lg:hidden">
        {carts.map((cart) => (
          <article key={cart.id} className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-zinc-900">{cart.id}</p><p className="text-xs text-zinc-500">{formatShortDate(cart.abandonedAt)}</p></div><Badge tone={STATUS_TONES[cart.recoveryStatus]} className="text-[10px]">{STATUS_LABELS[cart.recoveryStatus]}</Badge></div>
            <p className="mt-3 text-sm font-medium text-zinc-800">{cart.customer.firstName} {cart.customer.lastName}</p><p className="text-xs text-zinc-500">{cart.customer.email ?? "Sin e-mail"}</p>
            <div className="mt-3 flex items-center justify-between text-sm"><span className="text-zinc-500">{getProductCount(cart)} productos</span><span className="font-bold text-zinc-900">{formatARS(cart.total)}</span></div>
            <Button className="mt-3 w-full" variant="ghost" size="sm" onClick={() => onOpen(cart.id)}><Eye aria-hidden size={15} />Ver detalle</Button>
          </article>
        ))}
      </div>
    </>
  );
}

function CartTableRow({ cart, onOpen }: { cart: AbandonedCartListItem; onOpen: (cartId: string) => void }) {
  return <tr className="transition hover:bg-zinc-50/80"><td className="px-4 py-3 font-semibold text-zinc-900">{cart.id}</td><td className="px-3 py-3 text-zinc-600">{formatShortDate(cart.abandonedAt)}</td><td className="px-3 py-3"><p className="font-medium text-zinc-800">{cart.customer.firstName} {cart.customer.lastName}</p><p className="text-xs text-zinc-500">{cart.customer.email ?? "Sin e-mail"}</p></td><td className="px-3 py-3 text-zinc-600">{getProductCount(cart)} ud.</td><td className="px-3 py-3 font-semibold text-zinc-900">{formatARS(cart.total)}</td><td className="px-3 py-3"><Badge tone={STATUS_TONES[cart.recoveryStatus]}>{STATUS_LABELS[cart.recoveryStatus]}</Badge></td><td className="px-3 py-3"><Button variant="ghost" size="sm" onClick={() => onOpen(cart.id)}><Eye aria-hidden size={14} />Ver detalle</Button></td></tr>;
}

function SummaryCard({ icon, label, value, helper }: { icon: ReactNode; label: string; value: string; helper: string }) {
  return <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-accent">{icon}<p className="text-xs font-semibold uppercase tracking-wide">{label}</p></div><p className="mt-3 text-2xl font-bold text-zinc-950">{value}</p><p className="mt-1 text-xs text-zinc-500">{helper}</p></div>;
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return <div className="rounded-3xl border border-dashed border-zinc-300 bg-white px-5 py-12 text-center shadow-sm"><ShoppingCart aria-hidden className="mx-auto text-zinc-300" size={28} /><h2 className="mt-3 text-lg font-semibold text-zinc-900">{hasFilters ? "No encontramos carritos con estos filtros" : "Todavía no hay carritos abandonados"}</h2><p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">{hasFilters ? "Probá quitar algún filtro o buscar por otro dato del cliente." : "Los carritos que abandonen el checkout aparecerán en este listado."}</p>{hasFilters ? <Button className="mt-4" variant="secondary" size="sm" onClick={onClear}>Limpiar filtros</Button> : null}</div>;
}

function countByStatus(carts: AbandonedCartListItem[], status: RecoveryStatus): number {
  return carts.filter((cart) => cart.recoveryStatus === status).length;
}

function getProductCount(cart: AbandonedCartListItem): number {
  return cart.products.reduce((total, product) => total + product.quantity, 0);
}

function buildListQuery(search: string, status: StatusFilter, dateFilter: DateFilter, page: number): AbandonedCartListQuery {
  const dateRange = getDateRange(dateFilter);
  return {
    limit: PAGE_SIZE,
    page,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(status === STATUS_FILTER.ALL ? {} : { status: status as RecoveryStatus }),
    ...dateRange,
  };
}

function getDateRange(filter: DateFilter): DateRange {
  if (filter === DATE_FILTER.ALL) return {};
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  if (filter === DATE_FILTER.WEEK) from.setDate(from.getDate() - 6);
  if (filter === DATE_FILTER.MONTH) from.setMonth(from.getMonth() - 1);
  if (filter === DATE_FILTER.NINETY_DAYS) from.setDate(from.getDate() - 90);
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}
