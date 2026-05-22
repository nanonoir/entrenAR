import { CreditCard, Heart, LockKeyhole, MapPin, Package, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccountSection } from "@/types/account";

const accountSections: Array<{
  id: AccountSection;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "perfil", label: "Perfil", icon: <UserRound aria-hidden size={18} /> },
  { id: "direcciones", label: "Direcciones", icon: <MapPin aria-hidden size={18} /> },
  { id: "pedidos", label: "Pedidos", icon: <Package aria-hidden size={18} /> },
  { id: "metodos-de-pago", label: "Métodos de Pago", icon: <CreditCard aria-hidden size={18} /> },
  { id: "lista-de-deseados", label: "Lista de Deseados", icon: <Heart aria-hidden size={18} /> },
  { id: "autenticacion", label: "Autenticación", icon: <LockKeyhole aria-hidden size={18} /> },
];

type AccountSidebarProps = {
  activeSection: AccountSection;
  hiddenOnMobile: boolean;
  onSelectSection: (section: AccountSection) => void;
};

export function AccountSidebar({ activeSection, hiddenOnMobile, onSelectSection }: AccountSidebarProps) {
  return (
    <aside className={cn("rounded-card border border-border bg-surface p-3", hiddenOnMobile && "hidden lg:block")}>
      <nav className="grid gap-1">
        {accountSections.map((section) => (
          <button
            className={cn(
              "flex h-12 items-center gap-3 rounded-button px-3 text-left font-subtitle text-sm font-semibold uppercase transition",
              activeSection === section.id
                ? "bg-accent text-on-accent"
                : "text-text hover:bg-accent-soft hover:text-accent-hover",
            )}
            key={section.id}
            onClick={() => onSelectSection(section.id)}
            type="button"
          >
            {section.icon}
            {section.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
