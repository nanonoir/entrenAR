import type { CategoryNavItem } from "@/types/navigation";

const categories: CategoryNavItem[] = [
  {
    slug: "proteinas",
    label: "Proteínas",
    description: "Whey, blends y ganadores para sostener volumen y recuperación.",
    featured: true,
    groups: [
      {
        title: "Proteínas",
        links: [
          { label: "Whey protein", href: "/suplementos/proteinas/whey-protein" },
          { label: "Isolate", href: "/suplementos/proteinas/isolate" },
          { label: "Ganadores", href: "/suplementos/proteinas/ganadores" },
        ],
      },
      {
        title: "Objetivo",
        links: [
          { label: "Masa muscular", href: "/suplementos/proteinas" },
          { label: "Recuperación", href: "/suplementos/proteinas" },
          { label: "Definición", href: "/suplementos/proteinas" },
        ],
      },
    ],
  },
  {
    slug: "creatina-y-pre",
    label: "Creatina y pre",
    description: "Energía, fuerza y foco para entrenamientos pesados.",
    featured: true,
    groups: [
      {
        title: "Performance",
        links: [
          { label: "Creatina", href: "/suplementos/pre-intra-creatina/creatina" },
          { label: "Pre entrenos", href: "/suplementos/pre-intra-creatina/pre-entrenos" },
          { label: "Intra workout", href: "/suplementos/pre-intra-creatina/intra-workout" },
        ],
      },
    ],
  },
  {
    slug: "vitaminas",
    label: "Vitaminas",
    description: "Soporte diario, minerales y suplementos esenciales.",
    groups: [
      {
        title: "Salud diaria",
        links: [
          { label: "Multivitamínicos", href: "/suplementos/vitaminas-suplementos/multivitaminicos" },
          { label: "Omega", href: "/suplementos/vitaminas-suplementos/omega" },
          { label: "Magnesio", href: "/suplementos/vitaminas-suplementos/magnesio" },
        ],
      },
    ],
  },
  {
    slug: "market",
    label: "Market",
    description: "Snacks, barras y alimentos funcionales para el día a día.",
  },
  {
    slug: "accesorios",
    label: "Accesorios",
    description: "Shakers, straps, guantes y herramientas de entrenamiento.",
  },
];

export function getCategories() {
  return categories;
}

export function getCategoryBySlug(slug: string) {
  return categories.find((category) => category.slug === slug);
}
