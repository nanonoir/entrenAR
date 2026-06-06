import { Container } from "@/components/ui/Container";

export default function QualityPolicyPage() {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto grid max-w-3xl gap-8 text-text">
          <div className="grid gap-4">
            <h1 className="font-heading text-5xl leading-none">Política de calidad</h1>
            <p className="text-base leading-7">
              Esta política describe el criterio general de calidad aplicado a la selección y
              presentación de productos en EntrenAR.
            </p>
          </div>

          <div className="grid gap-6 text-sm leading-7">
            <section className="grid gap-2">
              <h2 className="font-subtitle text-xl font-semibold uppercase">Criterio de calidad</h2>
              <p>
                Trabajamos con marcas reconocidas y productos que cumplen con las condiciones
                regulatorias aplicables. En el caso de suplementos, priorizamos productos registrados
                ante ANMAT, con fecha de vencimiento vigente, empaque en buen estado y almacenamiento
                adecuado para preservar su calidad.
              </p>
            </section>

            <section className="grid gap-2">
              <h2 className="font-subtitle text-xl font-semibold uppercase">Última actualización</h2>
              <p>Última actualización: junio 2026.</p>
            </section>
          </div>
        </div>
      </Container>
    </section>
  );
}
