import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordChecklist } from "@/components/shop/account/drawer/PasswordChecklist";

type AccountRegisterStepProps = {
  error?: string;
  isSubmitting: boolean;
  normalizedEmail: string;
  password: string;
  passwordIsValid: boolean;
  passwordConfirmation: string;
  passwordsMatch: boolean;
  submitted: boolean;
  onPasswordChange: (password: string) => void;
  onPasswordConfirmationChange: (password: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

export function AccountRegisterStep({
  error,
  isSubmitting,
  normalizedEmail,
  password,
  passwordIsValid,
  passwordConfirmation,
  passwordsMatch,
  submitted,
  onPasswordChange,
  onPasswordConfirmationChange,
  onSubmit,
}: AccountRegisterStepProps) {
  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <p className="font-subtitle text-sm font-semibold uppercase text-accent">Cuenta nueva</p>
        <h2 className="font-heading text-4xl leading-none">Crea tu acceso</h2>
        <p className="text-sm text-text-muted">{normalizedEmail}</p>
      </div>
      <Input
        helperText="Este email se usará para tu cuenta."
        id="register-email"
        label="Email"
        readOnly
        type="email"
        value={normalizedEmail}
      />
      <Input
        autoComplete="new-password"
        errorText={submitted && !passwordIsValid ? "La contraseña no cumple los requisitos mínimos." : undefined}
        helperText={submitted && !passwordIsValid ? undefined : "Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo."}
        id="register-password"
        label="Contraseña"
        onChange={(event) => onPasswordChange(event.target.value)}
        type="password"
        value={password}
      />
      <PasswordChecklist password={password} />
      <Input
        autoComplete="new-password"
        errorText={submitted && !passwordsMatch ? "Las contraseñas deben coincidir." : undefined}
        helperText={submitted && !passwordsMatch ? undefined : "Repetí la contraseña exactamente igual."}
        id="register-password-confirmation"
        label="Confirmar contraseña"
        onChange={(event) => onPasswordConfirmationChange(event.target.value)}
        type="password"
        value={passwordConfirmation}
      />
      {error ? (
        <div className="rounded-card border border-sale/30 bg-red-50 p-3 text-sm font-medium text-sale" role="alert">
          {error}
        </div>
      ) : null}
      {submitted && (!passwordIsValid || !passwordsMatch) ? (
        <div className="rounded-card border border-sale/30 bg-red-50 p-3 text-sm font-medium text-sale" role="alert">
          Revisá los campos marcados antes de crear tu cuenta.
        </div>
      ) : null}
      <Button aria-busy={isSubmitting} className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Creando cuenta..." : "Registrar e iniciar sesión"}
      </Button>
    </form>
  );
}
