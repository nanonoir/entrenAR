import { SupportRequestUnavailable } from "@/components/shop/support/SupportRequestUnavailable";
import { Container } from "@/components/ui/Container";

export default function ReturnsExchangePage() {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto grid max-w-3xl gap-8 text-text">
          <div className="grid gap-4">
            <h1 className="font-heading text-5xl leading-none">Cambios y Devoluciones</h1>
            <p className="text-base leading-7 text-text-muted">
              Los cambios y devoluciones por fallas o defectos de fábrica se pueden solicitar dentro de los 14 días
              corridos desde la recepción del pedido. La evaluación se realiza con los datos de compra y el detalle
              del producto afectado.
            </p>
          </div>

          <SupportRequestUnavailable requestLabel="solicitudes de cambio o devolución" />
        </div>
      </Container>
    </section>
  );
}
