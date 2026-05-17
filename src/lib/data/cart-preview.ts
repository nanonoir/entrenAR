import type { CartPreviewItem } from "@/types/cart";

// Mock client-safe para precargar el carrito en el flujo visual estatico. Reemplazar por carrito real/API cuando el backend este implementado.
const previewCartItems: CartPreviewItem[] = [
  {
    productId: "p-whey-pro",
    variantId: "chocolate-900",
    slug: "whey-protein-isolate-900g",
    name: "Whey Protein Isolate 900g",
    brand: "Body Advance",
    variantLabel: "Chocolate",
    quantity: 1,
    price: 58900,
    compareAtPrice: 64900,
    stock: 18,
    imageTone: "green",
  },
  {
    productId: "p-creatine",
    variantId: "sin-sabor-300",
    slug: "creatina-monohidrato-300g",
    name: "Creatina Monohidrato 300g",
    brand: "Star Nutrition",
    variantLabel: "Sin sabor",
    quantity: 2,
    price: 31200,
    stock: 24,
    imageTone: "black",
  },
];

export function getPreviewCartItems() {
  return previewCartItems;
}
