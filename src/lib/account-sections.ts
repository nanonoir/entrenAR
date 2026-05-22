import type { AccountSection } from "@/types/account";

export const accountSectionIds: AccountSection[] = [
  "perfil",
  "direcciones",
  "pedidos",
  "metodos-de-pago",
  "lista-de-deseados",
  "autenticacion",
];

export function isAccountSection(value: string | null): value is AccountSection {
  return value !== null && accountSectionIds.includes(value as AccountSection);
}
