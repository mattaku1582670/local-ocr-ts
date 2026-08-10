import { describe, expect, it } from "vitest";
import {
  assertLocalOcrAssetLocations,
  DETECTION_MODEL_FILE,
  RECOGNITION_MODEL_FILE,
  resolveOcrAssetLocations,
} from "./assets";

describe("OCR asset locations", () => {
  it.each([
    "http://127.0.0.1:5173/",
    "local-ocr://app/",
    "file:///C:/Program%20Files/LocalOCR/resources/app.asar/dist/index.html",
  ])("resolves models and WASM relative to the application for %s", (baseUrl) => {
    const locations = resolveOcrAssetLocations(baseUrl);

    expect(locations.detectionModelUrl).toContain(`/assets/models/${DETECTION_MODEL_FILE}`);
    expect(locations.recognitionModelUrl).toContain(`/assets/models/${RECOGNITION_MODEL_FILE}`);
    expect(locations.wasmBaseUrl).toMatch(/\/assets\/wasm\/$/u);
    expect(() => {
      assertLocalOcrAssetLocations(locations, baseUrl);
    }).not.toThrow();
  });

  it("rejects external model URLs", () => {
    expect(() => {
      assertLocalOcrAssetLocations(
        {
          detectionModelUrl: "https://cdn.example/det.tar",
          recognitionModelUrl: "http://127.0.0.1:5173/assets/models/rec.tar",
          wasmBaseUrl: "http://127.0.0.1:5173/assets/wasm/",
        },
        "http://127.0.0.1:5173/",
      );
    }).toThrow("同一origin");
  });

  it("rejects a different host for an opaque custom origin", () => {
    expect(() => {
      assertLocalOcrAssetLocations(
        {
          detectionModelUrl: "local-ocr://outside/assets/models/det.tar",
          recognitionModelUrl: "local-ocr://app/assets/models/rec.tar",
          wasmBaseUrl: "local-ocr://app/assets/wasm/",
        },
        "local-ocr://app/",
      );
    }).toThrow("同一origin");
  });
});
