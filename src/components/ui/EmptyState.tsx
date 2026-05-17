import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("rounded-card border border-dashed border-border bg-surface p-8 text-center", className)}>
      <h3 className="font-subtitle text-xl font-semibold uppercase">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
