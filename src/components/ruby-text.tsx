import type { RubyToken } from "@/lib/types/content";

interface RubyTextProps {
  tokens: RubyToken[];
}

export function RubyText({ tokens }: RubyTextProps) {
  return (
    <>
      {tokens.map((token, index) =>
        token.type === "text" ? (
          <span key={`${token.text}-${index}`}>{token.text}</span>
        ) : (
          <ruby key={`${token.base}-${index}`}>
            {token.base}
            <rt>{token.reading}</rt>
          </ruby>
        )
      )}
    </>
  );
}
