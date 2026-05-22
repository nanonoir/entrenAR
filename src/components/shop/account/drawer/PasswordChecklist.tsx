import { CheckCircle2 } from "lucide-react";
import { passwordRules } from "@/lib/account-validation";
import { cn } from "@/lib/utils";

type PasswordChecklistProps = {
  password: string;
};

export function PasswordChecklist({ password }: PasswordChecklistProps) {
  return (
    <ul className="grid gap-2 rounded-card border border-border bg-surface p-3">
      {passwordRules.map((rule) => {
        const passed = rule.test(password);

        return (
          <li
            className={cn("flex items-center gap-2 text-xs", passed ? "text-accent" : "text-text-muted")}
            key={rule.label}
          >
            <CheckCircle2 aria-hidden size={14} />
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
