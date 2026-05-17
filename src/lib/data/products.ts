import type { ProductDetail, ProductImage, ProductSummary } from "@/types/product";

const productSeeds: Array<Omit<ProductDetail, "images">> = [
  {
    id: "p-whey-pro",
    slug: "whey-protein-isolate-900g",
    name: "Whey Protein Isolate 900g",
    brand: "Body Advance",
    categorySlug: "proteinas",
    categoryName: "Proteinas",
    imageTone: "green",
    shortDescription: "Proteina aislada de alta pureza para recuperacion muscular.",
    description:
      "Formula pensada para sumar proteina de calidad sin cargar la digestion. Ideal para despues de entrenar o para completar macros en dias exigentes.",
    tags: ["25g proteina", "Bajo azucar", "Sin TACC"],
    price: 78900,
    rating: 4.8,
    reviews: 126,
    stock: 18,
    isFeatured: true,
    isBestSeller: true,
    variants: [
      { id: "chocolate-900", label: "Chocolate", price: 78900, stock: 18 },
      { id: "vainilla-900", label: "Vainilla", price: 78900, stock: 11 },
      { id: "frutilla-900", label: "Frutilla", price: 77900, stock: 7 },
    ],
  },
  {
    id: "p-creatine",
    slug: "creatina-monohidrato-300g",
    name: "Creatina Monohidrato 300g",
    brand: "Star Nutrition",
    categorySlug: "creatina-y-pre",
    categoryName: "Creatina y pre",
    imageTone: "black",
    shortDescription: "Creatina micronizada para fuerza, potencia y volumen.",
    description:
      "Creatina monohidrato sin sabor para incorporar facil a cualquier bebida. Un clasico efectivo cuando se toma todos los dias.",
    tags: ["Micronizada", "Sin sabor", "300g"],
    price: 31200,
    rating: 4.9,
    reviews: 211,
    stock: 24,
    isFeatured: true,
    isBestSeller: true,
    variants: [
      { id: "sin-sabor-300", label: "Sin sabor", price: 31200, stock: 24 },
    ],
  },
  {
    id: "p-pre",
    slug: "pre-workout-energy-250g",
    name: "Pre Workout Energy 250g",
    brand: "ENA",
    categorySlug: "creatina-y-pre",
    categoryName: "Creatina y pre",
    imageTone: "red",
    shortDescription: "Pre entreno con cafeina, beta alanina y citrulina.",
    description:
      "Un pre entreno directo al punto para sesiones intensas. Foco, energia y congestion sin convertir la formula en una ensalada de ingredientes.",
    tags: ["Cafeina", "Beta alanina", "Citrulina"],
    price: 28000,
    compareAtPrice: 40000,
    rating: 4.6,
    reviews: 88,
    stock: 6,
    isFeatured: true,
    isBestSeller: true,
    variants: [
      { id: "uva-250", label: "Uva", price: 28000, compareAtPrice: 40000, stock: 6 },
      { id: "frutos-250", label: "Frutos rojos", price: 28000, stock: 0 },
    ],
  },
  {
    id: "p-boxy",
    slug: "remera-boxy-fit-drop-0",
    name: "Remera Boxy Fit DROP #0",
    brand: "EntrenAR",
    categorySlug: "indumentaria",
    categoryName: "Indumentaria",
    imageTone: "blue",
    shortDescription: "Remera boxy fit para entrenar o usar todos los dias.",
    description:
      "Remera de calce boxy con algodon pesado, cuello reforzado y estampa EntrenAR.",
    tags: ["Boxy fit", "Algodon", "Drop limitado"],
    price: 49999,
    compareAtPrice: 71990,
    rating: 4.7,
    reviews: 42,
    stock: 18,
    isFeatured: true,
    isBestSeller: true,
    variantOptions: [
      {
        id: "color",
        label: "Color",
        values: [
          { id: "negro", label: "Negro", swatch: "#111111" },
          { id: "azul", label: "Azul", swatch: "#0B3F8A" },
        ],
      },
      {
        id: "talle",
        label: "Talle",
        values: [
          { id: "s", label: "S" },
          { id: "m", label: "M" },
          { id: "l", label: "L" },
          { id: "xl", label: "XL" },
        ],
      },
    ],
    variants: [
      {
        id: "negro-s",
        label: "Negro / S",
        price: 49999,
        compareAtPrice: 71990,
        stock: 4,
        optionValues: { color: "negro", talle: "s" },
      },
      {
        id: "negro-m",
        label: "Negro / M",
        price: 49999,
        compareAtPrice: 71990,
        stock: 5,
        optionValues: { color: "negro", talle: "m" },
      },
      {
        id: "negro-l",
        label: "Negro / L",
        price: 49999,
        compareAtPrice: 71990,
        stock: 0,
        optionValues: { color: "negro", talle: "l" },
      },
      {
        id: "negro-xl",
        label: "Negro / XL",
        price: 49999,
        compareAtPrice: 71990,
        stock: 2,
        optionValues: { color: "negro", talle: "xl" },
      },
      {
        id: "azul-s",
        label: "Azul / S",
        price: 49999,
        compareAtPrice: 71990,
        stock: 3,
        optionValues: { color: "azul", talle: "s" },
      },
      {
        id: "azul-m",
        label: "Azul / M",
        price: 49999,
        compareAtPrice: 71990,
        stock: 4,
        optionValues: { color: "azul", talle: "m" },
      },
      {
        id: "azul-l",
        label: "Azul / L",
        price: 49999,
        compareAtPrice: 71990,
        stock: 3,
        optionValues: { color: "azul", talle: "l" },
      },
      {
        id: "azul-xl",
        label: "Azul / XL",
        price: 49999,
        compareAtPrice: 71990,
        stock: 0,
        optionValues: { color: "azul", talle: "xl" },
      },
    ],
  },
  {
    id: "p-bar",
    slug: "protein-bar-chocolate-box",
    name: "Protein Bar Chocolate Box",
    brand: "Gentech",
    categorySlug: "market",
    categoryName: "Market",
    imageTone: "blue",
    shortDescription: "Caja de barras proteicas para resolver snacks.",
    description:
      "Barras con buen aporte proteico para tener en la mochila, la oficina o despues del gimnasio.",
    tags: ["12 unidades", "Snack", "Chocolate"],
    price: 22800,
    rating: 4.4,
    reviews: 39,
    stock: 20,
    isFeatured: true,
    isBestSeller: true,
    variants: [{ id: "box-12", label: "Chocolate", price: 22800, stock: 20 }],
  },
  {
    id: "p-shaker",
    slug: "shaker-entrenar-700ml",
    name: "Shaker EntrenAR 700ml",
    brand: "EntrenAR",
    categorySlug: "shakers",
    categoryName: "Shakers",
    imageTone: "green",
    shortDescription: "Shaker con tapa segura y mezclador interno.",
    description:
      "Un shaker resistente para proteinas, creatina y bebidas intra entrenamiento.",
    tags: ["700ml", "BPA free", "Mezclador"],
    price: 8900,
    rating: 4.7,
    reviews: 74,
    stock: 32,
    isBestSeller: true,
    variants: [
      { id: "negro-700", label: "Negro 700ml", price: 8900, stock: 17 },
      { id: "verde-700", label: "Verde 700ml", price: 8900, stock: 15 },
    ],
  },
  {
    id: "p-mrs-taste",
    slug: "mrs-taste-chocolate-zero-335g",
    name: "Mrs Taste Chocolate Zero 335g",
    brand: "Mrs Taste",
    categorySlug: "market",
    categoryName: "Market",
    imageTone: "amber",
    shortDescription: "Salsa dulce sin azucar para sumar sabor a tus comidas.",
    description: "Salsa de chocolate sin azucar ideal para pancakes, frutas, yogures o snacks proteicos.",
    tags: ["Sin azucar", "Chocolate", "335g"],
    price: 11372,
    compareAtPrice: 14215,
    rating: 4.6,
    reviews: 31,
    stock: 18,
    isBestSeller: true,
    variants: [{ id: "chocolate-335", label: "Chocolate", price: 11372, compareAtPrice: 14215, stock: 18 }],
  },
  {
    id: "p-magnesio",
    slug: "ena-citrato-magnesio-60-caps",
    name: "ENA Citrato de Magnesio 60 CAPS",
    brand: "ENA",
    categorySlug: "vitaminas",
    categoryName: "Vitaminas",
    imageTone: "blue",
    shortDescription: "Magnesio en capsulas para soporte diario.",
    description: "Citrato de magnesio para acompanar recuperacion, descanso y bienestar general.",
    tags: ["60 caps", "Magnesio", "Diario"],
    price: 13940,
    compareAtPrice: 17425,
    rating: 4.5,
    reviews: 24,
    stock: 14,
    isBestSeller: true,
    variants: [{ id: "60-caps", label: "Unico", price: 13940, compareAtPrice: 17425, stock: 14 }],
  },
  {
    id: "p-pancakes",
    slug: "granger-pancake-proteicos-400g",
    name: "Granger Pancake Proteicos 400g",
    brand: "Granger",
    categorySlug: "market",
    categoryName: "Market",
    imageTone: "black",
    shortDescription: "Mezcla para pancakes proteicos rapidos.",
    description: "Preparacion proteica para resolver desayunos o meriendas con buen aporte nutricional.",
    tags: ["400g", "Proteico", "Pancakes"],
    price: 14000,
    compareAtPrice: 17500,
    rating: 4.4,
    reviews: 28,
    stock: 10,
    isBestSeller: true,
    variants: [{ id: "400g", label: "Unico", price: 14000, compareAtPrice: 17500, stock: 10 }],
  },
  {
    id: "p-bull-bar-caja",
    slug: "bull-bar-60gr-caja-x12",
    name: "Bull Bar 60gr Caja x12",
    brand: "Bull Bar",
    categorySlug: "market",
    categoryName: "Market",
    imageTone: "blue",
    shortDescription: "Caja de barras de whey para snacks proteicos.",
    description: "Barras proteicas practicas para llevar a entrenar, trabajar o estudiar.",
    tags: ["Caja x12", "Whey", "Snack"],
    price: 34800,
    compareAtPrice: 43500,
    rating: 4.6,
    reviews: 36,
    stock: 12,
    isBestSeller: true,
    variants: [{ id: "caja-x12", label: "Chocolate", price: 34800, compareAtPrice: 43500, stock: 12 }],
  },
  {
    id: "p-notco-bar",
    slug: "notco-protein-bar-chocolate",
    name: "Notco Protein Bar Chocolate",
    brand: "Notco",
    categorySlug: "market",
    categoryName: "Market",
    imageTone: "green",
    shortDescription: "Barra proteica plant based sabor chocolate.",
    description: "Snack plant based con aporte proteico para resolver comidas entre horas.",
    tags: ["Plant based", "Chocolate", "Snack"],
    price: 4200,
    compareAtPrice: 5250,
    rating: 4.3,
    reviews: 18,
    stock: 30,
    isBestSeller: true,
    variants: [{ id: "chocolate-unit", label: "Chocolate", price: 4200, compareAtPrice: 5250, stock: 30 }],
  },
  {
    id: "p-smartdiet-alfajor",
    slug: "smartdiet-alfajor-proteico",
    name: "Smartdiet Alfajor Proteico",
    brand: "Smartdiet",
    categorySlug: "market",
    categoryName: "Market",
    imageTone: "amber",
    shortDescription: "Alfajor proteico para sumar algo dulce.",
    description: "Alfajor con aporte proteico para quienes buscan una opcion dulce mas funcional.",
    tags: ["Alfajor", "Proteico", "Snack"],
    price: 3100,
    compareAtPrice: 3900,
    rating: 4.4,
    reviews: 22,
    stock: 28,
    isBestSeller: true,
    variants: [{ id: "unidad", label: "Unidad", price: 3100, compareAtPrice: 3900, stock: 28 }],
  },
  {
    id: "p-entrenuts-mix",
    slug: "entrenuts-mix-frutos-secos-500g",
    name: "Entrenuts Mix Frutos Secos 500g",
    brand: "Entrenuts",
    categorySlug: "market",
    categoryName: "Market",
    imageTone: "red",
    shortDescription: "Mix de frutos secos para energia rapida.",
    description: "Mix de frutos secos seleccionado para sumar grasas buenas y energia durante el dia.",
    tags: ["500g", "Frutos secos", "Energia"],
    price: 9200,
    compareAtPrice: 11500,
    rating: 4.5,
    reviews: 27,
    stock: 16,
    variants: [{ id: "500g", label: "Unico", price: 9200, compareAtPrice: 11500, stock: 16 }],
  },
  {
    id: "p-gold-oil",
    slug: "gold-nutrition-fish-oil-60-softgels",
    name: "Gold Nutrition Fish Oil 60 Softgels",
    brand: "Gold Nutrition",
    categorySlug: "vitaminas",
    categoryName: "Vitaminas",
    imageTone: "black",
    shortDescription: "Omega 3 en softgels para soporte diario.",
    description: "Fish oil en capsulas blandas para acompanar salud cardiovascular y recuperacion.",
    tags: ["Omega 3", "60 softgels", "Diario"],
    price: 15800,
    compareAtPrice: 19750,
    rating: 4.5,
    reviews: 33,
    stock: 11,
    variants: [{ id: "60-softgels", label: "Unico", price: 15800, compareAtPrice: 19750, stock: 11 }],
  },
];

const galleryToneOrder: ProductImage["tone"][] = ["green", "black", "red", "amber", "blue"];

function createProductImages(product: Omit<ProductDetail, "images">): ProductImage[] {
  const baseToneIndex = Math.max(0, galleryToneOrder.indexOf(product.imageTone));

  return Array.from({ length: 4 }, (_, index) => {
    const tone = galleryToneOrder[(baseToneIndex + index) % galleryToneOrder.length];
    const label = index === 0 ? "Principal" : `Vista ${index + 1}`;

    return {
      id: `${product.id}-image-${index + 1}`,
      alt: `${product.name} - ${label}`,
      label,
      tone,
    };
  });
}

const products: ProductDetail[] = productSeeds.map((product) => ({
  ...product,
  images: createProductImages(product),
}));

export function getFeaturedProducts(): ProductSummary[] {
  return products.filter((product) => product.isFeatured);
}

export function getFeaturedProductDetails(): ProductDetail[] {
  return products.filter((product) => product.isFeatured);
}

export function getBestSellerProductDetails(): ProductDetail[] {
  return products.filter((product) => product.isBestSeller);
}

export function getProductsByCategory(slug: string): ProductSummary[] {
  return products.filter((product) => product.categorySlug === slug);
}

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getAllProducts(): ProductSummary[] {
  return products;
}

export function getAllProductDetails(): ProductDetail[] {
  return products;
}
