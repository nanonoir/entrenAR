"use client";

import { EyeOff, GripVertical, Layers3 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAdminCatalogOrganizationStore } from "@/stores/admin-catalog-organization-store";

const initialCategoryRules = ["Suplementos", "Proteínas", "Entrenamiento", "Accesorios"];

export function OrganizeCatalogPage() {
  const savedCategoryOrder = useAdminCatalogOrganizationStore((state) => state.categoryOrder);
  const saveCategoryOrder = useAdminCatalogOrganizationStore((state) => state.saveCategoryOrder);
  const [categoryRules, setCategoryRules] = useState(savedCategoryOrder.length > 0 ? savedCategoryOrder : initialCategoryRules);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showOutOfStock, setShowOutOfStock] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  function moveCategory(fromIndex: number, toIndex: number) {
    setCategoryRules((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl min-w-0 gap-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Productos</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">Organizar catálogo</h1>
          <p className="mt-1 text-sm text-zinc-500">Prepará el orden de categorías y reglas de productos sin stock.</p>
        </div>
        <Button onClick={() => { saveCategoryOrder(categoryRules); setMessage("Orden confirmado en memoria. La persistencia real queda para backend."); }}>Confirmar</Button>
      </header>

      {message ? <div className="rounded-2xl border border-green-200 bg-white p-3 text-sm font-medium text-green-700">{message}</div> : null}

      <section className="grid gap-3 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <SectionTitle icon={<Layers3 size={18} />} title="Orden de categorías" description="Arrastrá las categorías para definir el orden preparado del catálogo." />
        <div className="grid gap-2">
          {categoryRules.map((category, index) => (
            <div
              key={category}
              draggable
              onDragStart={() => setDraggedIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => { if (draggedIndex !== null && draggedIndex !== index) moveCategory(draggedIndex, index); setDraggedIndex(null); }}
              className="flex min-w-0 cursor-grab items-center gap-3 rounded-2xl border border-zinc-100 p-3 active:cursor-grabbing"
            >
              <GripVertical aria-hidden className="shrink-0 text-zinc-300" size={18} />
              <span className="shrink-0 text-sm font-semibold text-zinc-400">{index + 1}</span>
              <span className="min-w-0 truncate font-medium text-zinc-800">{category}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => { setCategoryRules(savedCategoryOrder.length > 0 ? savedCategoryOrder : initialCategoryRules); setMessage("Cambios descartados."); }}>Cancelar</Button>
          <Button onClick={() => { saveCategoryOrder(categoryRules); setMessage("Orden confirmado en memoria. La persistencia real queda para backend."); }}>Confirmar</Button>
        </div>
      </section>

      <section className="grid gap-3 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <SectionTitle icon={<EyeOff size={18} />} title="Productos sin stock" description="Definí cómo se preparará la visualización de productos agotados." />
        <label className="flex items-center gap-3 rounded-2xl border border-zinc-100 p-3 text-sm font-medium text-zinc-700">
          <input type="checkbox" checked={showOutOfStock} onChange={() => { setShowOutOfStock((current) => !current); setMessage("Regla de sin stock preparada en memoria."); }} />
          Mostrar productos agotados al final del catálogo
        </label>
      </section>
    </div>
  );
}

function SectionTitle({ description, icon, title }: { description: string; icon: React.ReactNode; title: string }) {
  return <div className="flex min-w-0 items-start gap-2"><span className="mt-1 shrink-0 text-accent">{icon}</span><div className="min-w-0"><h2 className="text-lg font-semibold text-zinc-950">{title}</h2><p className="text-sm text-zinc-500">{description}</p></div></div>;
}
