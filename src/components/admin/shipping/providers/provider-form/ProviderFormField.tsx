"use client";

import { useId } from "react";
import { useFormContext } from "react-hook-form";
import type { FieldPath } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import type { ProviderFormInput } from "@/schemas/admin/shipping-schemas";

export function ProviderInput({ helperText, label, name, type = "text" }: { name: FieldPath<ProviderFormInput>; label: string; helperText: string; type?: string }) {
  const id = useId();
  const { formState: { errors }, register } = useFormContext<ProviderFormInput>();
  const error = name.split(".").reduce<unknown>((current, key) => current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined, errors);
  const message = typeof error === "object" && error && "message" in error ? String((error as { message?: string }).message) : undefined;
  return <Input id={id} label={label} helperText={message ? undefined : helperText} errorText={message} type={type} inputMode={type === "number" ? "decimal" : undefined} {...register(name)} />;
}

export function ProviderSection({ children, description, title }: { children: React.ReactNode; description: string; title: string }) {
  return <section className="rounded-3xl border border-border bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-text">{title}</h2><p className="mt-1 text-sm text-text-muted">{description}</p><div className="mt-5 grid gap-4">{children}</div></section>;
}

export function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs font-medium text-sale">{message}</p> : null;
}

export function SelectField({ children, label, name }: { name: FieldPath<ProviderFormInput>; label: string; children: React.ReactNode }) {
  const id = useId();
  const { register } = useFormContext<ProviderFormInput>();
  return <label className="grid gap-2 text-sm font-medium text-text" htmlFor={id}><span>{label}</span><select id={id} className={cn("h-11 w-full rounded-button border border-border bg-surface px-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm")} {...register(name)}>{children}</select></label>;
}
