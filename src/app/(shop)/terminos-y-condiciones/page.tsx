import { Container } from "@/components/ui/Container";

const sections = [
  {
    title: "Uso del sitio",
    body: "El acceso y uso de EntrenAR implica aceptar estas condiciones. El sitio está destinado a consultar productos deportivos, comparar información comercial y realizar compras dentro de una experiencia clara y segura.",
  },
  {
    title: "Información de productos",
    body: "Las descripciones, imágenes, talles, sabores, presentaciones y datos publicados buscan representar cada producto con precisión. Pueden existir variaciones menores según disponibilidad, lote o actualización del catálogo.",
  },
  {
    title: "Precios y promociones",
    body: "Los precios y promociones se informan en pesos argentinos y pueden cambiar sin aviso previo. Una promoción aplica durante su vigencia y bajo las condiciones comunicadas en el sitio.",
  },
  {
    title: "Compras y confirmación",
    body: "La compra se considera iniciada cuando el usuario completa el proceso de checkout. La confirmación queda sujeta a validación de datos, disponibilidad de stock y acreditación del pago correspondiente.",
  },
  {
    title: "Pagos",
    body: "Los medios de pago disponibles se informan durante el checkout. La aprobación, rechazo o revisión de una operación puede depender de la entidad o plataforma que procese el pago.",
  },
  {
    title: "Envíos",
    body: "Las condiciones de preparación, despacho y entrega se detallan en la Política de envíos. El usuario debe ingresar datos completos y correctos para evitar demoras o entregas fallidas.",
  },
  {
    title: "Cambios y devoluciones",
    body: "Las solicitudes se evalúan según el estado del producto, el plazo de solicitud, el tipo de artículo y la documentación disponible. Las condiciones completas se detallan en la Política de devoluciones.",
  },
  {
    title: "Cuenta de usuario",
    body: "El usuario es responsable de mantener la confidencialidad de sus credenciales y de revisar que la información asociada a su cuenta sea correcta antes de confirmar una compra.",
  },
  {
    title: "Limitación de responsabilidad",
    body: "EntrenAR trabaja para mantener información clara y actualizada. Este contenido es informativo y no reemplaza asesoramiento legal, médico, nutricional o profesional cuando corresponda.",
  },
  {
    title: "Modificaciones",
    body: "Estas condiciones pueden actualizarse para reflejar cambios operativos, comerciales o normativos. La versión vigente será la publicada en esta página.",
  },
];

export default function TermsPage() {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto grid max-w-3xl gap-8 text-text">
          <div className="grid gap-4">
            <h1 className="font-heading text-5xl leading-none">Términos y condiciones</h1>
            <p className="text-base leading-7">
              Estas condiciones ordenan el uso del sitio, la información comercial publicada y el
              proceso de compra dentro de EntrenAR.
            </p>
          </div>

          <div className="grid gap-6 text-sm leading-7">
            {sections.map((section) => (
              <section className="grid gap-2" key={section.title}>
                <h2 className="font-subtitle text-xl font-semibold uppercase">{section.title}</h2>
                <p>{section.body}</p>
              </section>
            ))}

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
