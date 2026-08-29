import Image from "next/image";
import Link from "next/link";
import type { FormEvent } from "react";
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
  onLogin: () => void;
  onRegister: () => void;
};

export function AccountStartStep({
  acceptedTerms,
  email,
  submitted,
  onAcceptedTermsChange,
  onBackToMobileMenu,
  onClose,
  onEmailChange,
  onLogin,
  onRegister,
}: AccountStartStepProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onLogin();
  }

  const emailError = submitted && !isValidEmail(email) ? "Ingresá un email válido." : undefined;
  const termsError = submitted && !acceptedTerms ? "Tenés que aceptar los términos para continuar." : undefined;

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <h2 className="font-heading text-4xl leading-none">Iniciar sesión o Registrarse</h2>
        <p className="text-sm leading-6 text-text-muted">
          Accedé a pedidos, favoritos y datos de compra desde tu cuenta.
        </p>
      </div>
      <Button className="w-full justify-center" disabled type="button" variant="secondary">
        <Image alt="" aria-hidden height={20} src="/google.svg" width={20} />
        Continuar con Google
      </Button>
      <Input
        autoComplete="email"
        errorText={emailError}
        helperText={emailError ? undefined : "Usá el email con el que querés acceder."}
        id="account-email"
        label="Email"
        onChange={(event) => onEmailChange(event.target.value)}
        type="email"
        value={email}
      />
      {submitted && (emailError || termsError) ? (
        <div className="rounded-card border border-sale/30 bg-red-50 p-3 text-sm font-medium text-sale" role="alert">
          Revisá los campos marcados antes de continuar.
        </div>
      ) : null}
      <fieldset
        aria-describedby={termsError ? "account-terms-error" : "account-terms-helper"}
        aria-invalid={termsError ? true : undefined}
        className="grid gap-2"
      >
        <legend className="sr-only">Condiciones de la cuenta</legend>
        <label className="grid grid-cols-[18px_1fr] gap-3 text-sm leading-6 text-text-muted" htmlFor="account-terms">
          <input
            aria-describedby={termsError ? "account-terms-error" : "account-terms-helper"}
            aria-invalid={termsError ? true : undefined}
            checked={acceptedTerms}
            className="mt-1 h-4 w-4 accent-accent"
            id="account-terms"
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
        <span className="text-xs text-text-muted" id="account-terms-helper">
          Necesitamos tu aceptación para continuar.
        </span>
        {termsError ? (
          <span className="text-xs font-medium text-sale" id="account-terms-error">
            {termsError}
          </span>
        ) : null}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button className="w-full" type="submit">
          Iniciar sesión
          <ArrowRight aria-hidden size={18} />
        </Button>
        <Button className="w-full" onClick={onRegister} type="button" variant="secondary">
          Registrarse
        </Button>
      </div>
      <div className="grid gap-4 border-t border-border pt-5 lg:hidden">
        <Button className="w-full" onClick={onBackToMobileMenu} type="button" variant="secondary">
          <ArrowLeft aria-hidden size={18} />
          Volver al menú
        </Button>
      </div>
    </form>
  );
}
