"use client";

import { useEffect, useState } from "react";
import { ProductCreateFormPage } from "./ProductCreateFormPage";
import { CategoriesManagementPage } from "./categories/CategoriesManagementPage";
import { CategoryEditPage } from "./categories/CategoryEditPage";
import { InventoryPage } from "./inventory/InventoryPage";
import { InventoryHistoryPage } from "./inventory/InventoryHistoryPage";
import { getCatalogRepository, type CatalogReadResult } from "@/lib/api/catalog/catalog.repository";
import type { AdminProduct, AdminProductCategory } from "@/lib/data/admin/sales-flow/mock-products";

const READ_MODE = { CATEGORIES: "categories", CATEGORY: "category", CREATE: "create", INVENTORY: "inventory", HISTORY: "history", EDIT: "edit" } as const;
type ReadMode = (typeof READ_MODE)[keyof typeof READ_MODE];

export function AdminCatalogReadBoundary({ mode, id }: { mode: ReadMode; id?: string }) {
  const [state, setState] = useState<{ categories: AdminProductCategory[]; product: AdminProduct | null; products: AdminProduct[]; loading: boolean }>({ categories: [], product: null, products: [], loading: true });

  useEffect(() => {
    let active = true;
    const catalog = getCatalogRepository();
    void Promise.all([
      mode === READ_MODE.INVENTORY ? catalog.getAdminProducts() : Promise.resolve(null),
      mode === READ_MODE.HISTORY || mode === READ_MODE.EDIT ? catalog.getAdminProductById(id ?? "") : Promise.resolve(null),
      mode === READ_MODE.CREATE || mode === READ_MODE.CATEGORIES || mode === READ_MODE.CATEGORY || mode === READ_MODE.EDIT ? catalog.getAdminCategories() : Promise.resolve(null),
    ]).then(([productsResult, productResult, categoriesResult]) => {
      if (!active) return;
      setState({
        categories: readResult(categoriesResult, []),
        product: readResult(productResult, null),
        products: readResult(productsResult, []),
        loading: false,
      });
    }).catch(() => { if (active) setState((current) => ({ ...current, loading: false })); });
    return () => { active = false; };
  }, [id, mode]);

  if (state.loading) return <div className="min-h-64" aria-busy="true" />;
  if (mode === READ_MODE.CATEGORIES) return <CategoriesManagementPage categories={state.categories} />;
  if (mode === READ_MODE.CATEGORY) {
    const category = state.categories.find((item) => item.id === id);
    return category ? <CategoryEditPage categories={state.categories} category={category} /> : <MissingCatalogRecord />;
  }
  if (mode === READ_MODE.CREATE) return <ProductCreateFormPage categories={state.categories} />;
  if (mode === READ_MODE.INVENTORY) return <InventoryPage products={state.products} />;
  if (!state.product) return <MissingCatalogRecord />;
  if (mode === READ_MODE.HISTORY) return <InventoryHistoryPage product={state.product} />;
  return <ProductCreateFormPage categories={state.categories} mode="edit" product={state.product} />;
}

function readResult<T>(result: CatalogReadResult<T> | null, empty: T): T {
  return result?.status === "success" || result?.status === "empty" ? result.data : empty;
}

function MissingCatalogRecord() {
  return <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-zinc-600">No se encontró el recurso solicitado.</div>;
}
