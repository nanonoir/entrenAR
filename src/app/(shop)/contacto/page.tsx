import Image from "next/image";
import { Container } from "@/components/ui/Container";

const contactLinks = [
  {
    label: "Portfolio",
    href: "https://noirnahuel.vercel.app/",
    iconSrc: "/logoNR.svg",
  },
  {
    label: "WhatsApp",
    href: "https://api.whatsapp.com/send/?phone=543794657335&text=Hola%2C+Nahuel%2C+me+pongo+en+contacto+a+traves+de+EntrenAR.&type=phone_number&app_absent=0",
    iconSrc: "/whatsapp.svg",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/nahuelnicolasnoir/",
    iconSrc: "/linkedin.svg",
  },
  {
    label: "GitHub",
    href: "https://github.com/nanonoir",
    iconSrc: "/github.svg",
  },
];

export default function ContactPage() {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto grid max-w-3xl gap-8 text-text">
          <div className="grid gap-4">
            <h1 className="font-heading text-5xl leading-none">Contacto</h1>
            <div className="grid gap-1">
              <p className="font-subtitle text-2xl font-semibold uppercase">Nahuel Nicolas Noir</p>
              <p className="text-base leading-7">Full Stack Developer</p>
            </div>
            <p className="text-base leading-7">
              Gracias por visitar EntrenAR. Si querés conversar sobre un proyecto ecommerce similar,
              podés contactarme por estos canales.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {contactLinks.map((link) => (
              <a
                className="inline-flex min-h-12 items-center gap-3 rounded-button border border-border bg-text px-5 py-3 font-subtitle text-sm font-semibold uppercase text-surface transition hover:bg-accent"
                href={link.href}
                key={link.label}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Image alt="" aria-hidden height={24} src={link.iconSrc} width={24} />
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
