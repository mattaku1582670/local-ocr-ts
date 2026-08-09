import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface ModelAssetConfig {
  fileName: string;
  sha256: string;
  source: string;
}

describe("model asset configuration", () => {
  it("pins two HTTPS model assets with SHA-256 values", async () => {
    const configPath = path.resolve("config", "model-assets.json");
    const parsed: unknown = JSON.parse(await readFile(configPath, "utf8"));
    expect(isAssetConfig(parsed)).toBe(true);

    if (!isAssetConfig(parsed)) {
      throw new Error("INVALID_TEST_ASSET_CONFIG");
    }

    expect(parsed.models).toHaveLength(2);
    for (const model of parsed.models) {
      expect(model.source.startsWith("https://")).toBe(true);
      expect(model.sha256).toMatch(/^[A-F0-9]{64}$/);
    }
  });
});

function isAssetConfig(value: unknown): value is { models: ModelAssetConfig[] } {
  if (typeof value !== "object" || value === null || !("models" in value)) {
    return false;
  }
  const models = value.models;
  return (
    Array.isArray(models) &&
    models.every(
      (model: unknown) =>
        typeof model === "object" &&
        model !== null &&
        "fileName" in model &&
        typeof model.fileName === "string" &&
        "sha256" in model &&
        typeof model.sha256 === "string" &&
        "source" in model &&
        typeof model.source === "string",
    )
  );
}
