"use client";

import { cn } from "@/lib/utils";

export type FilterOption = {
  label: string;
  value: string;
};

type FilterOptionGroupProps<TValue extends string> = {
  label: string;
  name: string;
  options: readonly FilterOption[];
  value: TValue;
  onChange: (value: TValue) => void;
};

export function FilterOptionGroup<TValue extends string>({
  label,
  name,
  options,
  value,
  onChange,
}: FilterOptionGroupProps<TValue>) {
  return (
    <fieldset className="mb-5 grid gap-2 last:mb-0">
      <legend className="mb-2 text-sm font-semibold text-text">{label}</legend>
      {options.map((option) => {
        const selected = value === option.value;

        return (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm transition",
              selected
                ? "border-accent bg-accent-soft text-accent-hover"
                : "border-border bg-white text-text hover:border-accent/50 hover:bg-surface",
            )}
          >
            <span className="min-w-0 truncate">{option.label}</span>
            <input
              className="size-4 shrink-0 accent-accent"
              name={name}
              type="radio"
              checked={selected}
              onChange={() => onChange(option.value as TValue)}
            />
          </label>
        );
      })}
    </fieldset>
  );
}
