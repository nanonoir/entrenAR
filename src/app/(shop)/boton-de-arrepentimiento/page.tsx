import Link from "next/link";
import { SupportRequestUnavailable } from "@/components/shop/support/SupportRequestUnavailable";
import { Container } from "@/components/ui/Container";

export default function RepentancePage() {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto grid max-w-3xl gap-8 text-text">
          <div className="grid gap-4">
            <h1 className="font-heading text-5xl leading-none">¿Te arrepentiste? ¿Queres cancelar una compra?</h1>
            <p className="text-base leading-7 text-text-muted">
              Esta página reúne las solicitudes de cancelación de compras.
            </p>
            <p className="rounded-card border border-border bg-surface p-4 text-sm leading-6 text-text-muted">
              Para cambios o devoluciones por otro motivo, consultá{" "}
              <Link className="font-bold underline underline-offset-4" href="/cambios-y-devoluciones">
                Cambios y Devoluciones
              </Link>
              .
            </p>
          </div>

          <SupportRequestUnavailable requestLabel="solicitudes de cancelación" />
        </div>
      </Container>
    </section>
  );
}
