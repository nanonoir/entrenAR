import { Container } from "@/components/ui/Container";

export default function TermsPage() {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto grid max-w-3xl gap-6">
          <div className="grid gap-2">
            <p className="font-subtitle text-sm font-semibold uppercase text-accent">Legal</p>
            <h1 className="font-heading text-5xl leading-none">Términos y condiciones</h1>
          </div>
          <div className="grid gap-4 text-sm leading-7 text-text-muted">
            <p>
              Esta página funciona como placeholder comercial para evitar rutas rotas durante la etapa
              frontend/mock-only.
            </p>
            <p>
              El contenido legal definitivo debe ser redactado y validado antes de publicar el sitio en producción.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
