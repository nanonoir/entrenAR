import { ArrowLeft, PackageOpen } from "lucide-react";
import { LinkButton } from "@/components/ui/LinkButton";

type ProductPlaceholderPageProps = {
  title: string;
  description: string;
};

export function ProductPlaceholderPage({ title, description }: ProductPlaceholderPageProps) {
  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Productos</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500">{description}</p>
      </div>
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-zinc-200 bg-white py-16 text-center shadow-sm">
        <PackageOpen aria-hidden size={40} className="text-zinc-300" />
        <div>
          <p className="text-lg font-semibold text-zinc-800">Preparado para una próxima fase de CRM Productos</p>
          <p className="mt-1 text-sm text-zinc-500">Este marcador mantiene la navegación segura mientras la fase 1 se enfoca en el listado.</p>
        </div>
        <LinkButton href="/admin/productos" variant="secondary" size="sm">
          <ArrowLeft aria-hidden size={16} />
          Volver a productos
        </LinkButton>
      </div>
    </div>
  );
}
