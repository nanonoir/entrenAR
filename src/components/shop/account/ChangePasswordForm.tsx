"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useState } from "react";
import { AccountState, focusFirstInvalidField, getAccountErrorMessage, getAccountFieldError } from "@/components/shop/account/AccountState";
import { PasswordChecklist } from "@/components/shop/account/drawer/PasswordChecklist";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { isValidPassword } from "@/lib/account-validation";
import { ACCOUNT_ASYNC_STATUS } from "@/types/account";
import { useAuthStore } from "@/stores/auth-store";
import { useUIStore } from "@/stores/ui-store";

type ChangePasswordField = "currentPassword" | "newPassword" | "passwordConfirmation";

export function ChangePasswordForm() {
  const user = useAuthStore((state) => state.user);
  const authStatus = useAuthStore((state) => state.status);
  const authError = useAuthStore((state) => state.error);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const changePassword = useAuthStore((state) => state.changePassword);
  const clearError = useAuthStore((state) => state.clearError);
  const openAccountDrawer = useUIStore((state) => state.openAccountDrawer);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<ChangePasswordField, boolean>>>({});

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      setHydrated(false);
      await useAuthStore.persist.rehydrate();
      await bootstrap();

      if (!cancelled) {
        setHydrated(true);
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [bootstrap, bootstrapAttempt]);

  const errors = getChangePasswordErrors(currentPassword, newPassword, passwordConfirmation);
  const isLoading = isSaving || authStatus === ACCOUNT_ASYNC_STATUS.LOADING;

  function fieldError(field: ChangePasswordField) {
    if (!submitted && !touchedFields[field]) {
      return undefined;
    }

    const localError = errors[field];
    if (localError) {
      return localError;
    }

    return getAccountFieldError(authError, field === "passwordConfirmation" ? "newPassword" : field);
  }

  function markTouched(field: ChangePasswordField) {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  }

  function clearFeedback() {
    setSaved(false);
    clearError();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) {
      return;
    }

    setSubmitted(true);
    setSaved(false);

    if (Object.keys(errors).length > 0) {
      focusFirstInvalidField(
        changePasswordFieldIds,
        [
          ...(errors.currentPassword ? ["change-current-password"] : []),
          ...(errors.newPassword ? ["change-new-password"] : []),
          ...(errors.passwordConfirmation ? ["change-password-confirmation"] : []),
        ],
      );
      return;
    }

    setIsSaving(true);
    const success = await changePassword({ currentPassword, newPassword });
    setIsSaving(false);

    if (success) {
      setCurrentPassword("");
      setNewPassword("");
      setPasswordConfirmation("");
      setSaved(true);
      setSubmitted(false);
      setTouchedFields({});
    }
  }

  function retryBootstrap() {
    useAuthStore.setState({
      error: null,
      isBootstrapped: false,
      status: ACCOUNT_ASYNC_STATUS.IDLE,
    });
    setHydrated(false);
    setBootstrapAttempt((attempt) => attempt + 1);
  }

  if (!hydrated) {
    return (
      <section className="bg-surface py-12 sm:py-16">
        <Container>
          <AccountState
            loadingTitle="Verificando tu sesión"
            status={ACCOUNT_ASYNC_STATUS.LOADING}
          >
            {null}
          </AccountState>
        </Container>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="bg-surface py-12 sm:py-16">
        <Container>
          <AccountState
            empty={
              <EmptyState
                action={<Button onClick={openAccountDrawer}>Iniciar sesión</Button>}
                description="Necesitás una sesión activa para cambiar tu contraseña."
                title="Iniciá sesión para continuar"
              />
            }
            error={authError}
            isEmpty={authStatus === ACCOUNT_ASYNC_STATUS.SUCCESS}
            onRetry={retryBootstrap}
            status={authStatus === ACCOUNT_ASYNC_STATUS.IDLE ? ACCOUNT_ASYNC_STATUS.LOADING : authStatus}
          >
            {null}
          </AccountState>
        </Container>
      </section>
    );
  }

  return (
    <section className="bg-surface py-12 sm:py-16">
      <Container>
        <div className="mx-auto grid max-w-md gap-7 rounded-card border border-border bg-white p-6 shadow-sm sm:p-8">
          <div className="grid justify-items-center gap-4 text-center">
            <Image alt="EntrenAR" height={48} priority src="/blackLogo.svg" width={170} />
            <div className="grid gap-2">
              <h1 className="font-heading text-5xl leading-none">Cambiar contraseña</h1>
              <p className="text-sm leading-6 text-text-muted">
                Actualizá tu contraseña desde una sesión segura.
              </p>
            </div>
          </div>

          <form className="grid gap-5" onSubmit={handleSubmit}>
            {submitted && Object.keys(errors).length > 0 ? (
              <div className="rounded-card border border-sale/30 bg-red-50 p-3 text-sm font-medium text-sale" role="alert">
                Revisá los campos marcados antes de guardar la nueva contraseña.
              </div>
            ) : null}
            {authError ? (
              <div className="rounded-card border border-sale/30 bg-red-50 p-3 text-sm font-medium text-sale" role="alert">
                {getAccountErrorMessage(authError, "No pudimos cambiar la contraseña. Intentá de nuevo.")}
              </div>
            ) : null}
            {saved ? (
              <p className="rounded-card border border-accent/30 bg-accent-soft p-3 text-sm font-medium text-accent" role="status">
                Contraseña actualizada correctamente.
              </p>
            ) : null}
            <Input
              autoComplete="current-password"
              errorText={fieldError("currentPassword")}
              helperText={fieldError("currentPassword") ? undefined : "Necesitamos verificar tu contraseña actual."}
              id="change-current-password"
              label="Contraseña actual"
              onBlur={() => markTouched("currentPassword")}
              onChange={(event) => {
                clearFeedback();
                setCurrentPassword(event.target.value);
              }}
              type="password"
              value={currentPassword}
            />
            <Input
              autoComplete="new-password"
              errorText={fieldError("newPassword")}
              helperText={fieldError("newPassword") ? undefined : "Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo."}
              id="change-new-password"
              label="Nueva contraseña"
              onBlur={() => markTouched("newPassword")}
              onChange={(event) => {
                clearFeedback();
                setNewPassword(event.target.value);
              }}
              type="password"
              value={newPassword}
            />
            <PasswordChecklist password={newPassword} />
            <Input
              autoComplete="new-password"
              errorText={fieldError("passwordConfirmation")}
              helperText={fieldError("passwordConfirmation") ? undefined : "Repetí la contraseña exactamente igual."}
              id="change-password-confirmation"
              label="Confirmar contraseña"
              onBlur={() => markTouched("passwordConfirmation")}
              onChange={(event) => {
                clearFeedback();
                setPasswordConfirmation(event.target.value);
              }}
              type="password"
              value={passwordConfirmation}
            />
            <Button aria-busy={isLoading} className="w-full" disabled={isLoading} type="submit">
              {isLoading ? "Guardando..." : "Guardar contraseña"}
            </Button>
          </form>
        </div>
      </Container>
    </section>
  );
}

const changePasswordFieldIds = [
  "change-current-password",
  "change-new-password",
  "change-password-confirmation",
] as const;

function getChangePasswordErrors(
  currentPassword: string,
  newPassword: string,
  passwordConfirmation: string,
): Partial<Record<ChangePasswordField, string>> {
  const errors: Partial<Record<ChangePasswordField, string>> = {};

  if (!currentPassword.trim()) {
    errors.currentPassword = "Ingresá tu contraseña actual.";
  }

  if (!isValidPassword(newPassword)) {
    errors.newPassword = "La contraseña debe cumplir todos los requisitos.";
  }

  if (!passwordConfirmation || newPassword !== passwordConfirmation) {
    errors.passwordConfirmation = "Las contraseñas deben coincidir.";
  }

  return errors;
}
