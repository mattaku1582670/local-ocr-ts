import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createDefaultSettings, settingsSchema, type Settings } from "./settingsSchema.js";

export type SettingsLoadSource = "disk" | "default-missing" | "default-invalid";

export interface LoadedSettings {
  settings: Settings;
  source: SettingsLoadSource;
}

export class SettingsService {
  readonly filePath: string;

  constructor(dataDirectory: string) {
    this.filePath = join(dataDirectory, "settings.json");
  }

  async load(): Promise<LoadedSettings> {
    try {
      const input = await readFile(this.filePath, "utf8");
      const settings = settingsSchema.parse(JSON.parse(input) as unknown);
      return { settings, source: "disk" };
    } catch (error) {
      const source =
        error instanceof Error && "code" in error && error.code === "ENOENT"
          ? "default-missing"
          : "default-invalid";
      return { settings: createDefaultSettings(), source };
    }
  }

  async save(input: unknown): Promise<Settings> {
    const settings = settingsSchema.parse(input);
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    return settings;
  }

  async reset(): Promise<Settings> {
    return this.save(createDefaultSettings());
  }
}
