import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { resolveApplicationAssetPath } from "./appProtocol.js";

const rendererDirectory = join("C:\\", "Local OCR", "dist");

describe("resolveApplicationAssetPath", () => {
  it("maps the application root and encoded local assets into dist", () => {
    expect(resolveApplicationAssetPath("local-ocr://app/", rendererDirectory)).toBe(
      join(rendererDirectory, "index.html"),
    );
    expect(
      resolveApplicationAssetPath(
        "local-ocr://app/assets/models/model%20name.tar",
        rendererDirectory,
      ),
    ).toBe(join(rendererDirectory, "assets", "models", "model name.tar"));
  });

  it("rejects another host, malformed escapes, and traversal", () => {
    expect(
      resolveApplicationAssetPath("local-ocr://outside/index.html", rendererDirectory),
    ).toBeNull();
    expect(resolveApplicationAssetPath("local-ocr://app/%ZZ", rendererDirectory)).toBeNull();
    expect(
      resolveApplicationAssetPath("local-ocr://app/%2e%2e%2fsecret.txt", rendererDirectory),
    ).toBeNull();
  });
});
