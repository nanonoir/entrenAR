import { Button } from "@/components/ui/Button";
import { accountEntryLabel } from "@/lib/data/account";
import type { ButtonProps } from "@/types/ui";

type AccountEntryButtonProps = Omit<ButtonProps, "children">;

export function AccountEntryButton({ className = "w-full", ...props }: AccountEntryButtonProps) {
  return (
    <Button className={className} {...props}>
      {accountEntryLabel}
    </Button>
  );
}
