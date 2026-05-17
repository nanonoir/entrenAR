import { cn } from "@/lib/utils";
import type { BadgeProps } from "@/types/ui";

const toneStyles = {
  neutral: "bg-zinc-100 text-zinc-700",
  accent: "bg-accent-soft text-accent-hover",
  sale: "bg-red-50 text-sale",
  warning: "bg-amber-50 text-amber-700",
  success: "bg-green-50 text-green-700",
};

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-button px-2.5 py-1 text-xs font-semibold uppercase tracking-normal",
        toneStyles[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
