import { z } from "zod";

export const rendererSettingsSchema = z
  .object({
    version: z.literal(1),
    autoOcrAfterPaste: z.boolean(),
    autoCopyAfterOcr: z.boolean(),
    showOcrBoxes: z.boolean(),
    preprocessPreset: z.enum(["none", "document", "screenshot"]),
    language: z.enum(["ja", "en"]),
    lowConfidenceThreshold: z.number().min(0).max(1),
    loggingEnabled: z.boolean(),
  })
  .strict();

export type Settings = z.infer<typeof rendererSettingsSchema>;

export const DEFAULT_RENDERER_SETTINGS: Readonly<Settings> = Object.freeze({
  version: 1,
  autoOcrAfterPaste: false,
  autoCopyAfterOcr: false,
  showOcrBoxes: true,
  preprocessPreset: "none",
  language: "ja",
  lowConfidenceThreshold: 0.6,
  loggingEnabled: true,
});
