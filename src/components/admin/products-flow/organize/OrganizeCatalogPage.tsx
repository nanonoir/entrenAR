"use client";

import { EyeOff, GripVertical, Layers3, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const initialHighlights = [
  { id: "home", label: "Inicio", description: "Productos destacados en la portada", enabled: true },
  { id: "featured", label: "Destacados", description: "Bloque comercial principal", enabled: true },
  { id: "seasonal", label: "Temporada", description: "Selección preparada para campañas", enabled: false },
];

const initialCategoryRules = ["Suplementos", "Proteínas", "Entrenamiento", "Accesorios"];

export function OrganizeCatalogPage() {
  const [highlights, setHighlights] = useState(initialHighlights);
  const [categoryRules, setCategoryRules] = useState(initialCategoryRules);
  const [showOutOfStock, setShowOutOfStock] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  function rotateCategoryOrder() {
    setCategoryRules((current) => [...current.slice(1), current[0]]);
    setMessage("Orden preparado en memoria para revisión.");
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl min-w-0 gap-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Productos</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">Organizar catálogo</h1>
          <p className="mt-1 text-sm text-zinc-500">Prepará destacados, orden de categorías y reglas de productos sin stock.</p>
        </div>
        <Button onClick={() => setMessage("Configuración preparada. La persistencia real queda para backend.")}>Guardar preparación</Button>
      </header>

      {message ? <div className="rounded-2xl border border-green-200 bg-white p-3 text-sm font-medium text-green-700">{message}</div> : null}

      <section className="grid gap-3 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <SectionTitle icon={<Sparkles size={18} />} title="Listas destacadas" description="Activá las secciones donde el catálogo podrá mostrar productos seleccionados." />
        <div className="grid gap-3 md:grid-cols-3">
          {highlights.map((item) => (
            <article key={item.id} className="rounded-2xl border border-zinc-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold text-zinc-950">{item.label}</h2>
                  <p className="mt-1 text-sm text-zinc-500">{item.description}</p>
                </div>
                <Badge tone={item.enabled ? "success" : "neutral"}>{item.enabled ? "Activa" : "Pausada"}</Badge>
              </div>
              <Button className="mt-4 w-full" variant="secondary" size="sm" onClick={() => setHighlights((current) => current.map((entry) => entry.id === item.id ? { ...entry, enabled: !entry.enabled } : entry))}>
                {item.enabled ? "Pausar" : "Activar"}
              </Button>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-3 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <SectionTitle icon={<Layers3 size={18} />} title="Orden de categorías" description="Configuración preparada para ordenar categorías en navegación y bloques comerciales." />
        <div className="grid gap-2">
          {categoryRules.map((category, index) => (
            <div key={category} className="flex min-w-0 items-center gap-3 rounded-2xl border border-zinc-100 p-3">
              <GripVertical aria-hidden className="shrink-0 text-zinc-300" size={18} />
              <span className="shrink-0 text-sm font-semibold text-zinc-400">{index + 1}</span>
              <span className="min-w-0 truncate font-medium text-zinc-800">{category}</span>
            </div>
          ))}
        </div>
        <Button variant="secondary" onClick={rotateCategoryOrder}>Simular reordenamiento</Button>
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
