import Link from "next/link";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { isValidEmail } from "@/lib/account-validation";

type AccountForgotStepProps = {
  email: string;
  error?: string;
  forgotSent: boolean;
  isSubmitting: boolean;
  normalizedEmail: string;
  onBackToPassword: () => void;
  onClose: () => void;
  onEmailChange: (email: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  submitted: boolean;
};

export function AccountForgotStep({
  email,
  error,
  forgotSent,
  isSubmitting,
  normalizedEmail,
  onBackToPassword,
  onClose,
  onEmailChange,
  onSubmit,
  submitted,
}: AccountForgotStepProps) {
  if (forgotSent) {
    return (
      <div className="grid gap-5">
        <div className="grid gap-2">
          <p className="font-subtitle text-sm font-semibold uppercase text-accent">Recuperación</p>
          <h2 className="font-heading text-4xl leading-none">Revisá tu email</h2>
          <p className="text-sm leading-6 text-text-muted">
            Si existe una cuenta para {normalizedEmail}, vas a recibir instrucciones para cambiar tu contraseña.
          </p>
        </div>
        <Link
          className="font-semibold text-accent hover:text-accent-hover"
          href="/restablecer-contrasena"
          onClick={onClose}
        >
          Ya tengo un token de recuperación
        </Link>
        <Button onClick={onBackToPassword} variant="secondary">
          Volver a iniciar sesión
        </Button>
      </div>
    );
  }

  const emailError = submitted && !isValidEmail(email) ? "Ingresá un email válido." : undefined;

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <p className="font-subtitle text-sm font-semibold uppercase text-accent">Recuperación</p>
        <h2 className="font-heading text-4xl leading-none">Recuperá tu contraseña</h2>
        <p className="text-sm leading-6 text-text-muted">
          Ingresá tu email y te enviaremos instrucciones si hay una cuenta asociada.
        </p>
      </div>
      <Input
        autoComplete="email"
        errorText={emailError}
        helperText={emailError ? undefined : "La respuesta será la misma exista o no una cuenta."}
        id="forgot-email"
        label="Email"
        onChange={(event) => onEmailChange(event.target.value)}
        type="email"
        value={email}
      />
      {error ? (
        <div className="rounded-card border border-sale/30 bg-red-50 p-3 text-sm font-medium text-sale" role="alert">
          {error}
        </div>
      ) : null}
      {emailError ? (
        <div className="rounded-card border border-sale/30 bg-red-50 p-3 text-sm font-medium text-sale" role="alert">
          Revisá el email antes de continuar.
        </div>
      ) : null}
      <Button aria-busy={isSubmitting} className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Enviando..." : "Enviar instrucciones"}
      </Button>
      <Button onClick={onBackToPassword} type="button" variant="secondary">
        Volver
      </Button>
    </form>
  );
}
