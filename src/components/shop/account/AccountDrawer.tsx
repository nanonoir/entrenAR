"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { AccountDrawerContent } from "@/components/shop/account/drawer/AccountDrawerContent";
import { isValidEmail, isValidPassword } from "@/lib/account-validation";
import { findMockAccountByEmail } from "@/lib/data/account";
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
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const logout = useAuthStore((state) => state.logout);
  const [step, setStep] = useState<AccountStep>("start");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();
  const passwordIsValid = useMemo(() => isValidPassword(password), [password]);
  const passwordsMatch = password.length > 0 && password === passwordConfirmation;
  const activeStep = user ? "logged" : step;

  useEffect(() => {
    useAuthStore.persist.rehydrate();
  }, []);

  function resetGuestFlow() {
    setStep("start");
    setEmail("");
    setPassword("");
    setPasswordConfirmation("");
    setAcceptedTerms(false);
    setSubmitted(false);
  }

  function handleClose() {
    if (!user) {
      resetGuestFlow();
    }

    close();
  }

  function handleStartSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (!isValidEmail(email) || !acceptedTerms) {
      return;
    }

    setSubmitted(false);
    setPassword("");
    setPasswordConfirmation("");
    setStep(findMockAccountByEmail(normalizedEmail) ? "password" : "register");
  }

  function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (!isValidPassword(password)) {
      return;
    }

    login(normalizedEmail);
    resetGuestFlow();
  }

  function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (!passwordIsValid || !passwordsMatch) {
      return;
    }

    register(normalizedEmail);
    resetGuestFlow();
  }

  function handleForgot() {
    setSubmitted(false);
    setStep("forgot");
  }

  function handleLogout() {
    logout();
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
        email={email}
        normalizedEmail={normalizedEmail}
        onAcceptedTermsChange={setAcceptedTerms}
        onBackToMobileMenu={handleBackToMobileMenu}
        onClose={handleClose}
        onEmailChange={setEmail}
        onForgot={handleForgot}
        onLoginSubmit={handleLoginSubmit}
        onLogout={handleLogout}
        onPasswordChange={setPassword}
        onPasswordConfirmationChange={setPasswordConfirmation}
        onRegisterSubmit={handleRegisterSubmit}
        onStartSubmit={handleStartSubmit}
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
