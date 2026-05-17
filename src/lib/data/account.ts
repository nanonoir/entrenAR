import type { AccountNavItem } from "@/types/account";

export const guestAccountLinks: AccountNavItem[] = [
  {
    label: "Iniciar sesión",
    href: "/login",
    variant: "primary",
  },
  {
    label: "Registrarse",
    href: "/register",
    variant: "secondary",
  },
];

export const authenticatedAccountLinks: AccountNavItem[] = [
  {
    label: "Mi cuenta",
    href: "/account",
    variant: "primary",
  },
  {
    label: "Pedidos",
    href: "/account/orders",
    variant: "secondary",
  },
];

export function getMobileAccountLinks({ isAuthenticated = false } = {}) {
  return isAuthenticated ? authenticatedAccountLinks : guestAccountLinks;
}
