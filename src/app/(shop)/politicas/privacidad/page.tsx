import { Container } from "@/components/ui/Container";

const sections = [
  {
    title: "Información que podemos recopilar",
    body: "Podemos recopilar datos necesarios para operar la experiencia de compra, como nombre, datos de contacto, dirección de entrega, información de facturación y actividad básica dentro del sitio.",
  },
  {
    title: "Uso de la información",
    body: "La información se utiliza para gestionar pedidos, responder consultas, mejorar la experiencia de usuario, prevenir abusos y cumplir obligaciones comerciales o normativas aplicables.",
  },
  {
    title: "Datos de pago",
    body: "Los datos sensibles de pago no deben almacenarse en el storefront. Cuando se integre una plataforma de pago, su tratamiento dependerá de los mecanismos seguros del procesador correspondiente.",
  },
  {
    title: "Cookies y tecnologías similares",
    body: "El sitio puede utilizar cookies o tecnologías similares para recordar preferencias, medir el uso del sitio y mejorar la navegación. El usuario puede configurar su navegador para limitar estas tecnologías.",
  },
  {
    title: "Conservación de datos",
    body: "Los datos se conservan durante el tiempo necesario para cumplir la finalidad para la que fueron recopilados, atender consultas, sostener registros comerciales y cumplir obligaciones aplicables.",
  },
  {
    title: "Compartición con terceros",
    body: "La información puede compartirse con proveedores necesarios para operar la compra, el envío, la atención o la infraestructura del sitio. No se nombran proveedores específicos hasta que estén efectivamente integrados.",
  },
  {
    title: "Seguridad de la información",
    body: "Se deben aplicar medidas razonables para proteger la información frente a accesos no autorizados, pérdida o uso indebido, especialmente en flujos sensibles como cuenta, checkout y administración.",
  },
  {
    title: "Derechos del usuario",
    body: "El usuario puede solicitar acceso, actualización o eliminación de sus datos cuando corresponda, de acuerdo con la normativa aplicable y los canales habilitados por el sitio.",
  },
  {
    title: "Menores de edad",
    body: "El sitio no está orientado a recopilar deliberadamente información de menores de edad. Si se detecta un caso, se deberá evaluar la eliminación o corrección de esos datos.",
  },
  {
    title: "Cambios en esta política",
    body: "Esta política puede actualizarse por cambios operativos, técnicos o normativos. La versión vigente será la publicada en esta página.",
  },
];

export default function PrivacyPage() {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto grid max-w-3xl gap-8 text-text">
          <div className="grid gap-4">
            <h1 className="font-heading text-5xl leading-none">Política de privacidad</h1>
            <p className="text-base leading-7">
              Esta política explica qué datos pueden utilizarse para operar la experiencia de
              compra, atención y navegación en EntrenAR.
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
