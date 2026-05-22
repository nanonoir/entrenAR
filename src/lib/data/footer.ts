export type FooterLink = {
  label: string;
  href: string;
};

export type FooterSection = {
  title: string;
  links: FooterLink[];
};

export type FooterAction = FooterLink;

export type FooterSocialLink = FooterLink & {
  iconSrc: string;
};

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
      { label: "Finalizar compra", href: "/finalizar-compra" },
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

export const footerHelpText =
  "Atención al cliente: Lunes a viernes de 9 a 18 hs.\nRetiros coordinados y envíos a todo el país.";

export const footerHelpActions: FooterAction[] = [
  { label: "Cambios y devoluciones", href: "/ayuda/cambios-devoluciones" },
  { label: "Botón de arrepentimiento", href: "/ayuda/boton-arrepentimiento" },
  { label: "Gestión de pedidos", href: "/cuenta/pedidos" },
];

export const footerSocialLinks: FooterSocialLink[] = [
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

export const footerDeveloperText = "Desarrollado por Nahuel Nicolas Noir.";

export const footerLegalText =
  "© 2026 EntrenAR. Los productos, precios y marcas mostradas son utilizados únicamente como parte de una demo.";
