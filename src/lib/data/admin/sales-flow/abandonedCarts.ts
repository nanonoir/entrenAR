import type { AbandonedCart, RecoveryConfig, RecoveryEmailTemplate } from "@/lib/data/admin/sales-flow/types";

export const mockAbandonedCarts: AbandonedCart[] = [
  {
    id: "CART-901",
    abandonedAt: "2026-06-12T10:15:00.000Z",
    customer: {
      firstName: "Lucía",
      lastName: "Molina",
      email: "lucia.molina@example.com",
      phone: "+54 11 6123-4455",
    },
    products: [
      { productId: "p-whey-pro", name: "Whey Protein Isolate 900g", quantity: 1, unitPrice: 78900 },
      { productId: "p-shaker", variantId: "negro-700", name: "Shaker EntrenAR 700ml", quantity: 1, unitPrice: 8900 },
    ],
    total: 87800,
    recoveryStatus: "pending",
  },
  {
    id: "CART-902",
    abandonedAt: "2026-06-09T18:40:00.000Z",
    customer: {
      firstName: "Julián",
      lastName: "Ramos",
      email: "julian.ramos@example.com",
    },
    products: [
      { productId: "p-creatine", name: "Creatina Monohidrato 300g", quantity: 2, unitPrice: 31200 },
    ],
    total: 62400,
    recoveryStatus: "sent",
    lastEmailSentAt: "2026-06-10T18:40:00.000Z",
  },
  {
    id: "CART-903",
    abandonedAt: "2026-05-29T13:05:00.000Z",
    customer: {
      firstName: "Florencia",
      lastName: "Benítez",
      email: "florencia.benitez@example.com",
      phone: "+54 341 555-0191",
    },
    products: [
      { productId: "p-boxy", variantId: "negro-m", name: "Remera Boxy Fit DROP #0", quantity: 1, unitPrice: 49999 },
      { productId: "p-pre", name: "Pre Workout Energy 250g", quantity: 1, unitPrice: 28000 },
    ],
    total: 77999,
    recoveryStatus: "manual",
  },
  {
    id: "CART-904",
    abandonedAt: "2026-04-28T09:30:00.000Z",
    customer: {
      firstName: "Nicolás",
      lastName: "Castro",
      email: "nicolas.castro@example.com",
    },
    products: [
      { productId: "p-pre", name: "Pre Workout Energy 250g", quantity: 1, unitPrice: 28000 },
    ],
    total: 28000,
    recoveryStatus: "recovered",
    lastEmailSentAt: "2026-04-29T09:30:00.000Z",
  },
];

export const mockRecoveryConfig: RecoveryConfig = {
  timing: "24hs",
  isActive: true,
};

export const mockRecoveryEmailTemplate: RecoveryEmailTemplate = {
  subject: "Te guardamos tu carrito en EntrenAR",
  htmlBody: `<p>Hola {{nombre}},</p>\n<p>Vimos que dejaste productos en tu carrito. Todavía podés completar tu compra antes de que se agote el stock.</p>\n<p><strong>Total estimado:</strong> {{total}}</p>\n<p><a href="{{checkoutUrl}}">Volver a mi carrito</a></p>`,
  plainTextBody: "Hola {{nombre}},\n\nVimos que dejaste productos en tu carrito. Todavía podés completar tu compra antes de que se agote el stock.\n\nTotal estimado: {{total}}\n\nVolver a mi carrito: {{checkoutUrl}}",
};
