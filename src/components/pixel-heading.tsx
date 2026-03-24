import type { ReactNode } from "react";

interface PixelHeadingProps {
  kicker?: string;
  title: string;
  description?: ReactNode;
}

export function PixelHeading({
  kicker,
  title,
  description
}: PixelHeadingProps) {
  return (
    <div className="hero">
      {kicker ? <span className="kicker">{kicker}</span> : null}
      <div>
        <h1 className="display" style={{ margin: 0 }}>
          {title}
        </h1>
      </div>
      {description ? <div className="muted">{description}</div> : null}
    </div>
  );
}
