import type { HeroBanner, HomeCategoryCard } from "@/types/home";

const heroBanners: HeroBanner[] = [
  {
    id: "shakers-ena",
    image: { src: "/banners/promo-01-desktop.webp", width: 2244, height: 701 },
    mobileImage: { src: "/banners/promo-01-mobile.webp", width: 1254, height: 1254 },
    alt: "Shakers ENA",
    href: "/shakers",
  },
  {
    id: "whey-pistacho",
    image: { src: "/banners/promo-02-desktop.webp", width: 2172, height: 724 },
    mobileImage: { src: "/banners/promo-02-mobile.webp", width: 1254, height: 1254 },
    alt: "Whey protein sabor pistacho",
    href: "/suplementos/proteinas",
  },
  {
    id: "mrs-taste",
    image: { src: "/banners/promo-03-desktop.webp", width: 2172, height: 724 },
    mobileImage: { src: "/banners/promo-03-mobile.webp", width: 1254, height: 1254 },
    alt: "Mrs Taste en el market",
    href: "/market",
  },
];

const homeCategoryCards: HomeCategoryCard[] = [
  {
    id: "proteinas",
    title: "PROTEÍNAS",
    href: "/suplementos/proteinas",
    imageSrc: "/banners/categoria-proteinas.webp",
    alt: "Proteínas para volumen y recuperación",
  },
  {
    id: "pre-intra-creatina",
    title: "PRE, INTRA & CREATINA",
    href: "/suplementos/pre-intra-creatina",
    imageSrc: "/banners/categoria-pre-intra-creatina.webp",
    alt: "Creatina, pre entrenos e intra entrenos",
  },
  {
    id: "vitaminas-suplementos",
    title: "VITAMINAS & SUPLEMENTOS",
    href: "/suplementos/vitaminas-suplementos",
    imageSrc: "/banners/categoria-vitaminas-suplementos.webp",
    alt: "Vitaminas y suplementos diarios",
  },
  {
    id: "performance",
    title: "PERFORMANCE",
    href: "/suplementos/performance",
    imageSrc: "/banners/categoria-performance.webp",
    alt: "Suplementos para rendimiento deportivo",
  },
  {
    id: "market",
    title: "MARKET",
    href: "/market",
    imageSrc: "/banners/categoria-market.webp",
    alt: "Market saludable con snacks y alimentos funcionales",
  },
  {
    id: "shakers",
    title: "SHAKERS",
    href: "/shakers",
    imageSrc: "/banners/categoria-shakers.webp",
    alt: "Shakers y botellas para entrenamiento",
  },
];

export function getHeroBanners() {
  return heroBanners;
}

export function getHomeCategoryCards() {
  return homeCategoryCards;
}
