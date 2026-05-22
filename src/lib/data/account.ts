import { accountRoutes } from "@/lib/routes";
import type { AccountNavItem, AccountOrder } from "@/types/account";

const EXISTING_ACCOUNT_EMAILS = new Set(["cliente@entrenar.com"]);

export const accountEntryLabel = "Iniciar sesión / Registrarse";

export const guestAccountLinks: AccountNavItem[] = [
  {
    label: accountEntryLabel,
    href: "#cuenta",
    variant: "primary",
  },
];

export const authenticatedAccountLinks: AccountNavItem[] = [
  {
    label: "Mi cuenta",
    href: accountRoutes.profile,
    variant: "primary",
  },
  {
    label: "Pedidos",
    href: `${accountRoutes.profile}?seccion=pedidos`,
    variant: "secondary",
  },
];

export function getMobileAccountLinks({ isAuthenticated = false } = {}) {
  return isAuthenticated ? authenticatedAccountLinks : guestAccountLinks;
}

export function findMockAccountByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!EXISTING_ACCOUNT_EMAILS.has(normalizedEmail)) {
    return null;
  }

  return {
    email: normalizedEmail,
    name: "Cliente",
  };
}

export const accountOrders: AccountOrder[] = [
  {
    id: "EA-10248",
    date: "12/05/2026",
    status: "en-camino",
    total: 110100,
    trackingCode: "TRK-ENT-7842",
    items: [
      { id: "p-whey-pro", name: "Whey Protein Isolate 900g", quantity: 1, price: 78900 },
      { id: "p-creatine", name: "Creatina Monohidrato 300g", quantity: 1, price: 31200 },
    ],
  },
  {
    id: "EA-10191",
    date: "28/04/2026",
    status: "entregado",
    total: 57600,
    trackingCode: "TRK-ENT-7310",
    items: [
      { id: "p-bull-bar-caja", name: "Bull Bar 60gr Caja x12", quantity: 1, price: 34800 },
      { id: "p-bar", name: "Protein Bar Chocolate Box", quantity: 1, price: 22800 },
    ],
  },
  {
    id: "EA-10077",
    date: "09/04/2026",
    status: "preparacion",
    total: 49999,
    trackingCode: "TRK-ENT-6904",
    items: [{ id: "p-boxy", name: "Remera Boxy Fit DROP #0", quantity: 1, price: 49999 }],
  },
];
