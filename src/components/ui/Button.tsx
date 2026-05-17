import { getButtonClassName } from "@/components/ui/button-styles";
import type { ButtonProps } from "@/types/ui";

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={getButtonClassName({
        className,
        disabledStyles: true,
        size,
        variant,
      })}
      type={type}
      {...props}
    />
  );
}
