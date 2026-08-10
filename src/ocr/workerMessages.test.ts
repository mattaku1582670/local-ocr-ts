import { describe, expect, it } from "vitest";
import { deserializeWorkerError, serializeWorkerError } from "./workerMessages";

describe("Worker error serialization", () => {
  it("preserves safe error identity without stack data", () => {
    const serialized = serializeWorkerError(new TypeError("model failed"));

    expect(serialized).toEqual({ name: "TypeError", message: "model failed" });
    expect(deserializeWorkerError(serialized)).toMatchObject({
      name: "TypeError",
      message: "model failed",
    });
  });

  it("normalizes non-Error failures", () => {
    expect(serializeWorkerError("secret raw value")).toEqual({
      name: "Error",
      message: "OCR Workerで不明なエラーが発生しました。",
    });
  });
});
