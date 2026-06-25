"use client";

import { Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin/layout/AdminPageHeader";
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from "@/components/admin/ui/States";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ShipmentFilterDrawer, defaultShipmentFilters, type ShipmentFilters } from "@/components/admin/shipping/tracking/ShipmentFilterDrawer";
import { ShipmentTrackingCard } from "@/components/admin/shipping/tracking/ShipmentTrackingCard";
import { ShipmentTrackingRow } from "@/components/admin/shipping/tracking/ShipmentTrackingRow";
import type { ShipmentTrackingRecord } from "@/lib/data/admin/shipping/tracking";

type ShipmentTrackingListProps = {
  records: ShipmentTrackingRecord[];
  state?: "ready" | "loading" | "error";
};

export function ShipmentTrackingList({ records, state = "ready" }: ShipmentTrackingListProps) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ShipmentFilters>(defaultShipmentFilters);
  const [draftFilters, setDraftFilters] = useState<ShipmentFilters>(defaultShipmentFilters);
  const [filterOpen, setFilterOpen] = useState(false);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesSearch = !query || [record.id, record.saleNumber, record.recipientName, record.trackingCode ?? ""].some((value) => value.toLowerCase().includes(query));
      const matchesStatus = filters.statuses.length === 0 || filters.statuses.includes(record.status);
      return matchesSearch && matchesStatus;
    });
  }, [filters, records, search]);

  if (state === "loading") return <AdminLoadingState title="Cargando envíos" description="Estamos preparando el seguimiento." />;
  if (state === "error") return <AdminErrorState title="No pudimos cargar envíos" description="Intentá nuevamente en unos minutos." />;

  const hasFilters = search.trim() || filters.statuses.length > 0;

  return (
    <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-5 overflow-hidden">
      <AdminPageHeader description="Consultá envíos, retiros y pedidos vinculados a ventas." tag="Envíos" title="Seguimiento de Envíos">
        <Button type="button" variant="secondary" size="sm" onClick={() => { setDraftFilters(filters); setFilterOpen(true); }}><Filter aria-hidden size={16} />Filtros</Button>
      </AdminPageHeader>
      <div className="rounded-3xl border border-border bg-white p-4 shadow-sm">
        <Input id="shipment-search" label="Buscar envíos" helperText="Buscá por ID, venta, destinatario o código de tracking." value={search} onChange={(event) => setSearch(event.target.value)} trailingIcon={<Search aria-hidden size={16} />} />
      </div>
      {records.length === 0 ? (
        <AdminEmptyState title="Todavía no hay envíos para mostrar." description="Las ventas aparecerán acá cuando existan registros asociados." />
      ) : filteredRecords.length === 0 ? (
        <AdminEmptyState title="No encontramos envíos con esos criterios." description="Probá con otra búsqueda o limpiá los filtros." />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-3xl border border-border bg-white shadow-sm lg:block">
            <table className="w-full table-fixed">
              <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                <tr><th className="px-4 py-3 w-24">Envío</th><th className="px-4 py-3">Destinatario</th><th className="px-4 py-3 w-40">Estado</th><th className="px-4 py-3 w-44">Tracking</th><th className="px-4 py-3 w-28">Costo</th><th className="px-4 py-3 w-32">Fecha</th><th className="px-4 py-3 w-36 text-right">Acción</th></tr>
              </thead>
              <tbody>{filteredRecords.map((record) => <ShipmentTrackingRow key={record.id} record={record} />)}</tbody>
            </table>
          </div>
          <div className="grid min-w-0 gap-3 lg:hidden">{filteredRecords.map((record) => <ShipmentTrackingCard key={record.id} record={record} />)}</div>
        </>
      )}
      {hasFilters ? <p className="text-sm text-text-muted">Mostrando {filteredRecords.length} de {records.length} envíos.</p> : null}
      <ShipmentFilterDrawer open={filterOpen} draftFilters={draftFilters} onDraftChange={setDraftFilters} onClose={() => setFilterOpen(false)} onApply={() => { setFilters(draftFilters); setFilterOpen(false); }} onClear={() => { setDraftFilters(defaultShipmentFilters); setFilters(defaultShipmentFilters); }} />
    </div>
  );
}
