import type { AdminPurchaseOrder } from "@/lib/data/admin/sales-flow/types";

export const mockPurchaseOrders: AdminPurchaseOrder[] = [
  {
    id: "OC-2026-483921",
    createdAt: "2026-06-09T11:00:00.000Z",
    source: "Facebook Marketplace",
    customer: {
      firstName: "Nicolás",
      lastName: "Ferreyra",
      email: "nicolas.ferreyra@example.com",
      phone: "+54 261 345-6789",
    },
    shippingAddress: {
      street: "Rivadavia",
      number: "1200",
      city: "Mendoza",
      province: "Mendoza",
      postalCode: "5500",
      country: "Argentina",
    },
    products: [
      { productId: "p-bar", name: "Protein Bar Chocolate Box", quantity: 2, unitPrice: 22800 },
    ],
    status: "pending",
    subtotal: 45600,
    shippingCost: 3200,
    total: 48800,
    history: [
      {
        id: "h-oc-483921-1",
        type: "sale_created",
        date: "2026-06-09T11:00:00.000Z",
        actor: "Admin",
        note: "Orden de compra creada.",
      },
    ],
  },
  {
    id: "OC-2026-111222",
    createdAt: "2026-06-08T16:30:00.000Z",
    source: "WhatsApp",
    customer: {
      firstName: "Sofía",
      lastName: "Ledesma",
      email: "sofia.ledesma@example.com",
    },
    products: [
      { productId: "p-boxy", variantId: "negro-m", name: "Remera Boxy Fit DROP #0 (Negro / M)", quantity: 1, unitPrice: 49999 },
    ],
    status: "converted",
    subtotal: 49999,
    shippingCost: 0,
    total: 49999,
    convertedSaleId: "103",
    history: [
      {
        id: "h-oc-111222-1",
        type: "sale_created",
        date: "2026-06-08T16:30:00.000Z",
        actor: "Admin",
        note: "Orden de compra creada.",
      },
      {
        id: "h-oc-111222-2",
        type: "order_converted",
        date: "2026-06-12T09:15:00.000Z",
        actor: "Admin",
        note: "Convertida a venta #103.",
      },
    ],
  },
];
