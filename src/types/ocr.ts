import type { Polygon } from "./coordinates";

export const PREPROCESS_PRESETS = ["none", "document", "screenshot"] as const;
export type PreprocessPreset = (typeof PREPROCESS_PRESETS)[number];

export interface OcrBlock {
  id: string;
  text: string;
  confidence: number | null;
  polygon: Polygon;
  order: number;
}

export interface OcrMetadata {
  engine: string;
  engineVersion?: string;
  model: string;
  language: string;
  preprocessPreset: PreprocessPreset;
  durationMs: number;
  processedAt: string;
}

export interface OcrDocument {
  schemaVersion: "1.0";
  imageId: string;
  rawText: string;
  editedText: string;
  blocks: OcrBlock[];
  metadata: OcrMetadata;
}
