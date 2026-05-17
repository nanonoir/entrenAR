import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  helperText?: string;
};

export type BadgeTone = "neutral" | "accent" | "sale" | "warning" | "success";

export type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

export type AlertTone = "info" | "warning" | "success" | "danger";

export type AlertProps = {
  title: string;
  children?: ReactNode;
  tone?: AlertTone;
  className?: string;
};
