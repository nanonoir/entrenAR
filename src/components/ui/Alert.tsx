import { cn } from "@/lib/utils";
import type { AlertProps } from "@/types/ui";

const toneStyles = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  success: "border-green-200 bg-green-50 text-green-900",
  danger: "border-red-200 bg-red-50 text-red-900",
};

export function Alert({ title, children, tone = "info", className }: AlertProps) {
  return (
    <div className={cn("rounded-card border p-4", toneStyles[tone], className)}>
      <p className="font-subtitle text-sm font-semibold uppercase">{title}</p>
      {children ? <div className="mt-1 text-sm leading-6">{children}</div> : null}
    </div>
  );
}
