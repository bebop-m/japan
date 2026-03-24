export interface DiffToken {
  char: string;
  status: "correct" | "wrong" | "missing" | "extra";
}

export function normalizeStrictAnswer(value: string): string {
  return value.trim().normalize("NFKC");
}

export function isStrictMatch(actual: string, expected: string): boolean {
  return normalizeStrictAnswer(actual) === normalizeStrictAnswer(expected);
}

export function buildDiffTokens(actual: string, expected: string): DiffToken[] {
  const normalizedActual = normalizeStrictAnswer(actual);
  const normalizedExpected = normalizeStrictAnswer(expected);
  const maxLength = Math.max(normalizedActual.length, normalizedExpected.length);
  const tokens: DiffToken[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    const actualChar = normalizedActual[index];
    const expectedChar = normalizedExpected[index];

    if (actualChar === expectedChar && actualChar) {
      tokens.push({
        char: actualChar,
        status: "correct"
      });
      continue;
    }

    if (expectedChar && actualChar) {
      tokens.push({
        char: actualChar,
        status: "wrong"
      });
      continue;
    }

    if (expectedChar && !actualChar) {
      tokens.push({
        char: expectedChar,
        status: "missing"
      });
      continue;
    }

    if (actualChar && !expectedChar) {
      tokens.push({
        char: actualChar,
        status: "extra"
      });
    }
  }

  return tokens;
}
