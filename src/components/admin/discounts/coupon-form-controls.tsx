"use client";

import type { ReactNode } from "react";
import { useId } from "react";
import { useFormContext } from "react-hook-form";
import type { FieldPath } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import type { CouponFormInput } from "@/schemas/admin/discount-schemas";

export function FormCard({ children, description, id, title }: { children: ReactNode; description: string; id: string; title: string }) {
  return <section id={id} className="rounded-3xl border border-border bg-white p-5 shadow-sm"><div className="mb-5"><h2 className="text-lg font-semibold text-text">{title}</h2><p className="mt-1 text-sm leading-6 text-text-muted">{description}</p></div><div className="grid gap-4">{children}</div></section>;
}

export function CouponTextInput({ helperText, label, name, type = "text", inputMode }: { helperText: string; label: string; name: FieldPath<CouponFormInput>; type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"] }) {
  const id = useId();
  const { formState: { errors }, register } = useFormContext<CouponFormInput>();
  const error = (errors as Record<string, { message?: unknown }>)[name]?.message;
  return <Input id={id} label={label} helperText={typeof error === "string" ? undefined : helperText} errorText={typeof error === "string" ? error : undefined} type={type} inputMode={inputMode} {...register(name, type === "number" ? { valueAsNumber: true } : undefined)} />;
}

export function RadioPillGroup({ label, name, options, onChange }: { label: string; name: FieldPath<CouponFormInput>; options: { label: string; value: string }[]; onChange?: (value: string) => void }) {
  const { formState: { errors }, register } = useFormContext<CouponFormInput>();
  const id = useId();
  const error = (errors as Record<string, { message?: unknown }>)[name]?.message;
  const errorId = `${id}-error`;
  return (
    <fieldset className="grid gap-2" aria-describedby={typeof error === "string" ? errorId : undefined} aria-invalid={typeof error === "string" ? true : undefined}>
      <legend className="text-sm font-semibold text-text">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <label key={option.value} className="cursor-pointer">
            <input id={`${id}-${option.value}`} type="radio" value={option.value} className="peer sr-only" {...register(name, { onChange: (event) => onChange?.(event.currentTarget.value) })} />
            <span className={cn("block rounded-2xl border border-border bg-surface px-3 py-3 text-center text-sm font-semibold text-text transition peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent-hover")}>{option.label}</span>
          </label>
        ))}
      </div>
      {typeof error === "string" ? <p id={errorId} className="text-xs font-medium text-sale">{error}</p> : null}
    </fieldset>
  );
}
