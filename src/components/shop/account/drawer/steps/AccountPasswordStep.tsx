import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type AccountPasswordStepProps = {
  normalizedEmail: string;
  password: string;
  passwordIsValid: boolean;
  submitted: boolean;
  onForgot: () => void;
  onPasswordChange: (password: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function AccountPasswordStep({
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
      <Input id="login-email" label="Email" readOnly type="email" value={normalizedEmail} />
      <Input
        autoComplete="current-password"
        id="login-password"
        label="Contraseña"
        onChange={(event) => onPasswordChange(event.target.value)}
        type="password"
        value={password}
      />
      {submitted && !passwordIsValid ? (
        <p className="text-xs font-medium text-sale">La contraseña no cumple los requisitos mínimos.</p>
      ) : null}
      <button
        className="justify-self-start text-sm font-semibold text-accent hover:text-accent-hover"
        onClick={onForgot}
        type="button"
      >
        Olvidé mi contraseña
      </button>
      <Button className="w-full" type="submit">
        Iniciar sesión
      </Button>
    </form>
  );
}
