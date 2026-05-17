import type { ShopNavItem } from "@/types/navigation";

const shopNavItems: ShopNavItem[] = [
  {
    label: "MARCAS",
    href: "/marcas",
    megaMenuLayout: "flat-5",
    groups: [
      {
        title: "Marcas",
        links: [
          { label: "ENA", href: "/marcas/ena" },
          { label: "Star Nutrition", href: "/marcas/star-nutrition" },
          { label: "Xtrenght", href: "/marcas/xtrenght" },
          { label: "MyProtein", href: "/marcas/myprotein" },
          { label: "BSN", href: "/marcas/bsn" },
          { label: "Granger", href: "/marcas/granger" },
          { label: "Integralmedica", href: "/marcas/integralmedica" },
          { label: "Nutremax", href: "/marcas/nutremax" },
          { label: "Body Advance", href: "/marcas/body-advance" },
          { label: "Evogen", href: "/marcas/evogen" },
          { label: "Gold Nutrition", href: "/marcas/gold-nutrition" },
          { label: "Gentech", href: "/marcas/gentech" },
          { label: "Optimum Nutrition", href: "/marcas/optimum-nutrition" },
          { label: "Nature's Bounty", href: "/marcas/natures-bounty" },
          { label: "Muscletech", href: "/marcas/muscletech" },
          { label: "Mrs Taste", href: "/marcas/mrs-taste" },
          { label: "Universal", href: "/marcas/universal" },
          { label: "Nutrex", href: "/marcas/nutrex" },
          { label: "Leguilab", href: "/marcas/leguilab" },
          { label: "Cellucor", href: "/marcas/cellucor" },
          { label: "RAW", href: "/marcas/raw" },
          { label: "Diabla", href: "/marcas/diabla" },
          { label: "Crudda", href: "/marcas/crudda" },
          { label: "Flint", href: "/marcas/flint" },
          { label: "Grosz", href: "/marcas/grosz" },
          { label: "Gat Sport", href: "/marcas/gat-sport" },
          { label: "Shark", href: "/marcas/shark" },
          { label: "Entrenuts", href: "/marcas/entrenuts" },
          { label: "Framingham", href: "/marcas/framingham" },
          { label: "Prota", href: "/marcas/prota" },
          { label: "Notco", href: "/marcas/notco" },
          { label: "AMPK", href: "/marcas/ampk" },
          { label: "Smartdiet", href: "/marcas/smartdiet" },
          { label: "Balboa Fit", href: "/marcas/balboa-fit" },
          { label: "Grant Force", href: "/marcas/grant-force" },
        ],
      },
    ],
  },
  {
    label: "SUPLEMENTOS",
    href: "/suplementos",
    megaMenuLayout: "grouped-5",
    groups: [
      {
        title: "PROTE\u00cdNAS",
        links: [
          { label: "Whey Protein", href: "/suplementos/proteinas/whey-protein" },
          { label: "Ganadores", href: "/suplementos/proteinas/ganadores" },
          { label: "Plant Protein", href: "/suplementos/proteinas/plant-protein" },
          { label: "Col\u00e1geno", href: "/suplementos/proteinas/colageno" },
          { label: "Protein Bars", href: "/suplementos/proteinas/protein-bars" },
          { label: "Protein Foods", href: "/suplementos/proteinas/protein-foods" },
          { label: "Shakers y Botellas", href: "/suplementos/proteinas/shakers-y-botellas" },
        ],
      },
      {
        title: "PRE INTRA & CREATINA",
        links: [
          { label: "Creatina", href: "/suplementos/pre-intra-creatina/creatina" },
          { label: "Pre & Intra Entreno", href: "/suplementos/pre-intra-creatina/pre-intra-entreno" },
          { label: "EEAs & BCAAs", href: "/suplementos/pre-intra-creatina/eeas-bcaas" },
          { label: "Pump & Vasodilatadores", href: "/suplementos/pre-intra-creatina/pump-vasodilatadores" },
        ],
      },
      {
        title: "VITAMINAS & SUPLEMENTOS",
        links: [
          { label: "Multivitam\u00ednicos", href: "/suplementos/vitaminas-suplementos/multivitaminicos" },
          { label: "Fish Oil & Omegas", href: "/suplementos/vitaminas-suplementos/fish-oil-omegas" },
          { label: "Huesos y Articulaciones", href: "/suplementos/vitaminas-suplementos/huesos-articulaciones" },
          { label: "Antioxidantes", href: "/suplementos/vitaminas-suplementos/antioxidantes" },
          { label: "Nootr\u00f3picos & Concentraci\u00f3n", href: "/suplementos/vitaminas-suplementos/nootropicos-concentracion" },
          { label: "Stress & Sue\u00f1o", href: "/suplementos/vitaminas-suplementos/stress-sueno" },
          { label: "Verdes y Superalimentos", href: "/suplementos/vitaminas-suplementos/verdes-superalimentos" },
          { label: "Adapt\u00f3genos y Hierbas", href: "/suplementos/vitaminas-suplementos/adaptogenos-hierbas" },
          { label: "Vitaminas A-Z", href: "/suplementos/vitaminas-suplementos/vitaminas-a-z" },
        ],
      },
      {
        title: "PERFORMANCE",
        links: [
          { label: "Hidrataci\u00f3n y Resistencia", href: "/suplementos/performance/hidratacion-resistencia" },
          { label: "Glutamina", href: "/suplementos/performance/glutamina" },
        ],
      },
      {
        title: "CONTROL DE PESO",
        links: [
          { label: "Quemadores de Grasa", href: "/suplementos/control-de-peso/quemadores-de-grasa" },
          { label: "Control de Apetito", href: "/suplementos/control-de-peso/control-de-apetito" },
          { label: "CLA", href: "/suplementos/control-de-peso/cla" },
          { label: "L-Carnitina", href: "/suplementos/control-de-peso/l-carnitina" },
          { label: "Cafe\u00edna", href: "/suplementos/control-de-peso/cafeina" },
        ],
      },
    ],
  },
  {
    label: "MARKET",
    href: "/market",
    megaMenuLayout: "flat-5",
    groups: [
      {
        title: "MARKET",
        links: [
          { label: "Pastas de Man\u00ed", href: "/market/pastas-de-mani" },
          { label: "Barras", href: "/market/barras" },
          { label: "Salsas", href: "/market/salsas" },
          { label: "Polvos & Mezclas", href: "/market/polvos-mezclas" },
          { label: "Frutos Secos", href: "/market/frutos-secos" },
          { label: "Jerky", href: "/market/jerky" },
          { label: "Endulzantes", href: "/market/endulzantes" },
          { label: "Alfajor", href: "/market/alfajor" },
          { label: "Hierba Mate", href: "/market/hierba-mate" },
          { label: "Enlatado", href: "/market/enlatado" },
        ],
      },
    ],
  },
  {
    label: "INDUMENTARIA",
    href: "/indumentaria",
    megaMenuLayout: "flat-1",
    groups: [
      {
        title: "INDUMENTARIA",
        links: [
          { label: "Entreno", href: "/indumentaria/entreno" },
          { label: "Shark", href: "/indumentaria/shark" },
          { label: "Xbelt", href: "/indumentaria/xbelt" },
          { label: "Symmetry", href: "/indumentaria/symmetry" },
        ],
      },
    ],
  },
  { label: "SHAKERS", href: "/shakers" },
  { label: "ACCESORIOS", href: "/accesorios" },
  { label: "OFERTAS", href: "/ofertas", highlight: true },
];

export function getShopNavItems() {
  return shopNavItems;
}
