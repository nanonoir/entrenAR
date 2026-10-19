import Link from "next/link";
import { Container } from "@/components/ui/Container";

const helpLinks = [
  {
    label: "Gestión de pedidos",
    description: "Consultá el estado de tu pedido con tu código de seguimiento.",
    href: "/gestion-de-pedidos",
  },
  {
    label: "Política de envíos",
    description: "Cobertura, costos, plazos y recepción de tu pedido.",
    href: "/politicas/envios",
  },
  {
    label: "Política de devoluciones",
    description: "Condiciones y pasos para cambios y devoluciones.",
    href: "/politicas/devoluciones",
  },
  {
    label: "Términos y condiciones",
    description: "Reglas generales de uso del sitio y de las compras.",
    href: "/terminos-y-condiciones",
  },
];

export default function ContactPage() {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto grid max-w-3xl gap-8 text-text">
          <div className="grid gap-4">
            <h1 className="font-heading text-5xl leading-none">Contacto</h1>
            <p className="text-base leading-7">
              Para consultas sobre tu compra, empezá por estas secciones: reúnen el seguimiento de
              pedidos y la información de envíos, cambios y devoluciones.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {helpLinks.map((link) => (
              <Link
                className="grid gap-1 rounded-card border border-border bg-surface p-5 transition hover:border-accent"
                href={link.href}
                key={link.href}
              >
                <span className="font-subtitle text-lg font-semibold uppercase">{link.label}</span>
                <span className="text-sm leading-6">{link.description}</span>
              </Link>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
