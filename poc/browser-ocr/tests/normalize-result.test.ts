import type { OcrResult } from "@paddleocr/paddleocr-js";
import { describe, expect, it } from "vitest";

import { normalizePaddleResult } from "../src/ocr/PaddleOcrEngine";

describe("normalizePaddleResult", () => {
  it("preserves text, confidence, polygon, image size, duration, and providers", () => {
    const source: OcrResult = {
      image: { width: 640, height: 480 },
      items: [
        {
          text: "LOCAL OCR",
          score: 0.98,
          poly: [
            [10, 20],
            [210, 20],
            [210, 70],
            [10, 70],
          ],
        },
      ],
      metrics: {
        detMs: 10,
        recMs: 20,
        totalMs: 30,
        detectedBoxes: 1,
        recognizedCount: 1,
      },
      runtime: {
        requestedBackend: "wasm",
        detProvider: "wasm",
        recProvider: "wasm",
        webgpuAvailable: false,
      },
    };

    expect(normalizePaddleResult(source, "worker")).toEqual({
      text: "LOCAL OCR",
      blocks: [
        {
          text: "LOCAL OCR",
          confidence: 0.98,
          polygon: [
            [10, 20],
            [210, 20],
            [210, 70],
            [10, 70],
          ],
        },
      ],
      durationMs: 30,
      image: { width: 640, height: 480 },
      runtime: {
        requestedBackend: "wasm",
        detectionProvider: "wasm",
        recognitionProvider: "wasm",
        executionMode: "worker",
      },
    });
  });

  it("converts non-finite confidence to null", () => {
    const source: OcrResult = {
      image: { width: 1, height: 1 },
      items: [{ text: "", score: Number.NaN, poly: [] }],
      metrics: {
        detMs: 0,
        recMs: 0,
        totalMs: 0,
        detectedBoxes: 0,
        recognizedCount: 0,
      },
      runtime: {
        requestedBackend: "wasm",
        detProvider: "wasm",
        recProvider: "wasm",
        webgpuAvailable: false,
      },
    };

    expect(normalizePaddleResult(source, "main-thread").blocks[0]?.confidence).toBeNull();
  });
});
