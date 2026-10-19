"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { ShipmentDetailCard } from "@/components/admin/shipping/tracking/ShipmentDetailCard";
import { decodeRouteParam } from "@/lib/admin-route-params";
import { deriveShipmentTrackingRecord } from "@/lib/data/admin/shipping/tracking";
import { useAdminSalesStore } from "@/stores/admin-sales-store";

export function ShipmentDetailPageClient({ envioId }: { envioId: string }) {
  const id = decodeRouteParam(envioId);
  const sale = useAdminSalesStore((state) => state.sales.find((item) => item.id === id));
  const fetchSale = useAdminSalesStore((state) => state.fetchSale);
  const isInitializing = useAdminSalesStore((state) => state.isInitializing);
  const error = useAdminSalesStore((state) => state.error);
  const requestedId = useRef<string | null>(null);
  const record = useMemo(() => (sale ? deriveShipmentTrackingRecord(sale) : null), [sale]);

  useEffect(() => {
    if ((!sale || sale.products.length === 0) && requestedId.current !== id) {
      requestedId.current = id;
      void fetchSale(id);
    }
  }, [fetchSale, id, sale]);

  if (!record) {
    return (
      <div className="mx-auto max-w-4xl py-12 text-center">
        <p className="text-lg font-semibold text-zinc-800">{isInitializing ? "Cargando envío…" : error?.message ?? "Envío no encontrado"}</p>
        <Link href="/admin/envios" className="mt-3 inline-block text-sm text-accent underline">Volver a envíos</Link>
      </div>
    );
  }

  return <ShipmentDetailCard record={record} />;
}
