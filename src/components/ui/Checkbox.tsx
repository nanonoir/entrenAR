import { Check } from "lucide-react";
import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  helperText?: string;
  errorText?: string;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, errorText, helperText, id, label, ...props },
  ref,
) {
  const helperId = helperText ? `${id}-helper` : undefined;
  const errorId = errorText ? `${id}-error` : undefined;

  return (
    <label className="grid gap-2 text-sm font-medium text-text" htmlFor={id}>
      <span className="flex items-start gap-3">
        <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
          <input
            aria-describedby={[helperId, errorId].filter(Boolean).join(" ") || undefined}
            aria-invalid={errorText ? true : undefined}
            className={cn(
              "peer h-5 w-5 appearance-none rounded border border-border bg-surface outline-none transition checked:border-accent checked:bg-accent focus:ring-2 focus:ring-accent/20",
              errorText && "border-sale focus:ring-sale/20",
              className,
            )}
            id={id}
            ref={ref}
            type="checkbox"
            {...props}
          />
          <Check aria-hidden className="pointer-events-none absolute hidden text-on-accent peer-checked:block" size={14} strokeWidth={3} />
        </span>
        <span>{label}</span>
      </span>
      {helperText ? <span className="pl-8 text-xs text-text-muted" id={helperId}>{helperText}</span> : null}
      {errorText ? <span className="pl-8 text-xs font-medium text-sale" id={errorId}>{errorText}</span> : null}
    </label>
  );
});
