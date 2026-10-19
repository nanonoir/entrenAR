import { checkoutRoutes } from "@/lib/routes";

export type FooterLink = {
  label: string;
  href: string;
};

export type FooterSection = {
  title: string;
  links: FooterLink[];
};

export type FooterAction = FooterLink;

export const footerSections: FooterSection[] = [
  {
    title: "NOSOTROS",
    links: [
      { label: "Sobre Nosotros", href: "/nosotros" },
      { label: "Contacto", href: "/contacto" },
      { label: "Términos y condiciones", href: "/terminos-y-condiciones" },
    ],
  },
  {
    title: "COMPRAR",
    links: [
      { label: "Proteínas", href: "/suplementos/proteinas" },
      { label: "Creatinas y pre-entrenos", href: "/suplementos/pre-intra-creatina" },
      { label: "Market saludable", href: "/market" },
      { label: "Accesorios", href: "/accesorios" },
      { label: "Ofertas", href: "/ofertas" },
      { label: "Mi carrito", href: checkoutRoutes.cart },
    ],
  },
  {
    title: "NUESTRAS POLÍTICAS",
    links: [
      { label: "Política de envíos", href: "/politicas/envios" },
      { label: "Política de devoluciones", href: "/politicas/devoluciones" },
      { label: "Política de privacidad", href: "/politicas/privacidad" },
      { label: "Política de calidad", href: "/politicas/calidad" },
    ],
  },
];

export const footerHelpActions: FooterAction[] = [
  { label: "Gestión de Pedidos", href: "/gestion-de-pedidos" },
  { label: "Botón de Arrepentimiento", href: "/boton-de-arrepentimiento" },
  { label: "Cambios y Devoluciones", href: "/cambios-y-devoluciones" },
];

export const footerLegalText = "© 2026 EntrenAR.";
