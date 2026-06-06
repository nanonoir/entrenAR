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
              ordenada, navegación directa y una presentación moderna para comparar opciones con mayor
              seguridad.
            </p>
            <p>
              Cada sección del sitio está diseñada para acompañar el recorrido de compra: descubrir
              categorías, revisar detalles del producto, elegir variantes, armar el carrito y avanzar
              hacia el checkout con una interfaz consistente.
            </p>
            <p>
              EntrenAR combina estética ecommerce profesional con una base técnica preparada para crecer,
              manteniendo el foco en un MVP sólido: que el usuario encuentre lo que necesita y pueda
              comprar sin fricción.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
