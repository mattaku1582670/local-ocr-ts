// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDefaultSettings } from "./settingsSchema.js";
import { SettingsService } from "./settingsService.js";
import { WindowStateService } from "./windowStateService.js";

const temporaryDirectories: string[] = [];

async function createJapaneseDataDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "Local OCR 日本語 "));
  temporaryDirectories.push(directory);
  return join(directory, "データ");
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("SettingsService", () => {
  it("returns defaults when the settings file is missing", async () => {
    const service = new SettingsService(await createJapaneseDataDirectory());
    await expect(service.load()).resolves.toEqual({
      settings: createDefaultSettings(),
      source: "default-missing",
    });
  });

  it("saves and reloads settings under a Japanese path", async () => {
    const service = new SettingsService(await createJapaneseDataDirectory());
    const settings = { ...createDefaultSettings(), autoOcrAfterPaste: true };
    await service.save(settings);

    await expect(service.load()).resolves.toEqual({ settings, source: "disk" });
    expect(await readFile(service.filePath, "utf8")).not.toContain("undefined");
  });

  it("falls back to defaults when persisted JSON is corrupt", async () => {
    const service = new SettingsService(await createJapaneseDataDirectory());
    await service.save(createDefaultSettings());
    await writeFile(service.filePath, "{broken", "utf8");

    const loaded = await service.load();
    expect(loaded.source).toBe("default-invalid");
    expect(loaded.settings).toEqual(createDefaultSettings());
  });

  it("rejects settings with unknown properties", async () => {
    const service = new SettingsService(await createJapaneseDataDirectory());
    await expect(
      service.save({ ...createDefaultSettings(), ocrText: "must not persist" }),
    ).rejects.toThrow();
  });
});

describe("WindowStateService", () => {
  it("saves and reloads a window state", async () => {
    const service = new WindowStateService(await createJapaneseDataDirectory());
    const state = {
      version: 1 as const,
      x: 120,
      y: 80,
      width: 1440,
      height: 900,
      isMaximized: true,
    };
    await service.save(state);
    await expect(service.load()).resolves.toEqual(state);
  });

  it("uses a safe default for an invalid state", async () => {
    const service = new WindowStateService(await createJapaneseDataDirectory());
    await service.save({ version: 1, width: 1280, height: 800, isMaximized: false });
    await writeFile(service.filePath, '{"width":1}', "utf8");
    await expect(service.load()).resolves.toMatchObject({ width: 1280, height: 800 });
  });
});
