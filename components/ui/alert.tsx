import type { HTMLAttributes } from "react";

type AlertProps = HTMLAttributes<HTMLParagraphElement>;

export function Alert({ className, children, ...props }: AlertProps) {
  const classes = ["text-sm", "text-danger", className].filter(Boolean).join(" ");
  return (
    <p role="alert" className={classes} {...props}>
      {children}
    </p>
  );
}
