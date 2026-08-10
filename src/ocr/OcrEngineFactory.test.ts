import { describe, expect, it } from "vitest";
import { createOcrEngine } from "./OcrEngineFactory";
import { PaddleOcrEngine } from "./PaddleOcrEngine";

describe("createOcrEngine", () => {
  it("creates the configured Paddle WASM engine", () => {
    expect(createOcrEngine("paddle-wasm")).toBeInstanceOf(PaddleOcrEngine);
  });
});
