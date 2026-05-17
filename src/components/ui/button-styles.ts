import { cn } from "@/lib/utils";
import type { ButtonSize, ButtonVariant } from "@/types/ui";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-button font-subtitle text-sm font-semibold uppercase tracking-normal transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const buttonDisabledStyles = "disabled:pointer-events-none disabled:opacity-50";

const buttonVariantStyles: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "border border-border bg-surface text-text hover:border-text",
  ghost: "bg-transparent text-text hover:bg-black/5",
  danger: "bg-sale text-white hover:bg-red-700",
};

const buttonSizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 px-3",
  md: "h-11 px-5",
  lg: "h-12 px-6 text-base",
  icon: "h-11 w-11 px-0",
};

export function getButtonClassName({
  className,
  disabledStyles = false,
  size,
  variant,
}: {
  className?: string;
  disabledStyles?: boolean;
  size: ButtonSize;
  variant: ButtonVariant;
}) {
  return cn(
    buttonBase,
    disabledStyles && buttonDisabledStyles,
    buttonVariantStyles[variant],
    buttonSizeStyles[size],
    className,
  );
}
