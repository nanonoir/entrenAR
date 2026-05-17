import type { HeroBanner, HomeCategoryCard } from "@/types/home";

const heroBanners: HeroBanner[] = [
  {
    id: "proteinas-oferta",
    imageSrc: "/hero-proteinas.svg",
    mobileImageSrc: "/hero-proteinas-mobile.svg",
    alt: "Oferta de proteinas seleccionadas",
    href: "/suplementos/proteinas",
  },
  {
    id: "creatina-performance",
    imageSrc: "/hero-creatina.svg",
    mobileImageSrc: "/hero-creatina-mobile.svg",
    alt: "Creatina y pre entrenos para performance",
    href: "/suplementos/pre-intra-creatina",
  },
  {
    id: "market-sport",
    imageSrc: "/hero-market.svg",
    mobileImageSrc: "/hero-market-mobile.svg",
    alt: "Market deportivo con snacks y barras proteicas",
    href: "/market",
  },
];

const homeCategoryCards: HomeCategoryCard[] = [
  {
    id: "proteinas",
    title: "PROTE\u00cdNAS",
    href: "/suplementos/proteinas",
    imageSrc: "/category-proteinas.svg",
    alt: "Prote\u00ednas para volumen y recuperaci\u00f3n",
  },
  {
    id: "pre-intra-creatina",
    title: "PRE, INTRA & CREATINA",
    href: "/suplementos/pre-intra-creatina",
    imageSrc: "/category-pre-intra-creatina.svg",
    alt: "Creatina, pre entrenos e intra entrenos",
  },
  {
    id: "vitaminas-suplementos",
    title: "VITAMINAS & SUPLEMENTOS",
    href: "/suplementos/vitaminas-suplementos",
    imageSrc: "/category-vitaminas-suplementos.svg",
    alt: "Vitaminas y suplementos diarios",
  },
  {
    id: "performance",
    title: "PERFORMANCE",
    href: "/suplementos/performance",
    imageSrc: "/category-performance.svg",
    alt: "Suplementos para rendimiento deportivo",
  },
  {
    id: "market",
    title: "MARKET",
    href: "/market",
    imageSrc: "/category-market.svg",
    alt: "Market saludable con snacks y alimentos funcionales",
  },
  {
    id: "shakers",
    title: "SHAKERS",
    href: "/shakers",
    imageSrc: "/category-shakers.svg",
    alt: "Shakers y botellas para entrenamiento",
  },
];

export function getHeroBanners() {
  return heroBanners;
}

export function getHomeCategoryCards() {
  return homeCategoryCards;
}
