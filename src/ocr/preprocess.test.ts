import { describe, expect, it, vi } from "vitest";
import type { NormalizedOcrResult } from "./OcrEngine";
import {
  applyDocumentPreset,
  calculateSafeImageDimensions,
  decodeOcrBitmap,
  MAX_OCR_PIXELS,
  PREPROCESS_PRESETS,
  preprocessImage,
  restoreOcrResultToSource,
  restorePointToSource,
  type PreprocessDependencies,
} from "./preprocess";

function fakeBitmap(width: number, height: number, close = vi.fn()): ImageBitmap {
  return { width, height, close };
}

function preprocessingFixture(pixels = new Uint8ClampedArray([20, 80, 140, 100])) {
  const calls: string[] = [];
  const outputClose = vi.fn();
  const output = fakeBitmap(1, 1, outputClose);
  const context = {
    fillStyle: "",
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low" as ImageSmoothingQuality,
    fillRect: vi.fn(() => calls.push("fill")),
    drawImage: vi.fn(() => calls.push("draw")),
    getImageData: vi.fn(() => {
      calls.push("read");
      return { data: pixels } as ImageData;
    }),
    putImageData: vi.fn(() => calls.push("write")),
  };
  const canvas = {
    getContext: vi.fn(() => context),
    transferToImageBitmap: vi.fn(() => output),
  };
  const dependencies: PreprocessDependencies = {
    createCanvas: vi.fn(() => canvas),
  };
  return { calls, canvas, context, dependencies, output, outputClose, pixels };
}

describe("preprocess presets", () => {
  it("defines the three product presets", () => {
    expect(PREPROCESS_PRESETS).toEqual(["none", "document", "screenshot"]);
  });

  it("composites transparency onto white before drawing for every preset", () => {
    for (const preset of PREPROCESS_PRESETS) {
      const fixture = preprocessingFixture();
      const processed = preprocessImage(fakeBitmap(640, 480), { preset }, fixture.dependencies);

      expect(fixture.context.fillStyle).toBe("#ffffff");
      expect(fixture.calls.slice(0, 2)).toEqual(["fill", "draw"]);
      expect(fixture.context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 640, 480);
      processed.dispose();
      expect(fixture.outputClose).toHaveBeenCalledOnce();
    }
  });

  it("uses light grayscale contrast only for the document preset", () => {
    const documentFixture = preprocessingFixture();
    preprocessImage(fakeBitmap(1, 1), { preset: "document" }, documentFixture.dependencies);
    expect(documentFixture.context.getImageData).toHaveBeenCalledOnce();
    expect(documentFixture.context.putImageData).toHaveBeenCalledOnce();
    expect(documentFixture.pixels[0]).toBe(documentFixture.pixels[1]);
    expect(documentFixture.pixels[1]).toBe(documentFixture.pixels[2]);
    expect(documentFixture.pixels[3]).toBe(255);

    for (const preset of ["none", "screenshot"] as const) {
      const fixture = preprocessingFixture();
      preprocessImage(fakeBitmap(1, 1), { preset }, fixture.dependencies);
      expect(fixture.context.getImageData).not.toHaveBeenCalled();
      expect(fixture.context.putImageData).not.toHaveBeenCalled();
    }
  });

  it("clamps document contrast without strong binary thresholding", () => {
    const pixels = new Uint8ClampedArray([0, 0, 0, 20, 128, 128, 128, 40, 255, 255, 255, 60]);
    applyDocumentPreset(pixels);
    expect(Array.from(pixels)).toEqual([0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255]);
  });
});

describe("safe OCR dimensions", () => {
  it("keeps a Full HD image unchanged", () => {
    expect(calculateSafeImageDimensions(1920, 1080)).toEqual({
      width: 1920,
      height: 1080,
      scale: 1,
      resized: false,
    });
  });

  it("shrinks A4 300dpi below the validated pixel budget while preserving aspect ratio", () => {
    const result = calculateSafeImageDimensions(2480, 3508);

    expect(result.width * result.height).toBeLessThanOrEqual(MAX_OCR_PIXELS);
    expect(result.resized).toBe(true);
    expect(result.width / result.height).toBeCloseTo(2480 / 3508, 3);
  });

  it("also respects the per-dimension Canvas safety limit", () => {
    const result = calculateSafeImageDimensions(50_000, 20, 10_000_000, 8192);
    expect(result.width).toBe(8192);
    expect(result.height).toBeGreaterThanOrEqual(1);
    expect(result.resized).toBe(true);
  });

  it("does not allow caller overrides to exceed the hard safety budget", () => {
    const result = calculateSafeImageDimensions(4000, 3000, 100_000_000, 100_000);
    expect(result.width * result.height).toBeLessThanOrEqual(MAX_OCR_PIXELS);
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(8192);
  });

  it("rejects invalid dimensions and limits", () => {
    expect(() => calculateSafeImageDimensions(0, 10)).toThrow("sourceWidth");
    expect(() => calculateSafeImageDimensions(10, 10, Number.NaN)).toThrow("maxPixels");
  });
});

describe("preprocess coordinate restoration", () => {
  const transform = {
    sourceWidth: 2480,
    sourceHeight: 3508,
    processedWidth: 1240,
    processedHeight: 1754,
    scaleX: 0.5,
    scaleY: 0.5,
  };

  it("maps processed coordinates back to original pixels and clamps boundaries", () => {
    expect(restorePointToSource({ x: 100, y: 200 }, transform)).toEqual({ x: 200, y: 400 });
    expect(restorePointToSource({ x: -10, y: 2000 }, transform)).toEqual({ x: 0, y: 3508 });
  });

  it("restores every polygon and reports original image dimensions", () => {
    const result: NormalizedOcrResult = {
      rawText: "text",
      blocks: [
        {
          id: "block-0",
          text: "text",
          confidence: 0.9,
          polygon: { points: [{ x: 10, y: 20 }] },
          order: 0,
        },
      ],
      durationMs: 10,
      image: { width: 1240, height: 1754 },
      runtime: {
        requestedBackend: "wasm",
        detectionProvider: "wasm",
        recognitionProvider: "wasm",
        executionMode: "worker",
      },
    };

    expect(restoreOcrResultToSource(result, transform)).toMatchObject({
      image: { width: 2480, height: 3508 },
      blocks: [{ polygon: { points: [{ x: 20, y: 40 }] } }],
    });
  });
});

describe("OCR decode orientation", () => {
  it("requests EXIF orientation correction and normalized color handling", async () => {
    const bitmap = fakeBitmap(300, 200);
    const decoder = vi.fn().mockResolvedValue(bitmap);
    const blob = new Blob();

    await expect(decodeOcrBitmap(blob, decoder)).resolves.toBe(bitmap);
    expect(decoder).toHaveBeenCalledWith(blob, {
      colorSpaceConversion: "default",
      imageOrientation: "from-image",
      premultiplyAlpha: "premultiply",
    });
  });
});
