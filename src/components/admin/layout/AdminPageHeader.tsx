import type { ReactNode } from "react";
import { AdminPageHeaderBackLink } from "@/components/admin/layout/AdminPageHeaderBackLink";

type AdminPageHeaderProps = {
  title: string;
  description: string;
  tag?: string;
  backLink?: { href: string; label: string; onNavigate?: (href: string) => void };
  children?: ReactNode;
};

export function AdminPageHeader({ backLink, children, description, tag = "Productos", title }: AdminPageHeaderProps) {
  return (
    <header className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">{tag}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {children}
        {backLink ? <AdminPageHeaderBackLink href={backLink.href} label={backLink.label} onNavigate={backLink.onNavigate} /> : null}
      </div>
    </header>
  );
}
