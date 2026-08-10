// @vitest-environment node
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalLogger } from "./logService.js";

const temporaryDirectories: string[] = [];

async function createLogger(options: ConstructorParameters<typeof LocalLogger>[1] = {}) {
  const directory = await mkdtemp(join(tmpdir(), "Local OCR ログ "));
  temporaryDirectories.push(directory);
  return new LocalLogger(join(directory, "データ", "logs"), options);
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("LocalLogger", () => {
  it("writes structured metadata under a Japanese path", async () => {
    const logger = await createLogger();
    await logger.info("app.start", {
      appVersion: "0.1.0",
      platform: "win32",
      arch: "x64",
      dataSource: "portable",
    });
    const output = await readFile(logger.filePath, "utf8");
    expect(output).toContain('"event":"app.start"');
    expect(output).toContain('"dataSource":"portable"');
  });

  it("rejects fields that could contain OCR text or file paths", async () => {
    const logger = await createLogger();
    await expect(
      logger.info("ocr.completed", { ocrText: "機密の認識結果" } as never),
    ).rejects.toThrow();
    await expect(readFile(logger.filePath, "utf8")).rejects.toThrow();
  });

  it("rotates logs within the configured file count", async () => {
    const logger = await createLogger({ maxBytes: 256, maxFiles: 3 });
    for (let index = 0; index < 12; index += 1) {
      await logger.info("ocr.completed", {
        durationMs: index,
        imageWidth: 1920,
        imageHeight: 1080,
      });
    }
    await logger.flush();

    const files = (await readdir(join(logger.filePath, ".."))).filter((name) =>
      name.startsWith("local-ocr.log"),
    );
    expect(files.length).toBeLessThanOrEqual(3);
    expect(files).toContain("local-ocr.log");
  });

  it("suppresses debug output unless explicitly enabled", async () => {
    const logger = await createLogger();
    await logger.debug("settings.loaded", { settingsSource: "disk" });
    await expect(readFile(logger.filePath, "utf8")).rejects.toThrow();
  });
});
