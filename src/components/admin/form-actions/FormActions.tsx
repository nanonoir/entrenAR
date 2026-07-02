import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FormActionsProps = {
  children: ReactNode;
  className?: string;
};

export function FormActions({ children, className }: FormActionsProps) {
  return (
    <div className={cn("flex flex-col-reverse gap-2 pb-4 pt-2 sm:flex-row sm:justify-end", className)}>
      {children}
    </div>
  );
}

export function FormActionsGroup({ children, className }: FormActionsProps) {
  return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}>{children}</div>;
}
