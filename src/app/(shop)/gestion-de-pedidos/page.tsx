import { OrderTrackingForm } from "@/components/shop/support/OrderTrackingForm";
import { TrackingAuthCTA } from "@/components/shop/support/TrackingAuthCTA";
import { Container } from "@/components/ui/Container";

export default function OrderManagementPage() {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto grid max-w-3xl gap-8 text-text">
          <div className="grid gap-4">
            <h1 className="font-heading text-5xl leading-none">Gestión de Pedidos</h1>
            <p className="text-base leading-7 text-text-muted">
              Consultá el estado de tu pedido con el código de seguimiento. Si ya tenés cuenta, también podés iniciar
              sesión para ver todos tus pedidos en un solo lugar.
            </p>
          </div>

          <OrderTrackingForm />

          <div className="rounded-card border border-border bg-surface p-5">
            <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
              <div>
                <h2 className="font-subtitle text-xl font-semibold uppercase">¿Tenés cuenta?</h2>
                <p className="text-sm leading-6 text-text-muted">Accedé a tu historial completo de pedidos.</p>
              </div>
              <TrackingAuthCTA />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
