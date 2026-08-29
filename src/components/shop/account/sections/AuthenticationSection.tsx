import { Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { SectionHeader } from "@/components/shop/account/dashboard/SectionHeader";
import { accountRoutes } from "@/lib/routes";

type AuthenticationSectionProps = {
  email: string;
};

export function AuthenticationSection({ email }: AuthenticationSectionProps) {
  return (
    <div>
      <SectionHeader title="Autenticación" />
      <div className="grid gap-4">
        <div className="rounded-card border border-border bg-white p-4">
          <p className="font-subtitle text-sm font-semibold uppercase text-text-muted">Email</p>
          <p className="mt-1 font-medium">{email}</p>
          <Button className="mt-3" disabled variant="secondary">
            Cambio de email próximamente
          </Button>
        </div>
        <div className="rounded-card border border-border bg-white p-4">
          <p className="font-subtitle text-sm font-semibold uppercase text-text-muted">Contraseña</p>
          <p className="mt-1 text-sm text-text-muted">Última actualización no disponible en esta vista mock.</p>
          <LinkButton className="mt-3" href={accountRoutes.passwordReset} variant="secondary">
            Cambiar Contraseña
          </LinkButton>
        </div>
        <div className="rounded-card border border-border bg-white p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent">
              <Shield aria-hidden size={20} />
            </span>
            <div>
              <p className="font-subtitle text-sm font-semibold uppercase text-text-muted">
                Autenticación de doble factor
              </p>
              <Button className="mt-3" disabled>Añadir Autenticación de doble factor</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
