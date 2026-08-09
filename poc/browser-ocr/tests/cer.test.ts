import { describe, expect, it } from "vitest";

import { calculateCer, calculateStrictCer, normalizeCerText } from "../src/evaluation/cer";

describe("CER", () => {
  it("counts Japanese substitutions by Unicode code point", () => {
    expect(calculateCer("日本語文字認識", "日本語文字認知")).toMatchObject({
      cer: 1 / 7,
      distance: 1,
      referenceLength: 7,
    });
  });

  it("normalizes width and whitespace for the primary metric", () => {
    expect(normalizeCerText("ＡＢＣ\r\n １２３")).toBe("ABC 123");
    expect(calculateCer("ABC 123", "ＡＢＣ\n１２３").cer).toBe(0);
    expect(calculateStrictCer("ABC 123", "ABC\n123").cer).toBeGreaterThan(0);
  });

  it("handles empty references without division by zero", () => {
    expect(calculateCer("", "")).toMatchObject({ cer: 0, distance: 0 });
    expect(calculateCer("", "OCR")).toMatchObject({ cer: 1, distance: 3 });
  });
});
