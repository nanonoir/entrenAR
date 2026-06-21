"use client";

import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AdminPageHeader } from "@/components/admin/layout/AdminPageHeader";

const preparedActions = [
  { id: "products", label: "Productos", description: "Campos base, precios, stock y visibilidad." },
  { id: "categories", label: "Categorías", description: "Jerarquía, slug, SEO y visibilidad." },
  { id: "inventory", label: "Inventario", description: "Stock principal y combinaciones de variantes." },
];

export function ImportExportPreparedPage() {
  const [message, setMessage] = useState<string | null>(null);

  function showPreparedMessage(action: string) {
    setMessage(`${action} preparado para futura integración. No se generó ni procesó ningún CSV.`);
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl min-w-0 gap-5">
      <AdminPageHeader title="Importar y exportar" description="Interfaz preparada para integración futura. No ejecuta CSV real ni persistencia masiva." backLink={{ href: "/admin/productos", label: "Volver" }} />

      {message ? <div className="rounded-2xl border border-green-200 bg-white p-3 text-sm font-medium text-green-700">{message}</div> : null}

      <section className="grid gap-3 md:grid-cols-3">
        {preparedActions.map((item) => (
          <article key={item.id} className="grid gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="rounded-2xl bg-accent-soft p-3 text-accent"><FileSpreadsheet aria-hidden size={20} /></span>
              <div>
                <h2 className="font-semibold text-zinc-950">{item.label}</h2>
                <p className="mt-1 text-sm text-zinc-500">{item.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => showPreparedMessage(`Exportar ${item.label.toLowerCase()}`)}><Download aria-hidden size={16} />Exportar</Button>
              <Button type="button" size="sm" onClick={() => showPreparedMessage(`Importar ${item.label.toLowerCase()}`)}><Upload aria-hidden size={16} />Importar</Button>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 shadow-sm">
        <h2 className="font-semibold text-zinc-950">Alcance preparado</h2>
        <ul className="mt-3 grid gap-2">
          <li>• No se parsean archivos ni se generan descargas reales.</li>
          <li>• Las acciones muestran feedback mock para validar la experiencia.</li>
          <li>• La integración real queda preparada para backend, permisos y auditoría.</li>
        </ul>
      </section>
    </div>
  );
}
