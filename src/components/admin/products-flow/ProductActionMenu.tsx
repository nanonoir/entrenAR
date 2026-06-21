"use client";

import Link from "next/link";
import { Edit2, Eye, Trash2 } from "lucide-react";
import { useState } from "react";
import type { AdminProduct } from "@/lib/data/admin/sales-flow/mock-products";
import { getProductHref } from "@/lib/routes";
import { useAdminProductsStore } from "@/stores/admin-products-store";

type ProductActionMenuProps = {
  product: AdminProduct;
  placement?: "absolute" | "inline";
};

export function ProductActionMenu({ product, placement = "absolute" }: ProductActionMenuProps) {
  const deleteProduct = useAdminProductsStore((state) => state.deleteProduct);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const itemClassName = "flex w-full min-w-0 items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50";
  const menuClassName = placement === "inline"
    ? "mt-3 w-full max-w-full rounded-2xl border border-zinc-200 bg-white py-1.5 shadow-sm"
    : "absolute right-0 top-10 z-20 w-44 max-w-[calc(100vw-2rem)] rounded-2xl border border-zinc-200 bg-white py-1.5 shadow-xl sm:w-48";

  return (
    <div className={menuClassName} role="menu">
      <Link
        href={getProductHref(product.publicSlug)}
        target="_blank"
        rel="noreferrer"
        className={itemClassName}
        role="menuitem"
      >
        <Eye aria-hidden size={14} />
        Ver (Tienda)
      </Link>
      <Link href={`/admin/productos/${product.id}`} className={itemClassName} role="menuitem">
        <Edit2 aria-hidden size={14} />
        Editar
      </Link>
      {confirmingDelete ? (
        <div className="grid gap-2 px-4 py-2 text-sm text-zinc-700" role="group" aria-label={`Confirmar borrado de ${product.name}`}>
          <p className="text-xs font-medium text-sale">¿Borrar este producto?</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="rounded-xl border border-zinc-200 px-2 py-1 text-xs font-semibold" onClick={() => setConfirmingDelete(false)}>Cancelar</button>
            <button
              type="button"
              className="rounded-xl bg-sale px-2 py-1 text-xs font-semibold text-white disabled:opacity-70"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  await deleteProduct(product.id);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Borrando…" : "Borrar"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={itemClassName} role="menuitem" onClick={() => setConfirmingDelete(true)}>
          <Trash2 aria-hidden size={14} />
          Borrar
        </button>
      )}
    </div>
  );
}
