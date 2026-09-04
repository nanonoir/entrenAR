"use client";

import { use, useEffect, useRef } from "react";
import { useAdminSalesStore } from "@/stores/admin-sales-store";
import { isSaleEditable } from "@/lib/data/admin/sales-flow/helpers";
import { OrderFormPage } from "@/components/admin/sales-flow/OrderFormPage";
import Link from "next/link";

export default function EditSalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const sale = useAdminSalesStore((s) => s.sales.find((s) => s.id === id));
  const fetchSale = useAdminSalesStore((s) => s.fetchSale);
  const isInitializing = useAdminSalesStore((s) => s.isInitializing);
  const error = useAdminSalesStore((s) => s.error);
  const requestedSaleId = useRef<string | null>(null);

  useEffect(() => {
    if ((!sale || sale.products.length === 0) && requestedSaleId.current !== id) {
      requestedSaleId.current = id;
      void fetchSale(id);
    }
  }, [fetchSale, id, sale]);

  if (!sale) {
    return (
      <div className="mx-auto max-w-4xl py-12 text-center">
        <p className="text-lg font-semibold text-zinc-800">{isInitializing ? "Cargando venta…" : error?.message ?? "Venta no encontrada"}</p>
        <Link href="/admin/ventas" className="mt-3 inline-block text-sm text-accent underline">
          Volver al listado
        </Link>
      </div>
    );
  }

  if (!isSaleEditable(sale)) {
    return (
      <div className="mx-auto max-w-4xl py-12 text-center">
        <p className="text-lg font-semibold text-zinc-800">Esta venta no se puede editar</p>
        <p className="mt-2 text-sm text-zinc-500">
          Por seguridad NO se puede editar una venta luego de empaquetar y/o enviar el pedido.
        </p>
        <Link href={`/admin/ventas/${sale.id}`} className="mt-3 inline-block text-sm text-accent underline">
          Volver al detalle
        </Link>
      </div>
    );
  }

  return <OrderFormPage mode="edit" existingSale={sale} />;
}
