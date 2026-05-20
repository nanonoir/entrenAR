"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Heart,
  LockKeyhole,
  MapPin,
  Package,
  UserRound,
} from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { isValidPassword, passwordRules } from "@/lib/account-validation";
import { findMockAccountByEmail } from "@/lib/data/account";
import { accountRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useUIStore } from "@/stores/ui-store";

type AccountStep = "start" | "password" | "register" | "forgot";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string) {
  return emailPattern.test(value.trim());
}

function LogoHeader() {
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
      headerContent={<LogoHeader />}
      onClose={handleClose}
      open={isOpen}
      title="Cuenta"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6">
        {activeStep === "start" ? (
          <form className="grid gap-5" onSubmit={handleStartSubmit}>
            <div className="grid gap-2">
              <h2 className="font-heading text-4xl leading-none">Iniciar sesión o Registrarse</h2>
              <p className="text-sm leading-6 text-text-muted">
                Accedé a pedidos, favoritos y datos de compra con una vista previa local.
              </p>
            </div>
            <Button className="w-full justify-center" type="button" variant="secondary">
              <Image alt="" aria-hidden height={20} src="/google.svg" width={20} />
              Continuar con Google
            </Button>
            <div className="grid gap-2">
              <Input
                autoComplete="email"
                id="account-email"
                label="Email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@email.com"
                type="email"
                value={email}
              />
              {submitted && !isValidEmail(email) ? (
                <p className="text-xs font-medium text-sale">Ingresá un email válido.</p>
              ) : null}
            </div>
            <label className="grid grid-cols-[18px_1fr] gap-3 text-sm leading-6 text-text-muted">
              <input
                checked={acceptedTerms}
                className="mt-1 h-4 w-4 accent-accent"
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                type="checkbox"
              />
              <span>
                Acepto los{" "}
                <Link
                  className="font-semibold text-accent hover:text-accent-hover"
                  href={accountRoutes.terms}
                  onClick={handleClose}
                >
                  términos y condiciones
                </Link>{" "}
                y la{" "}
                <Link
                  className="font-semibold text-accent hover:text-accent-hover"
                  href={accountRoutes.privacy}
                  onClick={handleClose}
                >
                  política de privacidad
                </Link>
                .
              </span>
            </label>
            {submitted && !acceptedTerms ? (
              <p className="text-xs font-medium text-sale">Tenés que aceptar los términos para continuar.</p>
            ) : null}
            <Button className="w-full" type="submit">
              Continuar
              <ArrowRight aria-hidden size={18} />
            </Button>
            <div className="grid gap-4 border-t border-border pt-5 lg:hidden">
              <Button className="w-full" onClick={handleBackToMobileMenu} type="button" variant="secondary">
                <ArrowLeft aria-hidden size={18} />
                Volver al Menú
              </Button>
            </div>
          </form>
        ) : null}

        {activeStep === "password" ? (
          <form className="grid gap-5" onSubmit={handleLoginSubmit}>
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
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
            {submitted && !passwordIsValid ? (
              <p className="text-xs font-medium text-sale">La contraseña no cumple los requisitos mínimos.</p>
            ) : null}
            <button
              className="justify-self-start text-sm font-semibold text-accent hover:text-accent-hover"
              onClick={handleForgot}
              type="button"
            >
              Olvidé mi contraseña
            </button>
            <Button className="w-full" type="submit">
              Iniciar sesión
            </Button>
          </form>
        ) : null}

        {activeStep === "register" ? (
          <form className="grid gap-5" onSubmit={handleRegisterSubmit}>
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
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
            <PasswordChecklist password={password} />
            <Input
              autoComplete="new-password"
              id="register-password-confirmation"
              label="Confirmar contraseña"
              onChange={(event) => setPasswordConfirmation(event.target.value)}
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
        ) : null}

        {activeStep === "forgot" ? (
          <div className="grid gap-5">
            <div className="grid gap-2">
              <p className="font-subtitle text-sm font-semibold uppercase text-accent">Recuperación</p>
              <h2 className="font-heading text-4xl leading-none">Email enviado</h2>
              <p className="text-sm leading-6 text-text-muted">
                Si existe una cuenta para {normalizedEmail}, vas a recibir instrucciones para cambiar tu contraseña.
              </p>
            </div>
            <Link
              className="font-semibold text-accent hover:text-accent-hover"
              href={accountRoutes.passwordReset}
              onClick={handleClose}
            >
              Ir a cambiar contraseña
            </Link>
            <Button onClick={() => setStep("password")} variant="secondary">
              Volver
            </Button>
          </div>
        ) : null}

        {activeStep === "logged" && user ? (
          <div className="grid gap-6">
            <div className="grid gap-2">
              <p className="font-subtitle text-sm font-semibold uppercase text-accent">Sesión activa</p>
              <h2 className="font-heading text-4xl leading-none">Mi cuenta</h2>
              <p className="text-sm text-text-muted">{user.email}</p>
            </div>
            <div className="grid gap-3">
              <AccountAccessItem icon={<UserRound aria-hidden size={20} />} label="Perfil" />
              <AccountAccessItem icon={<MapPin aria-hidden size={20} />} label="Direcciones" />
              <AccountAccessItem icon={<Package aria-hidden size={20} />} label="Pedidos" />
              <AccountAccessItem icon={<Heart aria-hidden size={20} />} label="Lista de deseados" />
              <AccountAccessItem icon={<LockKeyhole aria-hidden size={20} />} label="Autenticación" />
            </div>
            <Button className="w-full" onClick={handleLogout} variant="secondary">
              Cerrar sesión
            </Button>
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}

function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="grid gap-2 rounded-card border border-border bg-surface p-3">
      {passwordRules.map((rule) => {
        const passed = rule.test(password);

        return (
          <li
            className={cn("flex items-center gap-2 text-xs", passed ? "text-accent" : "text-text-muted")}
            key={rule.label}
          >
            <CheckCircle2 aria-hidden size={14} />
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

function AccountAccessItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-4">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent">{icon}</span>
      <span className="font-subtitle text-sm font-semibold uppercase">{label}</span>
    </div>
  );
}
