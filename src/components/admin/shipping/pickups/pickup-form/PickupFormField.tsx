"use client";

import { useId } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import type { FieldPath } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import type { PickupPointFormInput } from "@/schemas/admin/shipping-schemas";

export function PickupInput({ disabled = false, helperText, label, name, normalize, type = "text" }: { name: FieldPath<PickupPointFormInput>; label: string; helperText: string; disabled?: boolean; normalize?: (value: string) => string; type?: string }) {
  const id = useId();
  const { control, formState: { errors }, register, setValue, trigger } = useFormContext<PickupPointFormInput>();
  const error = name.split(".").reduce<unknown>((current, key) => current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined, errors);
  const message = typeof error === "object" && error && "message" in error ? String((error as { message?: string }).message) : undefined;
  const watchedValue = useWatch({ control, name });
  if (normalize) {
    return <Input id={id} label={label} helperText={message ? undefined : helperText} errorText={message} type={type === "number" ? "text" : type} inputMode={type === "number" ? "decimal" : undefined} disabled={disabled} name={name} onBlur={() => void trigger(name)} value={String(watchedValue ?? "")} onChange={(event) => setValue(name, normalize(event.target.value) as never, { shouldDirty: true, shouldValidate: true })} />;
  }
  return <Input id={id} label={label} helperText={message ? undefined : helperText} errorText={message} type={type === "number" ? "text" : type} inputMode={type === "number" ? "decimal" : undefined} disabled={disabled} {...register(name)} />;
}

export function PickupSection({ children, description, title }: { children: React.ReactNode; description: string; title: string }) {
  return <section className="rounded-3xl border border-border bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-text">{title}</h2><p className="mt-1 text-sm text-text-muted">{description}</p><div className="mt-5 grid gap-4">{children}</div></section>;
}
