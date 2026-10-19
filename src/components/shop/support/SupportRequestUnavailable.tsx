import { Info } from "lucide-react";
import { LinkButton } from "@/components/ui/LinkButton";

type SupportRequestUnavailableProps = {
  requestLabel: string;
};

export function SupportRequestUnavailable({ requestLabel }: SupportRequestUnavailableProps) {
  return (
    <div className="grid gap-4 rounded-card border border-border bg-white p-5 shadow-card sm:p-6" role="status">
      <div className="flex items-start gap-3">
        <Info aria-hidden className="mt-0.5 shrink-0 text-text-muted" size={22} />
        <div className="grid gap-1">
          <h2 className="font-subtitle text-xl font-semibold uppercase">La solicitud online no está disponible en este momento</h2>
          <p className="text-sm leading-6 text-text-muted">
            Por ahora no podemos recibir {requestLabel} desde el sitio. Mientras tanto, podés consultar el estado de
            tus pedidos.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <LinkButton href="/gestion-de-pedidos" variant="secondary">Ver pedido</LinkButton>
        <LinkButton href="/mi-cuenta" variant="secondary">Mi cuenta</LinkButton>
      </div>
    </div>
  );
}
