import { Container } from "@/components/ui/Container";

const sections = [
  {
    title: "Cobertura de envíos",
    body: "Los envíos se gestionan dentro de las zonas habilitadas al momento de la compra. La disponibilidad puede variar según dirección, tipo de producto y condiciones operativas vigentes.",
  },
  {
    title: "Cálculo de costos",
    body: "El costo de envío se informa durante el checkout, antes de confirmar la compra. Puede depender del destino, volumen del pedido, peso, promociones activas o modalidad seleccionada.",
  },
  {
    title: "Plazos de preparación",
    body: "Una vez confirmado el pago, el pedido entra en preparación. Los tiempos pueden variar según disponibilidad de stock, volumen operativo y validación de datos de entrega.",
  },
  {
    title: "Plazos de entrega",
    body: "Los plazos de entrega son estimados y se informan como referencia. Factores externos, condiciones climáticas, feriados o incidencias logísticas pueden modificar esos tiempos.",
  },
  {
    title: "Seguimiento del pedido",
    body: "Cuando la modalidad lo permita, se informará el estado o seguimiento del pedido por los canales disponibles. El usuario debe revisar los datos ingresados para recibir correctamente las novedades.",
  },
  {
    title: "Datos de entrega",
    body: "El usuario debe proporcionar nombre, dirección, contacto y referencias completas. Datos incompletos o incorrectos pueden generar demoras, reprogramaciones o imposibilidad de entrega.",
  },
  {
    title: "Recepción del pedido",
    body: "Al recibir el pedido, se recomienda verificar el estado externo del paquete y conservar la documentación o comprobantes relacionados con la entrega.",
  },
  {
    title: "Pedidos no entregados",
    body: "Si un pedido no puede entregarse por ausencia, datos incorrectos o rechazo de recepción, se evaluará la reprogramación o devolución según las condiciones aplicables.",
  },
  {
    title: "Responsabilidad logística",
    body: "EntrenAR acompaña la gestión del pedido y comunica la información disponible, sin asumir garantías absolutas sobre eventos externos al proceso de preparación y transporte.",
  },
];

export default function ShippingPolicyPage() {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto grid max-w-3xl gap-8 text-text">
          <div className="grid gap-4">
            <h1 className="font-heading text-5xl leading-none">Política de envíos</h1>
            <p className="text-base leading-7">
              Esta política resume cómo se preparan, informan y gestionan los envíos de pedidos en
              EntrenAR.
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
