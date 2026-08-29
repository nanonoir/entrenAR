"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { focusFirstInvalidField, getAccountErrorMessage } from "@/components/shop/account/AccountState";
import { AccountDrawerContent } from "@/components/shop/account/drawer/AccountDrawerContent";
import { isValidEmail, isValidPassword } from "@/lib/account-validation";
import { useAuthStore } from "@/stores/auth-store";
import { useUIStore } from "@/stores/ui-store";

type AccountStep = "start" | "password" | "register" | "forgot";

function AccountDrawerLogo() {
  return <Image alt="EntrenAR" height={38} priority src="/blackLogo.svg" width={138} />;
}

export function AccountDrawer() {
  const isOpen = useUIStore((state) => state.isAccountDrawerOpen);
  const close = useUIStore((state) => state.closeAccountDrawer);
  const openMobileMenu = useUIStore((state) => state.openMobileMenu);
  const user = useAuthStore((state) => state.user);
  const authStatus = useAuthStore((state) => state.status);
  const authError = useAuthStore((state) => state.error);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const clearError = useAuthStore((state) => state.clearError);
  const forgotPassword = useAuthStore((state) => state.forgotPassword);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const logout = useAuthStore((state) => state.logout);
  const [step, setStep] = useState<AccountStep>("start");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();
  const passwordIsValid = isValidPassword(password);
  const passwordsMatch = password.length > 0 && password === passwordConfirmation;
  const activeStep = user ? "logged" : step;
  const isSubmitting = authStatus === "loading";
  const authErrorMessage = authError ? getAccountErrorMessage(authError, "No pudimos completar la operación.") : undefined;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;

    async function restoreSession() {
      await useAuthStore.persist.rehydrate();
      if (!cancelled) {
        await bootstrap();
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [bootstrap, isOpen]);

  function resetGuestFlow() {
    setStep("start");
    setEmail("");
    setPassword("");
    setPasswordConfirmation("");
    setAcceptedTerms(false);
    setSubmitted(false);
    setForgotSent(false);
    clearError();
  }

  function handleClose() {
    if (!user) {
      resetGuestFlow();
    }

    close();
  }

  function validateStart() {
    setSubmitted(true);

    if (!isValidEmail(email) || !acceptedTerms) {
      focusFirstInvalidField(
        ["account-email", "account-terms"],
        [
          ...(!isValidEmail(email) ? ["account-email"] : []),
          ...(!acceptedTerms ? ["account-terms"] : []),
        ],
      );
      return false;
    }

    return true;
  }

  function handleLoginStart() {
    if (!validateStart()) {
      return;
    }

    clearError();
    setSubmitted(false);
    setPassword("");
    setPasswordConfirmation("");
    setForgotSent(false);
    setStep("password");
  }

  function handleRegisterStart() {
    if (!validateStart()) {
      return;
    }

    clearError();
    setSubmitted(false);
    setPassword("");
    setPasswordConfirmation("");
    setForgotSent(false);
    setStep("register");
  }

  function handleEmailChange(value: string) {
    clearError();
    setEmail(value);
  }

  function handlePasswordChange(value: string) {
    clearError();
    setPassword(value);
  }

  function handlePasswordConfirmationChange(value: string) {
    clearError();
    setPasswordConfirmation(value);
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setSubmitted(true);

    if (!isValidPassword(password)) {
      focusFirstInvalidField(["login-password"], ["login-password"]);
      return;
    }

    setSubmitted(false);
    const success = await login(normalizedEmail, password);
    if (success) {
      resetGuestFlow();
    }
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setSubmitted(true);

    if (!passwordIsValid || !passwordsMatch) {
      focusFirstInvalidField(
        ["register-password", "register-password-confirmation"],
        [
          ...(!passwordIsValid ? ["register-password"] : []),
          ...(!passwordsMatch ? ["register-password-confirmation"] : []),
        ],
      );
      return;
    }

    setSubmitted(false);
    const success = await register(normalizedEmail, password);
    if (success) {
      resetGuestFlow();
    }
  }

  function handleForgot() {
    setSubmitted(false);
    setForgotSent(false);
    clearError();
    setStep("forgot");
  }

  async function handleForgotSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setSubmitted(true);
    if (!isValidEmail(email)) {
      focusFirstInvalidField(["forgot-email"], ["forgot-email"]);
      return;
    }

    setSubmitted(false);
    const success = await forgotPassword(normalizedEmail);
    if (success) {
      setForgotSent(true);
    }
  }

  async function handleLogout() {
    if (isSubmitting) {
      return;
    }

    await logout();
    resetGuestFlow();
  }

  function handleBackToMobileMenu() {
    handleClose();
    openMobileMenu();
  }

  return (
    <Drawer
      className="md:max-w-[430px]"
      headerContent={<AccountDrawerLogo />}
      onClose={handleClose}
      open={isOpen}
      title="Cuenta"
    >
      <AccountDrawerContent
        acceptedTerms={acceptedTerms}
        activeStep={activeStep}
        authError={authErrorMessage}
        email={email}
        forgotSent={forgotSent}
        isSubmitting={isSubmitting}
        normalizedEmail={normalizedEmail}
        onAcceptedTermsChange={setAcceptedTerms}
        onBackToMobileMenu={handleBackToMobileMenu}
        onClose={handleClose}
         onEmailChange={handleEmailChange}
        onForgot={handleForgot}
        onForgotSubmit={handleForgotSubmit}
        onLoginStart={handleLoginStart}
        onLoginSubmit={handleLoginSubmit}
        onLogout={handleLogout}
         onPasswordChange={handlePasswordChange}
         onPasswordConfirmationChange={handlePasswordConfirmationChange}
        onRegisterStart={handleRegisterStart}
        onRegisterSubmit={handleRegisterSubmit}
        onStepChange={setStep}
        password={password}
        passwordConfirmation={passwordConfirmation}
        passwordIsValid={passwordIsValid}
        passwordsMatch={passwordsMatch}
        submitted={submitted}
        user={user}
      />
    </Drawer>
  );
}
