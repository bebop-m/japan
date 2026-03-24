import Link from "next/link";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface SharedProps {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  style?: CSSProperties;
}

interface LinkProps extends SharedProps {
  href: string;
}

interface ButtonProps
  extends SharedProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  href?: never;
}

function getClassName(variant: Variant, className?: string): string {
  return ["pixel-button", variant === "primary" ? null : variant, className]
    .filter(Boolean)
    .join(" ");
}

export function PixelButton(props: LinkProps | ButtonProps) {
  const variant = props.variant ?? "primary";

  if ("href" in props && props.href) {
    return (
      <Link
        href={props.href}
        className={getClassName(variant, props.className)}
        style={props.style}
      >
        {props.children}
      </Link>
    );
  }

  const { children, className, style, ...buttonProps } = props;

  return (
    <button className={getClassName(variant, className)} style={style} {...buttonProps}>
      {children}
    </button>
  );
}
