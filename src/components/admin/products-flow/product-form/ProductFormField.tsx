"use client";

import { useId } from "react";
import type { ComponentProps } from "react";
import { useFormContext } from "react-hook-form";
import type { FieldPath, FieldValues } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";

type ProductFormFieldProps<T extends FieldValues> = {
  name: FieldPath<T>;
  label: string;
  helperText: string;
  type?: string;
} & Pick<ComponentProps<"input">, "inputMode">;

export function ProductFormInput<T extends FieldValues>({ helperText, inputMode, label, name, type = "text" }: ProductFormFieldProps<T>) {
  const id = useId();
  const { formState: { errors }, register } = useFormContext<T>();
  const error = errors[name]?.message;

  return (
    <Input
      id={id}
      label={label}
      type={type}
      inputMode={inputMode}
      helperText={error ? undefined : helperText}
      errorText={typeof error === "string" ? error : undefined}
      {...register(name)}
    />
  );
}

export function ProductFormTextarea<T extends FieldValues>({ helperText, label, name }: ProductFormFieldProps<T>) {
  const id = useId();
  const { formState: { errors }, register } = useFormContext<T>();
  const error = errors[name]?.message;

  return (
    <Textarea
      id={id}
      label={label}
      helperText={error ? undefined : helperText}
      errorText={typeof error === "string" ? error : undefined}
      {...register(name)}
    />
  );
}

export function ProductFormSelect<T extends FieldValues>({ children, helperText, label, name }: ProductFormFieldProps<T> & { children: React.ReactNode }) {
  const id = useId();
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const { formState: { errors }, register } = useFormContext<T>();
  const error = errors[name]?.message;

  return (
    <label className="grid gap-2 text-sm font-medium text-text" htmlFor={id}>
      <span>{label}</span>
      <select
        id={id}
        aria-describedby={error ? errorId : helperId}
        aria-invalid={error ? true : undefined}
        className={cn(
          "h-11 w-full rounded-button border border-border bg-surface px-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm",
          typeof error === "string" && "border-sale focus:border-sale focus:ring-sale/20",
        )}
        {...register(name)}
      >
        {children}
      </select>
      {typeof error === "string" ? <span className="text-xs font-medium text-sale" id={errorId}>{error}</span> : <span className="text-xs text-text-muted" id={helperId}>{helperText}</span>}
    </label>
  );
}

export function ProductFormCard({ children, description, id, title }: { children: React.ReactNode; description: string; id: string; title: string }) {
  return (
    <section id={id} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}
