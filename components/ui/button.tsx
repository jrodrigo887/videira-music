import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClass: Record<ButtonVariant, string> = {
  primary: "ds-button",
  secondary: "ds-button-secondary",
  danger: "ds-button-danger",
};

export function Button({
  variant = "primary",
  type = "button",
  className,
  ...props
}: ButtonProps) {
  const classes = [variantClass[variant], className].filter(Boolean).join(" ");
  return <button type={type} className={classes} {...props} />;
}
