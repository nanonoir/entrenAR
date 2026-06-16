"use client";

import Link from "next/link";
import { Edit2, Eye, Trash2 } from "lucide-react";
import type { AdminProduct } from "@/lib/data/admin/sales-flow/mock-products";
import { getProductHref } from "@/lib/routes";

type ProductActionMenuProps = {
  product: AdminProduct;
  placement?: "absolute" | "inline";
};

export function ProductActionMenu({ product, placement = "absolute" }: ProductActionMenuProps) {
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
      <button type="button" className={itemClassName} role="menuitem">
        <Trash2 aria-hidden size={14} />
        Borrar
      </button>
    </div>
  );
}
