import type { PromoMessage } from "@/types/promotions";

export const promoMessages: PromoMessage[] = [
  {
    id: "free-shipping",
    text: "Env\u00edo Gratis a partir de $75.000 ARS",
  },
  {
    id: "installments",
    text: "Hasta 6 cuotas sin inter\u00e9s",
  },
];

export function getPromoMessages() {
  return promoMessages;
}
