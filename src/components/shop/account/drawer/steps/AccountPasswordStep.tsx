import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type AccountPasswordStepProps = {
  error?: string;
  isSubmitting: boolean;
  normalizedEmail: string;
  password: string;
  passwordIsValid: boolean;
  submitted: boolean;
  onForgot: () => void;
  onPasswordChange: (password: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

export function AccountPasswordStep({
  error,
  isSubmitting,
  normalizedEmail,
  password,
  passwordIsValid,
  submitted,
  onForgot,
  onPasswordChange,
  onSubmit,
}: AccountPasswordStepProps) {
  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <p className="font-subtitle text-sm font-semibold uppercase text-accent">Hola de nuevo</p>
        <h2 className="font-heading text-4xl leading-none">Bienvenido</h2>
        <p className="text-sm text-text-muted">{normalizedEmail}</p>
      </div>
      <Input
        helperText="Cuenta con la que vas a iniciar sesión."
        id="login-email"
        label="Email"
        readOnly
        type="email"
        value={normalizedEmail}
      />
      <Input
        autoComplete="current-password"
        errorText={submitted && !passwordIsValid ? "La contraseña no cumple los requisitos mínimos." : undefined}
        helperText={submitted && !passwordIsValid ? undefined : "Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo."}
        id="login-password"
        label="Contraseña"
        onChange={(event) => onPasswordChange(event.target.value)}
        type="password"
        value={password}
      />
      {error ? (
        <div className="rounded-card border border-sale/30 bg-red-50 p-3 text-sm font-medium text-sale" role="alert">
          {error}
        </div>
      ) : null}
      {submitted && !passwordIsValid ? (
        <div className="rounded-card border border-sale/30 bg-red-50 p-3 text-sm font-medium text-sale" role="alert">
          Revisá la contraseña antes de continuar.
        </div>
      ) : null}
      <button
        className="justify-self-start text-sm font-semibold text-accent hover:text-accent-hover"
        disabled={isSubmitting}
        onClick={onForgot}
        type="button"
      >
        Olvidé mi contraseña
      </button>
      <Button aria-busy={isSubmitting} className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}
      </Button>
    </form>
  );
}
