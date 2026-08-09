export interface CerMeasurement {
  readonly cer: number;
  readonly distance: number;
  readonly hypothesisLength: number;
  readonly referenceLength: number;
}

export function calculateCer(reference: string, hypothesis: string): CerMeasurement {
  const normalizedReference = normalizeCerText(reference);
  const normalizedHypothesis = normalizeCerText(hypothesis);
  const referenceCharacters = Array.from(normalizedReference);
  const hypothesisCharacters = Array.from(normalizedHypothesis);
  const distance = levenshteinDistance(referenceCharacters, hypothesisCharacters);
  return {
    cer:
      referenceCharacters.length === 0
        ? hypothesisCharacters.length === 0
          ? 0
          : 1
        : distance / referenceCharacters.length,
    distance,
    hypothesisLength: hypothesisCharacters.length,
    referenceLength: referenceCharacters.length,
  };
}

export function calculateStrictCer(reference: string, hypothesis: string): CerMeasurement {
  const normalizedReference = normalizeStrictText(reference);
  const normalizedHypothesis = normalizeStrictText(hypothesis);
  const referenceCharacters = Array.from(normalizedReference);
  const hypothesisCharacters = Array.from(normalizedHypothesis);
  const distance = levenshteinDistance(referenceCharacters, hypothesisCharacters);
  return {
    cer:
      referenceCharacters.length === 0
        ? hypothesisCharacters.length === 0
          ? 0
          : 1
        : distance / referenceCharacters.length,
    distance,
    hypothesisLength: hypothesisCharacters.length,
    referenceLength: referenceCharacters.length,
  };
}

export function normalizeCerText(value: string): string {
  return value.normalize("NFKC").replaceAll(/\s+/gu, " ").trim();
}

export function normalizeStrictText(value: string): string {
  return value
    .normalize("NFKC")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function levenshteinDistance(reference: readonly string[], hypothesis: readonly string[]): number {
  let previous = Array.from({ length: hypothesis.length + 1 }, (_, index) => index);
  for (let referenceIndex = 1; referenceIndex <= reference.length; referenceIndex += 1) {
    const current = [referenceIndex];
    for (let hypothesisIndex = 1; hypothesisIndex <= hypothesis.length; hypothesisIndex += 1) {
      const substitutionCost =
        reference[referenceIndex - 1] === hypothesis[hypothesisIndex - 1] ? 0 : 1;
      current[hypothesisIndex] = Math.min(
        (previous[hypothesisIndex] ?? 0) + 1,
        (current[hypothesisIndex - 1] ?? 0) + 1,
        (previous[hypothesisIndex - 1] ?? 0) + substitutionCost,
      );
    }
    previous = current;
  }
  return previous[hypothesis.length] ?? 0;
}
