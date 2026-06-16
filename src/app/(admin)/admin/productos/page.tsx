import { Download, Filter, Plus, Search, SlidersHorizontal, Upload } from "lucide-react";
import { ProductTable } from "@/components/admin/products-flow/ProductTable";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { getAdminProducts } from "@/lib/data/admin/sales-flow/mock-products";

export default async function ProductsPage() {
  const products = await getAdminProducts();

  return (
    <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-5 overflow-hidden">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Gestión</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">Productos</h1>
          <p className="mt-1 text-sm text-zinc-500">
            <span className="font-semibold text-zinc-800">{products.length}</span> productos en catálogo
          </p>
        </div>
        <div className="grid w-full min-w-0 grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:flex sm:flex-wrap lg:w-auto lg:justify-end">
          <LinkButton className="w-full sm:w-auto" variant="secondary" size="sm" href="/admin/productos/organizar">
            <SlidersHorizontal aria-hidden size={16} />
            Organizar
          </LinkButton>
          <Button className="w-full sm:w-auto" variant="secondary" size="sm">
            <Download aria-hidden size={16} />
            Exportar
          </Button>
          <LinkButton className="w-full sm:w-auto" variant="secondary" size="sm" href="/admin/productos/importar-exportar">
            <Upload aria-hidden size={16} />
            Importar
          </LinkButton>
          <LinkButton className="w-full sm:w-auto" variant="primary" size="sm" href="/admin/productos/nuevo">
            <Plus aria-hidden size={16} />
            Agregar producto
          </LinkButton>
        </div>
      </div>

      <div className="grid w-full min-w-0 max-w-full gap-3 overflow-hidden rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <label className="flex h-11 w-full min-w-0 max-w-full items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-zinc-600 shadow-sm transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
          <Search aria-hidden size={16} className="shrink-0 text-zinc-400" />
          <input
            type="search"
            placeholder="Buscar por nombre o palabra clave..."
            className="w-full min-w-0 max-w-full flex-1 bg-transparent text-base outline-none placeholder:text-zinc-400 md:text-sm"
            aria-label="Buscar productos"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled>
            <Filter aria-hidden size={16} />
            Filtros en la próxima fase
          </Button>
        </div>
      </div>

      <ProductTable products={products} />
    </div>
  );
}
