"use client";

import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";

type ErrorAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export type ErrorLayoutProps = {
  code: string;
  title: string;
  description: string;
  primaryAction: ErrorAction;
  secondaryAction?: ErrorAction;
};

function Action({ action, primary }: { action: ErrorAction; primary: boolean }) {
  if (action.href) {
    return (
      <LinkButton href={action.href} variant={primary ? "primary" : "secondary"} size="lg">
        {action.label}
      </LinkButton>
    );
  }

  return (
    <Button onClick={action.onClick} variant={primary ? "primary" : "secondary"} size="lg">
      {action.label}
    </Button>
  );
}

export function ErrorLayout({ code, description, primaryAction, secondaryAction, title }: ErrorLayoutProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-center">
      <div className="flex w-full max-w-2xl flex-col items-center">
        <Image src="/error.svg" alt="" width={220} height={220} priority className="mb-8 h-40 w-40 object-contain sm:h-52 sm:w-52" />
        <p className="font-subtitle text-sm font-semibold uppercase tracking-[0.3em] text-accent">Código {code}</p>
        <h1 className="mt-3 font-heading text-5xl uppercase tracking-wide text-text sm:text-6xl">{title}</h1>
        <p className="mt-4 max-w-lg text-base leading-7 text-text-muted">{description}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Action action={primaryAction} primary />
          {secondaryAction ? <Action action={secondaryAction} primary={false} /> : null}
        </div>
      </div>
    </main>
  );
}
