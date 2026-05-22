import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordChecklist } from "@/components/shop/account/drawer/PasswordChecklist";

type AccountRegisterStepProps = {
  normalizedEmail: string;
  password: string;
  passwordConfirmation: string;
  passwordsMatch: boolean;
  submitted: boolean;
  onPasswordChange: (password: string) => void;
  onPasswordConfirmationChange: (password: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function AccountRegisterStep({
  normalizedEmail,
  password,
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
      <Input id="register-email" label="Email" readOnly type="email" value={normalizedEmail} />
      <Input
        autoComplete="new-password"
        id="register-password"
        label="Contraseña"
        onChange={(event) => onPasswordChange(event.target.value)}
        type="password"
        value={password}
      />
      <PasswordChecklist password={password} />
      <Input
        autoComplete="new-password"
        id="register-password-confirmation"
        label="Confirmar contraseña"
        onChange={(event) => onPasswordConfirmationChange(event.target.value)}
        type="password"
        value={passwordConfirmation}
      />
      {submitted && !passwordsMatch ? (
        <p className="text-xs font-medium text-sale">Las contraseñas deben coincidir.</p>
      ) : null}
      <Button className="w-full" type="submit">
        Registrar e iniciar sesión
      </Button>
    </form>
  );
}
