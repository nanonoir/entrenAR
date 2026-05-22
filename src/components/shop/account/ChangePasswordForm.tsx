"use client";

import Image from "next/image";
import { type FormEvent, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { isValidPassword, passwordRules } from "@/lib/account-validation";
import { cn } from "@/lib/utils";

export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saved, setSaved] = useState(false);
  const passwordIsValid = useMemo(() => isValidPassword(password), [password]);
  const passwordsMatch = password.length > 0 && password === passwordConfirmation;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setSaved(false);

    if (!passwordIsValid || !passwordsMatch) {
      return;
    }

    setSaved(true);
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
                Esta vista valida la nueva contraseña de manera local para el flujo frontend.
              </p>
            </div>
          </div>

          <form className="grid gap-5" onSubmit={handleSubmit}>
            <Input
              autoComplete="new-password"
              id="new-password"
              label="Nueva contraseña"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
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
            <Input
              autoComplete="new-password"
              id="new-password-confirmation"
              label="Confirmar contraseña"
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              type="password"
              value={passwordConfirmation}
            />
            {submitted && !passwordsMatch ? (
              <p className="text-xs font-medium text-sale">Las contraseñas deben coincidir.</p>
            ) : null}
            {submitted && !passwordIsValid ? (
              <p className="text-xs font-medium text-sale">La contraseña no cumple los requisitos mínimos.</p>
            ) : null}
            {saved ? (
              <p className="rounded-card border border-accent/30 bg-accent-soft p-3 text-sm font-medium text-accent">
                Contraseña actualizada localmente para la vista previa.
              </p>
            ) : null}
            <Button className="w-full" type="submit">
              Guardar contraseña
            </Button>
          </form>
        </div>
      </Container>
    </section>
  );
}
