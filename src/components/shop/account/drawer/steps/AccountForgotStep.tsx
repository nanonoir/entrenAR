import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { accountRoutes } from "@/lib/routes";

type AccountForgotStepProps = {
  normalizedEmail: string;
  onBackToPassword: () => void;
  onClose: () => void;
};

export function AccountForgotStep({ normalizedEmail, onBackToPassword, onClose }: AccountForgotStepProps) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <p className="font-subtitle text-sm font-semibold uppercase text-accent">Recuperación</p>
        <h2 className="font-heading text-4xl leading-none">Email enviado</h2>
        <p className="text-sm leading-6 text-text-muted">
          Si existe una cuenta para {normalizedEmail}, vas a recibir instrucciones para cambiar tu contraseña.
        </p>
      </div>
      <Link
        className="font-semibold text-accent hover:text-accent-hover"
        href={accountRoutes.passwordReset}
        onClick={onClose}
      >
        Ir a cambiar contraseña
      </Link>
      <Button onClick={onBackToPassword} variant="secondary">
        Volver
      </Button>
    </div>
  );
}
