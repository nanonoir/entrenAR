import { Container } from "@/components/ui/Container";

export default function PrivacyPage() {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto grid max-w-3xl gap-6">
          <div className="grid gap-2">
            <p className="font-subtitle text-sm font-semibold uppercase text-accent">Legal</p>
            <h1 className="font-heading text-5xl leading-none">Política de privacidad</h1>
          </div>
          <div className="grid gap-4 text-sm leading-7 text-text-muted">
            <p>
              Esta página funciona como placeholder comercial para evitar rutas rotas durante la etapa
              frontend/mock-only.
            </p>
            <p>
              La política definitiva de tratamiento de datos personales queda fuera de alcance de esta entrega.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
