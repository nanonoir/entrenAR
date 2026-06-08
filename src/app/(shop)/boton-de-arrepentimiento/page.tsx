import Link from "next/link";
import { SupportActionForm } from "@/components/shop/support/SupportActionForm";
import { Container } from "@/components/ui/Container";

export default function RepentancePage() {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto grid max-w-3xl gap-8 text-text">
          <div className="grid gap-4">
            <h1 className="font-heading text-5xl leading-none">¿Te arrepentiste? ¿Queres cancelar una compra?</h1>
            <p className="text-base leading-7 text-text-muted">
              Completá este formulario para solicitar la cancelación de una compra. El equipo va a revisar el caso
              con los datos del pedido antes de confirmar los próximos pasos.
            </p>
            <p className="rounded-card border border-border bg-surface p-4 text-sm leading-6 text-text-muted">
              Si necesitás iniciar un cambio o devolución por otro motivo, usá el{" "}
              <Link className="font-bold underline underline-offset-4" href="/cambios-y-devoluciones">
                Formulario de Cambios y Devoluciones
              </Link>
              .
            </p>
          </div>

          <SupportActionForm
            idPrefix="repentance"
            includeReceivedCheckbox
            messageHelper="Contanos el motivo de cancelación o arrepentimiento para revisar la solicitud."
            messageLabel="Motivo de cancelación/arrepentimiento"
            submitLabel="Enviar solicitud"
            successMessage="Recibimos tu solicitud. Nuestro equipo va a contactarte a la brevedad para revisar los datos del pedido y continuar el proceso."
            successTitle="Solicitud recibida"
          />
        </div>
      </Container>
    </section>
  );
}
