import { z } from "zod";

export const SETTINGS_VERSION = 1 as const;

export const settingsSchema = z
  .object({
    version: z.literal(SETTINGS_VERSION),
    autoOcrAfterPaste: z.boolean(),
    autoCopyAfterOcr: z.boolean(),
    showOcrBoxes: z.boolean(),
    preprocessPreset: z.enum(["none", "standard"]),
    language: z.enum(["ja", "en"]),
    lowConfidenceThreshold: z.number().min(0).max(1),
    loggingEnabled: z.boolean(),
  })
  .strict();

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  version: SETTINGS_VERSION,
  autoOcrAfterPaste: false,
  autoCopyAfterOcr: false,
  showOcrBoxes: true,
  preprocessPreset: "standard",
  language: "ja",
  lowConfidenceThreshold: 0.6,
  loggingEnabled: true,
});

export function createDefaultSettings(): Settings {
  return { ...DEFAULT_SETTINGS };
}
