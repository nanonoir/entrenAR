import { Container } from "@/components/ui/Container";

const sections = [
  {
    title: "Información que podemos recopilar",
    body: "Recopilamos los datos que ingresás para crear tu cuenta y comprar, como nombre, correo electrónico, teléfono y dirección de entrega, junto con tu historial de pedidos y los productos que guardás en tu lista de deseos.",
  },
  {
    title: "Uso de la información",
    body: "Usamos tu información para gestionar y entregar tus pedidos, mantener tu cuenta, atender consultas y cumplir obligaciones comerciales o normativas aplicables.",
  },
  {
    title: "Datos de pago",
    body: "No solicitamos ni guardamos datos de tarjetas en este sitio. Si elegís pagar por transferencia bancaria, los datos de la operación se informan durante la compra.",
  },
  {
    title: "Cookies y tecnologías similares",
    body: "Usamos cookies y el almacenamiento local de tu navegador para mantener tu sesión y recordar tu carrito. Podés configurar tu navegador para limitar estas tecnologías, aunque algunas funciones podrían dejar de estar disponibles.",
  },
  {
    title: "Conservación de datos",
    body: "Conservamos los datos durante el tiempo necesario para cumplir la finalidad para la que fueron recopilados, sostener registros comerciales y cumplir obligaciones aplicables.",
  },
  {
    title: "Compartición con terceros",
    body: "Podemos compartir la información necesaria con quienes intervienen en tu compra, por ejemplo para la entrega de tu pedido o el funcionamiento del sitio.",
  },
  {
    title: "Seguridad de la información",
    body: "El acceso a tu cuenta está protegido con una contraseña. Te recomendamos no compartirla y cerrar sesión en dispositivos que no sean tuyos.",
  },
  {
    title: "Derechos del usuario",
    body: "Podés solicitar acceso, actualización o eliminación de tus datos cuando corresponda, de acuerdo con la normativa aplicable.",
  },
  {
    title: "Menores de edad",
    body: "El sitio no está orientado a menores de edad y no recopilamos deliberadamente su información. Si detectamos un caso, evaluaremos eliminar o corregir esos datos.",
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
              Esta política explica qué datos usamos para gestionar tu cuenta y tus compras en
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
