import { Container } from "@/components/ui/Container";

export default function AboutPage() {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto grid max-w-3xl gap-8 text-text">
          <div className="grid gap-4">
            <h1 className="font-heading text-5xl leading-none">Sobre nosotros</h1>
            <p className="text-base leading-7">
              EntrenAR es una tienda deportiva pensada para comprar indumentaria, suplementos y
              accesorios de entrenamiento de forma simple, clara y confiable.
            </p>
          </div>

          <div className="grid gap-5 text-sm leading-7">
            <p>
              Nuestro objetivo es reunir una selección curada de productos para personas que entrenan,
              se cuidan y buscan resolver su compra sin vueltas. La experiencia prioriza información
              ordenada y navegación directa para comparar opciones con mayor seguridad.
            </p>
            <p>
              Podés recorrer las categorías, revisar el detalle de cada producto, elegir variantes,
              armar tu carrito y finalizar la compra en un mismo lugar.
            </p>
            <p>
              En EntrenAR queremos que encuentres lo que necesitás para entrenar y puedas comprar sin
              fricción, con información clara sobre cada producto, sus variantes y las condiciones de
              envío.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
