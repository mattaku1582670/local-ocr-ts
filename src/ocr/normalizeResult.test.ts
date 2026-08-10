import { describe, expect, it } from "vitest";
import type { OcrResult } from "@paddleocr/paddleocr-js";
import { normalizePaddleResult } from "./normalizeResult";

function resultFixture(): OcrResult {
  return {
    image: { width: 800, height: 600 },
    items: [
      {
        text: "右上",
        score: 85,
        poly: [
          [300, 10],
          [400, 10],
          [400, 40],
          [300, 40],
        ],
      },
      {
        text: "下",
        score: Number.NaN,
        poly: [
          [10, 100],
          [100, 100],
          [100, 130],
          [10, 130],
        ],
      },
      {
        text: "左上",
        score: 1.4,
        poly: [
          [10, 12],
          [100, 12],
          [100, 42],
          [10, 42],
        ],
      },
    ],
    metrics: { detMs: 10, recMs: 20, totalMs: 30, detectedBoxes: 3, recognizedCount: 3 },
    runtime: {
      requestedBackend: "wasm",
      detProvider: "wasm",
      recProvider: "wasm",
      webgpuAvailable: false,
    },
  };
}

describe("normalizePaddleResult", () => {
  it("sorts horizontal reading order and builds full text", () => {
    const normalized = normalizePaddleResult(resultFixture());

    expect(normalized.blocks.map((block) => block.text)).toEqual(["左上", "右上", "下"]);
    expect(normalized.blocks.map((block) => block.order)).toEqual([0, 1, 2]);
    expect(normalized.rawText).toBe("左上\n右上\n下");
  });

  it("normalizes confidence into zero-to-one or null", () => {
    const normalized = normalizePaddleResult(resultFixture());

    expect(normalized.blocks[0]?.confidence).toBeCloseTo(0.014);
    expect(normalized.blocks[1]?.confidence).toBe(0.85);
    expect(normalized.blocks[2]?.confidence).toBeNull();
  });

  it("normalizes polygon tuples and runtime metadata", () => {
    const normalized = normalizePaddleResult(resultFixture());

    expect(normalized.blocks[0]?.polygon.points[0]).toEqual({ x: 10, y: 12 });
    expect(normalized.runtime).toEqual({
      requestedBackend: "wasm",
      detectionProvider: "wasm",
      recognitionProvider: "wasm",
      executionMode: "worker",
    });
  });
});
