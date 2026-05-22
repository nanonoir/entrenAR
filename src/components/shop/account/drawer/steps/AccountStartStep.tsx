import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { isValidEmail } from "@/lib/account-validation";
import { accountRoutes } from "@/lib/routes";

type AccountStartStepProps = {
  acceptedTerms: boolean;
  email: string;
  submitted: boolean;
  onAcceptedTermsChange: (accepted: boolean) => void;
  onBackToMobileMenu: () => void;
  onClose: () => void;
  onEmailChange: (email: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function AccountStartStep({
  acceptedTerms,
  email,
  submitted,
  onAcceptedTermsChange,
  onBackToMobileMenu,
  onClose,
  onEmailChange,
  onSubmit,
}: AccountStartStepProps) {
  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <h2 className="font-heading text-4xl leading-none">Iniciar sesión o Registrarse</h2>
        <p className="text-sm leading-6 text-text-muted">
          Accedé a pedidos, favoritos y datos de compra con una vista previa local.
        </p>
      </div>
      <Button className="w-full justify-center" type="button" variant="secondary">
        <Image alt="" aria-hidden height={20} src="/google.svg" width={20} />
        Continuar con Google
      </Button>
      <div className="grid gap-2">
        <Input
          autoComplete="email"
          id="account-email"
          label="Email"
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="tu@email.com"
          type="email"
          value={email}
        />
        {submitted && !isValidEmail(email) ? (
          <p className="text-xs font-medium text-sale">Ingresá un email válido.</p>
        ) : null}
      </div>
      <label className="grid grid-cols-[18px_1fr] gap-3 text-sm leading-6 text-text-muted">
        <input
          checked={acceptedTerms}
          className="mt-1 h-4 w-4 accent-accent"
          onChange={(event) => onAcceptedTermsChange(event.target.checked)}
          type="checkbox"
        />
        <span>
          Acepto los{" "}
          <Link
            className="font-semibold text-accent hover:text-accent-hover"
            href={accountRoutes.terms}
            onClick={onClose}
          >
            términos y condiciones
          </Link>{" "}
          y la{" "}
          <Link
            className="font-semibold text-accent hover:text-accent-hover"
            href={accountRoutes.privacy}
            onClick={onClose}
          >
            política de privacidad
          </Link>
          .
        </span>
      </label>
      {submitted && !acceptedTerms ? (
        <p className="text-xs font-medium text-sale">Tenés que aceptar los términos para continuar.</p>
      ) : null}
      <Button className="w-full" type="submit">
        Continuar
        <ArrowRight aria-hidden size={18} />
      </Button>
      <div className="grid gap-4 border-t border-border pt-5 lg:hidden">
        <Button className="w-full" onClick={onBackToMobileMenu} type="button" variant="secondary">
          <ArrowLeft aria-hidden size={18} />
          Volver al menú
        </Button>
      </div>
    </form>
  );
}
