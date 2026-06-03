import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import type { InputProps } from "@/types/ui";

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, errorText, label, helperText, id, trailingIcon, trailingLabel, ...props },
  ref,
) {
  const helperId = helperText ? `${id}-helper` : undefined;
  const errorId = errorText ? `${id}-error` : undefined;

  return (
    <label className="grid gap-2 text-sm font-medium text-text" htmlFor={id}>
      {label ? <span>{label}</span> : null}
      <span className="relative block">
        <input
          aria-describedby={[helperId, errorId].filter(Boolean).join(" ") || undefined}
          aria-invalid={errorText ? true : undefined}
          id={id}
          ref={ref}
          className={cn(
            "h-11 w-full rounded-button border border-border bg-surface px-3 text-base outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm",
            Boolean(trailingIcon || trailingLabel) && "pr-11",
            errorText && "border-sale focus:border-sale focus:ring-sale/20",
            className,
          )}
          {...props}
        />
        {trailingIcon || trailingLabel ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold uppercase text-text-muted">
            {trailingIcon ?? trailingLabel}
          </span>
        ) : null}
      </span>
      {helperText ? <span className="text-xs text-text-muted" id={helperId}>{helperText}</span> : null}
      {errorText ? <span className="text-xs font-medium text-sale" id={errorId}>{errorText}</span> : null}
    </label>
  );
});
