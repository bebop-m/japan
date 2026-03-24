import type { HTMLAttributes, ReactNode } from "react";

interface PixelCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  soft?: boolean;
}

export function PixelCard({
  children,
  className,
  soft = false,
  ...rest
}: PixelCardProps) {
  const classes = ["pixel-card", soft ? "soft" : null, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
