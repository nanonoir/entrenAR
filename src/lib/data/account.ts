import type { AccountNavItem } from "@/types/account";

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
    href: "#cuenta",
    variant: "primary",
  },
  {
    label: "Pedidos",
    href: "#cuenta",
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
    name: "Cliente EntrenAR",
  };
}
