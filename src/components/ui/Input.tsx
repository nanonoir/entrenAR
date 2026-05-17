import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import type { InputProps } from "@/types/ui";

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, helperText, id, ...props },
  ref,
) {
  return (
    <label className="grid gap-2 text-sm font-medium text-text" htmlFor={id}>
      {label ? <span>{label}</span> : null}
      <input
        id={id}
        ref={ref}
        className={cn(
          "h-11 w-full rounded-button border border-border bg-surface px-3 text-sm outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20",
          className,
        )}
        {...props}
      />
      {helperText ? <span className="text-xs text-text-muted">{helperText}</span> : null}
    </label>
  );
});
