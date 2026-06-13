import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import type { TextareaProps } from "@/types/ui";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, errorText, label, helperText, id, ...props },
  ref,
) {
  const helperId = helperText ? `${id}-helper` : undefined;
  const errorId = errorText ? `${id}-error` : undefined;

  return (
    <label className="grid gap-2 text-sm font-medium text-text" htmlFor={id}>
      {label ? <span>{label}</span> : null}
      <textarea
        aria-describedby={[helperId, errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={errorText ? true : undefined}
        className={cn(
          "min-h-32 w-full resize-y rounded-button border border-border bg-surface px-3 py-3 text-base outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm",
          errorText && "border-sale focus:border-sale focus:ring-sale/20",
          className,
        )}
        id={id}
        ref={ref}
        {...props}
      />
      {helperText ? <span className="text-xs text-text-muted" id={helperId}>{helperText}</span> : null}
      {errorText ? <span className="text-xs font-medium text-sale" id={errorId}>{errorText}</span> : null}
    </label>
  );
});
