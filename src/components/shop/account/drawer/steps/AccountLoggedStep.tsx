import { CreditCard, Heart, LockKeyhole, MapPin, Package, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AccountAccessItem } from "@/components/shop/account/drawer/AccountAccessItem";
import { accountRoutes } from "@/lib/routes";
import type { AccountSection, MockAccountUser } from "@/types/account";

const accountAccessItems: Array<{
  section: AccountSection;
  label: string;
  icon: React.ReactNode;
}> = [
  { section: "perfil", label: "Perfil", icon: <UserRound aria-hidden size={20} /> },
  { section: "direcciones", label: "Direcciones", icon: <MapPin aria-hidden size={20} /> },
  { section: "pedidos", label: "Pedidos", icon: <Package aria-hidden size={20} /> },
  { section: "metodos-de-pago", label: "Métodos de pago", icon: <CreditCard aria-hidden size={20} /> },
  { section: "lista-de-deseados", label: "Lista de deseados", icon: <Heart aria-hidden size={20} /> },
  { section: "autenticacion", label: "Autenticación", icon: <LockKeyhole aria-hidden size={20} /> },
];

type AccountLoggedStepProps = {
  user: MockAccountUser;
  onClose: () => void;
  onLogout: () => void;
};

export function AccountLoggedStep({ user, onClose, onLogout }: AccountLoggedStepProps) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <p className="font-subtitle text-sm font-semibold uppercase text-accent">Sesión activa</p>
        <h2 className="font-heading text-4xl leading-none">Mi cuenta</h2>
        <p className="text-sm text-text-muted">{user.email}</p>
      </div>
      <div className="grid gap-3">
        {accountAccessItems.map((item) => (
          <AccountAccessItem
            href={`${accountRoutes.profile}?seccion=${item.section}`}
            icon={item.icon}
            key={item.section}
            label={item.label}
            onClick={onClose}
          />
        ))}
      </div>
      <Button className="w-full" onClick={onLogout} variant="secondary">
        Cerrar sesión
      </Button>
    </div>
  );
}
