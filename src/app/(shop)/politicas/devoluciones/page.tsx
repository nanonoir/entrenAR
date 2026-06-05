import Link from "next/link";
import { Container } from "@/components/ui/Container";

const sections = [
  {
    title: "Condiciones generales",
    body: "Las solicitudes de cambio o devolución se evalúan según el tipo de producto, su estado, la documentación disponible y el plazo transcurrido desde la recepción del pedido.",
  },
  {
    title: "Plazos para solicitar una devolución",
    body: "El usuario debe iniciar la solicitud dentro de un plazo razonable desde la recepción. La evaluación considera la fecha de entrega y la información presentada al momento del reclamo.",
  },
  {
    title: "Productos con falla o defecto",
    body: "Si el producto presenta una falla, defecto o diferencia relevante respecto de lo comprado, se solicitarán datos del pedido, descripción del inconveniente e imágenes que permitan revisar el caso.",
  },
  {
    title: "Productos sin uso",
    body: "Para productos sin uso, el empaque, etiquetas, accesorios y condiciones de conservación deben mantenerse en buen estado para que la solicitud pueda ser evaluada.",
  },
  {
    title: "Costos asociados",
    body: "Los costos de traslado, reposición o reintegro pueden variar según el motivo de la solicitud, la ubicación y las condiciones aplicables al caso.",
  },
  {
    title: "Evaluación del producto",
    body: "EntrenAR puede revisar el producto y la documentación antes de aprobar un cambio, devolución o reintegro. La aprobación depende de que se cumplan las condiciones informadas.",
  },
  {
    title: "Reintegros",
    body: "Cuando corresponda un reintegro, el plazo y el medio de acreditación dependerán del método de pago utilizado y de las validaciones necesarias para cerrar la solicitud.",
  },
  {
    title: "Cómo iniciar una solicitud",
    body: "Para iniciar el proceso, ingresá al canal de solicitud y completá los datos del pedido junto con el motivo del cambio o devolución.",
  },
];

export default function ReturnsPolicyPage() {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto grid max-w-3xl gap-8 text-text">
          <div className="grid gap-4">
            <h1 className="font-heading text-5xl leading-none">Política de devoluciones</h1>
            <p className="text-base leading-7">
              Esta política explica los criterios generales para solicitar cambios, devoluciones o
              reintegros vinculados a una compra en EntrenAR.
            </p>
          </div>

          <div className="grid gap-6 text-sm leading-7">
            {sections.map((section) => (
              <section className="grid gap-2" key={section.title}>
                <h2 className="font-subtitle text-xl font-semibold uppercase">{section.title}</h2>
                <p>{section.body}</p>
              </section>
            ))}

            <div className="rounded-card border border-border bg-surface p-5">
              <Link
                className="inline-flex min-h-12 items-center justify-center rounded-button border border-border bg-text px-5 py-3 text-center font-subtitle text-sm font-semibold uppercase text-surface transition hover:bg-accent"
                href="/ayuda/cambios-devoluciones"
              >
                Iniciar cambio o devolución
              </Link>
            </div>

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
