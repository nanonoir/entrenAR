"use client";

import Image from "next/image";
import { type FormEvent, useState } from "react";
import { AccountState, focusFirstInvalidField, getAccountErrorMessage, getAccountFieldError } from "@/components/shop/account/AccountState";
import { PasswordChecklist } from "@/components/shop/account/drawer/PasswordChecklist";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { isValidPassword } from "@/lib/account-validation";
import { ACCOUNT_ASYNC_STATUS } from "@/types/account";
import { useAuthStore } from "@/stores/auth-store";
import { useSearchParams } from "next/navigation";

type ResetPasswordField = "token" | "password" | "passwordConfirmation";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token")?.trim() ?? "";
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const authError = useAuthStore((state) => state.error);
  const status = useAuthStore((state) => state.status);
  const clearError = useAuthStore((state) => state.clearError);
  const [tokenOverride, setTokenOverride] = useState<string | undefined>();
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saved, setSaved] = useState(false);

  const token = tokenOverride ?? tokenFromUrl;
  const errors = getResetPasswordErrors(token, password, passwordConfirmation);
  const isSubmitting = status === ACCOUNT_ASYNC_STATUS.LOADING;

  function fieldError(field: ResetPasswordField) {
    if (!submitted) {
      return undefined;
    }

    const localError = errors[field];
    if (localError) {
      return localError;
    }

    const apiField = field === "passwordConfirmation" ? "password" : field;
    return getAccountFieldError(authError, apiField);
  }

  function updateField(setter: (value: string) => void, value: string) {
    clearError();
    setSaved(false);
    setter(value);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setSubmitted(true);
    setSaved(false);

    if (Object.keys(errors).length > 0) {
      focusFirstInvalidField(
        resetPasswordFieldIds,
        [
          ...(errors.token ? ["reset-password-token"] : []),
          ...(errors.password ? ["reset-password-new"] : []),
          ...(errors.passwordConfirmation ? ["reset-password-confirmation"] : []),
        ],
      );
      return;
    }

    const success = await resetPassword({ password, token: token.trim() });
    if (success) {
      setPassword("");
      setPasswordConfirmation("");
      setSubmitted(false);
      setSaved(true);
    }
  }

  return (
    <section className="bg-surface py-12 sm:py-16">
      <Container>
        <div className="mx-auto grid max-w-md gap-7 rounded-card border border-border bg-white p-6 shadow-sm sm:p-8">
          <div className="grid justify-items-center gap-4 text-center">
            <Image alt="EntrenAR" height={48} priority src="/blackLogo.svg" width={170} />
            <div className="grid gap-2">
              <h1 className="font-heading text-5xl leading-none">Restablecer contraseña</h1>
              <p className="text-sm leading-6 text-text-muted">
                Usá el token del enlace de recuperación para crear una contraseña nueva.
              </p>
            </div>
          </div>

          <form className="grid gap-5" onSubmit={handleSubmit}>
            {submitted && Object.keys(errors).length > 0 ? (
              <div className="rounded-card border border-sale/30 bg-red-50 p-3 text-sm font-medium text-sale" role="alert">
                Revisá los campos marcados antes de continuar.
              </div>
            ) : null}
            {authError ? (
              <div className="rounded-card border border-sale/30 bg-red-50 p-3 text-sm font-medium text-sale" role="alert">
                {getAccountErrorMessage(authError, "No pudimos restablecer la contraseña. Intentá de nuevo.")}
              </div>
            ) : null}
            {saved ? (
              <div className="rounded-card border border-accent/30 bg-accent-soft p-3 text-sm font-medium text-accent" role="status">
                Contraseña restablecida. Ya podés iniciar sesión con la nueva contraseña.
              </div>
            ) : null}
            <Input
              autoComplete="one-time-code"
              errorText={fieldError("token")}
              helperText={fieldError("token") ? undefined : "Pegá el token incluido en el enlace recibido."}
              id="reset-password-token"
              label="Token de recuperación"
              onChange={(event) => updateField(setTokenOverride, event.target.value)}
              value={token}
            />
            <Input
              autoComplete="new-password"
              errorText={fieldError("password")}
              helperText={fieldError("password") ? undefined : "Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo."}
              id="reset-password-new"
              label="Nueva contraseña"
              onChange={(event) => updateField(setPassword, event.target.value)}
              type="password"
              value={password}
            />
            <PasswordChecklist password={password} />
            <Input
              autoComplete="new-password"
              errorText={fieldError("passwordConfirmation")}
              helperText={fieldError("passwordConfirmation") ? undefined : "Repetí la contraseña exactamente igual."}
              id="reset-password-confirmation"
              label="Confirmar contraseña"
              onChange={(event) => updateField(setPasswordConfirmation, event.target.value)}
              type="password"
              value={passwordConfirmation}
            />
            <Button aria-busy={isSubmitting} className="w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Restableciendo..." : "Restablecer contraseña"}
            </Button>
          </form>
        </div>
      </Container>
    </section>
  );
}

export function ResetPasswordFormFallback() {
  return (
    <section className="bg-surface py-12 sm:py-16">
      <Container>
        <AccountState loadingTitle="Cargando el formulario" status={ACCOUNT_ASYNC_STATUS.LOADING}>
          {null}
        </AccountState>
      </Container>
    </section>
  );
}

const resetPasswordFieldIds = [
  "reset-password-token",
  "reset-password-new",
  "reset-password-confirmation",
] as const;

function getResetPasswordErrors(
  token: string,
  password: string,
  passwordConfirmation: string,
): Partial<Record<ResetPasswordField, string>> {
  const errors: Partial<Record<ResetPasswordField, string>> = {};

  if (!token.trim()) {
    errors.token = "Ingresá el token de recuperación.";
  }

  if (!isValidPassword(password)) {
    errors.password = "La contraseña debe cumplir todos los requisitos.";
  }

  if (!passwordConfirmation || password !== passwordConfirmation) {
    errors.passwordConfirmation = "Las contraseñas deben coincidir.";
  }

  return errors;
}
