import Link from "next/link";
import type { ComponentProps } from "react";
import { getButtonClassName } from "@/components/ui/button-styles";
import type { ButtonSize, ButtonVariant } from "@/types/ui";

type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

export function LinkButton({
  className,
  variant = "primary",
  size = "md",
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={getButtonClassName({
        className,
        size,
        variant,
      })}
      {...props}
    />
  );
}
