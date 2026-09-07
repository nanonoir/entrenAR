import { Button } from "@/components/ui/Button";
import type { ButtonProps } from "@/types/ui";

type AccountEntryButtonProps = Omit<ButtonProps, "children">;

export function AccountEntryButton({ className = "w-full", ...props }: AccountEntryButtonProps) {
  return (
    <Button className={className} {...props}>
      Iniciar sesión / Registrarse
    </Button>
  );
}
